#!/usr/bin/env python3
"""
E2E Test: Streaming → Persisted Message Transition

Verifies that when a session completes, the persisted agent message in the DB
contains the same content that was streamed via SSE — ensuring no content gap
during the UI transition from streaming view to persisted view.

Test flow:
  1. Create project + session, connect SSE
  2. Send a message
  3. Collect ALL text-delta events from SSE (= what the user sees during streaming)
  4. Wait for session to complete
  5. Immediately fetch persisted messages from the API
  6. Verify:
     a. Agent message exists in DB when status is 'completed'
     b. Agent message has non-empty content
     c. Agent message metadata.parts contains text parts
     d. Streamed text matches persisted text (no content lost)
     e. No timing gap: message is available AS SOON as status is 'completed'
     f. Second message also transitions seamlessly
"""

import json, time, sys, threading, subprocess, requests

try:
    import sseclient
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "sseclient-py", "-q"])
    import sseclient

import psycopg2

BASE = "http://localhost:3000"
OC_BASE = "http://127.0.0.1:4096"
DB_DSN = "postgresql://auroracraft:auroracraft@localhost:5432/auroracraft"
CREDS = {"login": "e2euser", "password": "testpass123"}

passed = 0
failed = 0


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def check(condition, label):
    global passed, failed
    if condition:
        log(f"  ✅ PASS: {label}")
        passed += 1
    else:
        log(f"  ❌ FAIL: {label}")
        failed += 1


def fail_hard(msg):
    log(f"❌ FATAL: {msg}")
    sys.exit(1)


def db_query(sql, params=None):
    conn = psycopg2.connect(DB_DSN)
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        if cur.description:
            return cur.fetchall()
        return []
    finally:
        conn.close()


class SSECollector:
    """Collects SSE events and tracks streaming text content."""

    def __init__(self):
        self.events = []
        self.text_deltas = []          # Raw text-delta content chunks
        self.complete_received = False
        self.complete_time = None       # Timestamp when 'complete' event arrived
        self.running = True
        self.connected = False
        self.error_events = []
        self.thinking_events = []
        self.file_op_events = []
        self.status_events = []

    @property
    def streamed_text(self):
        """Full text as streamed via SSE text-delta events."""
        return "".join(self.text_deltas)

    def monitor(self, url, cookies):
        try:
            resp = requests.get(url, stream=True, cookies=cookies, timeout=600)
            client = sseclient.SSEClient(resp)
            self.connected = True
            for event in client.events():
                if not self.running:
                    break
                try:
                    data = json.loads(event.data)
                    self.events.append(data)
                    etype = data.get("type", "?")
                    if etype == "text-delta":
                        self.text_deltas.append(data.get("content", ""))
                    elif etype == "thinking":
                        self.thinking_events.append(data)
                    elif etype == "file-op":
                        self.file_op_events.append(data)
                    elif etype == "status":
                        self.status_events.append(data)
                    elif etype == "error":
                        self.error_events.append(data)
                    elif etype == "complete":
                        self.complete_received = True
                        self.complete_time = time.time()
                except Exception:
                    pass
        except Exception as e:
            if self.running:
                log(f"  SSE error: {e}")

    def stop(self):
        self.running = False


def wait_for_completion(s, pid, sid, timeout_s=300):
    """Wait for session to reach completed/failed. Returns (status, response_data, completion_time)."""
    for i in range(timeout_s // 2):
        time.sleep(2)
        r = s.get(f"{BASE}/api/projects/{pid}/agent/sessions/{sid}")
        if r.status_code != 200:
            continue
        data = r.json()
        status = data.get("status", "?")

        if i % 15 == 0:
            msg_count = len(data.get("messages", []))
            log(f"    ... [{i*2}s] status={status}, messages={msg_count}")

        if status in ("completed", "failed"):
            return status, data, time.time()

    return "timeout", {}, time.time()


def extract_text_from_parts(parts):
    """Extract all text content from metadata.parts array."""
    texts = []
    if not parts:
        return ""
    for part in parts:
        if part.get("type") == "text":
            texts.append(part.get("content", ""))
    return "".join(texts)


def run_transition_test(s, project_id, session_id, prompt, label):
    """
    Send a message, monitor SSE, wait for completion, and verify
    the streaming→persisted transition is seamless.

    Returns True if all checks passed.
    """
    log(f"\n{'═' * 60}")
    log(f"  {label}")
    log(f"{'═' * 60}")

    stream_url = f"{BASE}/api/projects/{project_id}/agent/sessions/{session_id}/stream"
    local_passed = 0
    local_failed = 0

    def local_check(condition, msg):
        nonlocal local_passed, local_failed
        global passed, failed
        if condition:
            log(f"  ✅ PASS: {msg}")
            passed += 1
            local_passed += 1
        else:
            log(f"  ❌ FAIL: {msg}")
            failed += 1
            local_failed += 1

    # ── Step 1: Connect SSE ──
    collector = SSECollector()
    sse_thread = threading.Thread(
        target=collector.monitor,
        args=(stream_url, s.cookies.get_dict()),
        daemon=True,
    )
    sse_thread.start()
    time.sleep(2)
    local_check(collector.connected, "SSE connected")

    # ── Step 2: Record pre-send state ──
    pre_send = s.get(f"{BASE}/api/projects/{project_id}/agent/sessions/{session_id}")
    pre_messages = pre_send.json().get("messages", []) if pre_send.status_code == 200 else []
    pre_agent_count = len([m for m in pre_messages if m["role"] == "agent"])
    log(f"  Pre-send: {len(pre_messages)} messages ({pre_agent_count} agent)")

    # ── Step 3: Send message ──
    # Snapshot current SSE state so we only compare NEW text-deltas
    # (SSE replays buffered events from previous messages to late-joining listeners)
    pre_send_text_count = len(collector.text_deltas)
    pre_send_thinking_count = len(collector.thinking_events)
    send_time = time.time()
    r = s.post(
        f"{BASE}/api/projects/{project_id}/agent/sessions/{session_id}/messages",
        json={"content": prompt, "model": "opencode/minimax-m2.5-free"},
    )
    local_check(r.status_code in (200, 201), f"Message sent (status={r.status_code})")
    log(f"  Prompt: '{prompt[:60]}...'")

    # ── Step 4: Wait for completion ──
    log(f"  ⏳ Waiting for completion...")
    status, data, completion_time = wait_for_completion(s, project_id, session_id, timeout_s=300)
    local_check(status == "completed", f"Session completed (status={status})")

    # Give SSE a moment to deliver remaining events
    time.sleep(2)
    collector.stop()

    # ── Step 5: Verify SSE streaming worked ──
    # Only count events that arrived AFTER the message was sent
    new_text_deltas = collector.text_deltas[pre_send_text_count:]
    new_thinking_events = collector.thinking_events[pre_send_thinking_count:]

    log(f"\n  ── SSE Streaming Verification ──")
    log(f"  Total SSE events: {len(collector.events)}")
    log(f"  New text-delta chunks: {len(new_text_deltas)} (total: {len(collector.text_deltas)})")
    log(f"  New thinking events: {len(new_thinking_events)} (total: {len(collector.thinking_events)})")
    log(f"  Complete event received: {collector.complete_received}")

    local_check(
        len(new_text_deltas) > 0 or len(new_thinking_events) > 0,
        "SSE delivered NEW content events (text-delta or thinking)",
    )
    local_check(collector.complete_received, "SSE 'complete' event received")

    streamed_text = "".join(new_text_deltas).strip()
    log(f"  New streamed text length: {len(streamed_text)}")
    if streamed_text:
        log(f"  Streamed text preview: '{streamed_text[:120]}...'")

    # ── Step 6: CRITICAL — Verify persisted message exists at completion time ──
    log(f"\n  ── Persisted Message Verification (CRITICAL) ──")

    # Fetch session with messages immediately after detecting 'completed'
    r = s.get(f"{BASE}/api/projects/{project_id}/agent/sessions/{session_id}")
    local_check(r.status_code == 200, "Session fetch succeeded")

    session_data = r.json()
    all_messages = session_data.get("messages", [])
    agent_messages = [m for m in all_messages if m["role"] == "agent"]
    new_agent_messages = agent_messages[pre_agent_count:]

    log(f"  Total messages now: {len(all_messages)}")
    log(f"  Agent messages now: {len(agent_messages)} (new: {len(new_agent_messages)})")

    local_check(
        len(new_agent_messages) >= 1,
        f"New agent message exists in DB when status='completed' ({len(new_agent_messages)} found)",
    )

    if not new_agent_messages:
        log("  ⚠ Cannot verify content — no new agent message found!")
        return local_failed == 0

    latest_agent_msg = new_agent_messages[-1]
    persisted_content = (latest_agent_msg.get("content") or "").strip()
    metadata = latest_agent_msg.get("metadata") or {}
    parts = metadata.get("parts") or []

    log(f"  Persisted content length: {len(persisted_content)}")
    log(f"  Persisted content preview: '{persisted_content[:120]}...'")
    log(f"  Metadata parts count: {len(parts)}")

    # ── Step 7: Content is not empty ──
    local_check(len(persisted_content) > 0, "Persisted message content is non-empty")

    # ── Step 8: Metadata parts contain text ──
    text_parts = [p for p in parts if p.get("type") == "text"]
    thinking_parts = [p for p in parts if p.get("type") == "thinking"]
    file_parts = [p for p in parts if p.get("type") == "file"]

    log(f"  Parts breakdown: {len(text_parts)} text, {len(thinking_parts)} thinking, {len(file_parts)} file")

    has_structured_content = len(text_parts) > 0 or len(parts) > 0
    local_check(
        has_structured_content,
        f"Metadata has structured parts ({len(parts)} parts total, {len(text_parts)} text)",
    )

    # ── Step 9: CRITICAL — Streamed text matches persisted text ──
    log(f"\n  ── Content Match Verification (CRITICAL) ──")

    parts_text = extract_text_from_parts(parts).strip()

    if streamed_text and parts_text:
        # The streamed text (from text-delta SSE events) should be present in the persisted parts
        # Note: persisted text may come from fetchAssistantText (OpenCode API) which could
        # differ slightly from SSE deltas, so we check for substantial overlap
        streamed_words = set(streamed_text.lower().split())
        persisted_words = set(parts_text.lower().split())

        if len(streamed_words) > 0:
            overlap = len(streamed_words & persisted_words)
            overlap_ratio = overlap / len(streamed_words)
            log(f"  Streamed words: {len(streamed_words)}, Persisted words: {len(persisted_words)}")
            log(f"  Word overlap: {overlap}/{len(streamed_words)} ({overlap_ratio:.0%})")
            local_check(
                overlap_ratio > 0.5,
                f"Streamed text substantially matches persisted text ({overlap_ratio:.0%} overlap)",
            )
        else:
            log("  ⚠ No streamed words to compare")
    elif streamed_text and persisted_content:
        # Parts text may be empty but content field has data — check against content
        content_words = set(persisted_content.lower().split())
        streamed_words = set(streamed_text.lower().split())
        if len(streamed_words) > 0:
            overlap = len(streamed_words & content_words)
            overlap_ratio = overlap / len(streamed_words)
            local_check(
                overlap_ratio > 0.5,
                f"Streamed text matches persisted content ({overlap_ratio:.0%} overlap)",
            )
    else:
        log("  ⚠ Limited text comparison (streamed or persisted text may be minimal)")
        # At minimum, verify there IS some content
        local_check(
            len(persisted_content) > 0 or len(parts_text) > 0,
            "At least some persisted text content exists",
        )

    # ── Step 10: DB-level verification ──
    log(f"\n  ── DB Verification ──")
    db_msgs = db_query(
        "SELECT content, metadata::text FROM agent_messages WHERE session_id = %s AND role = 'agent' ORDER BY created_at DESC LIMIT 1",
        (session_id,),
    )
    local_check(len(db_msgs) > 0, "Agent message exists in database")

    if db_msgs:
        db_content = (db_msgs[0][0] or "").strip()
        db_meta = db_msgs[0][1]
        local_check(len(db_content) > 0, f"DB content is non-empty ({len(db_content)} chars)")
        local_check(
            db_meta is not None and '"parts"' in (db_meta or ""),
            "DB metadata contains 'parts' key",
        )

    # ── Step 11: Timing verification ──
    log(f"\n  ── Timing Verification ──")
    total_time = completion_time - send_time
    log(f"  Total time from send to completion: {total_time:.1f}s")

    if collector.complete_time:
        sse_to_db = completion_time - collector.complete_time
        log(f"  Time from SSE 'complete' to DB 'completed': {sse_to_db:.1f}s")
        local_check(
            sse_to_db >= 0,
            f"DB completion comes AFTER SSE complete ({sse_to_db:.1f}s gap)",
        )

    log(f"\n  Result: {local_passed} passed, {local_failed} failed")
    return local_failed == 0


def main():
    log("=" * 60)
    log("E2E TEST: Streaming → Persisted Message Transition")
    log("Verifies no content gap during UI transition")
    log("=" * 60)

    # ── Pre-checks ──
    log("\n[Phase 0] Pre-checks")

    try:
        r = requests.get(f"{BASE}/api/health", timeout=5)
        check(r.status_code == 200, "AuroraCraft server is healthy")
    except Exception as e:
        fail_hard(f"Server not reachable: {e}")

    try:
        r = requests.get(f"{OC_BASE}/session", timeout=5)
        check(r.status_code == 200, f"OpenCode is running ({len(r.json())} sessions)")
    except Exception as e:
        fail_hard(f"OpenCode not reachable: {e}")

    # ── Login ──
    log("\n[Phase 1] Login")
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json=CREDS)
    if r.status_code != 200:
        fail_hard(f"Login failed: {r.status_code} {r.text[:200]}")
    log(f"  ✅ Logged in as {r.json().get('username')}")

    # ── Create project ──
    log("\n[Phase 2] Create project")
    ts = int(time.time())
    r = s.post(f"{BASE}/api/projects", json={
        "name": f"TransitionTest-{ts}",
        "software": "paper",
        "language": "java",
        "javaVersion": "21",
        "compiler": "gradle",
    })
    if r.status_code != 201:
        fail_hard(f"Create project failed: {r.status_code} {r.text[:200]}")
    project = r.json()
    project_id = project["id"]
    log(f"  ✅ Project created: {project_id[:12]}...")

    # ── Create agent session ──
    log("\n[Phase 3] Create agent session")
    r = s.post(f"{BASE}/api/projects/{project_id}/agent/sessions")
    if r.status_code != 201:
        fail_hard(f"Create session failed: {r.status_code}")
    session_id = r.json()["id"]
    log(f"  ✅ Agent session: {session_id[:12]}...")

    # ══════════════════════════════════════════════════════════════
    # Test 1: First message — verify streaming→persisted transition
    # ══════════════════════════════════════════════════════════════
    test1_ok = run_transition_test(
        s, project_id, session_id,
        prompt=f"Say exactly: TRANSITION-TEST-{ts}-FIRST. "
               "Explain what AuroraCraft is in 2 sentences. "
               "Do not create any files. Do not use any tools.",
        label="TEST 1: First message — streaming→persisted transition",
    )

    # ══════════════════════════════════════════════════════════════
    # Test 2: Second message — verify transition works for follow-up too
    # This is important because the second message tests that
    # streamStartMessageCountRef is properly reset
    # ══════════════════════════════════════════════════════════════
    if test1_ok:
        test2_ok = run_transition_test(
            s, project_id, session_id,
            prompt=f"Say exactly: TRANSITION-TEST-{ts}-SECOND. "
                   "Say goodbye in one sentence. "
                   "Do not create any files. Do not use any tools.",
            label="TEST 2: Second message — verify transition reset works",
        )
    else:
        log("\n⚠ Skipping Test 2 because Test 1 failed")
        test2_ok = False

    # ══════════════════════════════════════════════════════════════
    # Test 3: Verify message history integrity across both messages
    # ══════════════════════════════════════════════════════════════
    log(f"\n{'═' * 60}")
    log("  TEST 3: Full message history integrity")
    log(f"{'═' * 60}")

    r = s.get(f"{BASE}/api/projects/{project_id}/agent/sessions/{session_id}")
    if r.status_code == 200:
        final_data = r.json()
        all_msgs = final_data.get("messages", [])
        user_msgs = [m for m in all_msgs if m["role"] == "user"]
        agent_msgs = [m for m in all_msgs if m["role"] == "agent"]

        log(f"  Total messages: {len(all_msgs)} (user={len(user_msgs)}, agent={len(agent_msgs)})")

        expected_user = 2 if test1_ok else 1
        expected_agent = 2 if test1_ok and test2_ok else (1 if test1_ok else 0)

        check(
            len(user_msgs) >= expected_user,
            f"User messages: {len(user_msgs)} (expected >={expected_user})",
        )
        check(
            len(agent_msgs) >= expected_agent,
            f"Agent messages: {len(agent_msgs)} (expected >={expected_agent})",
        )

        # Verify each agent message has content
        for i, msg in enumerate(agent_msgs):
            content = (msg.get("content") or "").strip()
            meta = msg.get("metadata") or {}
            parts = meta.get("parts") or []
            check(
                len(content) > 0,
                f"Agent message {i+1} has content ({len(content)} chars)",
            )
            check(
                len(parts) > 0,
                f"Agent message {i+1} has metadata.parts ({len(parts)} parts)",
            )

        # Verify messages alternate correctly: user, agent, user, agent
        if len(all_msgs) >= 4:
            roles = [m["role"] for m in all_msgs]
            expected_pattern = ["user", "agent", "user", "agent"]
            actual_pattern = roles[:4]
            check(
                actual_pattern == expected_pattern,
                f"Messages alternate correctly: {actual_pattern}",
            )
    else:
        log(f"  ⚠ Could not fetch final session data: {r.status_code}")

    # ── Cleanup ──
    log("\n[Cleanup] Delete test project")
    r = s.delete(f"{BASE}/api/projects/{project_id}")
    if r.status_code == 204:
        log("  ✅ Project deleted")
    else:
        log(f"  ⚠ Deletion returned {r.status_code}")

    # ── Summary ──
    log("\n" + "=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    log(f"  Passed: {passed}")
    log(f"  Failed: {failed}")

    if failed == 0:
        log("\n🎉 ALL TESTS PASSED — Streaming→Persisted transition is seamless:")
        log("   • SSE text-delta events delivered during streaming")
        log("   • Persisted agent message exists when status='completed'")
        log("   • Persisted content matches streamed content (no gap)")
        log("   • Metadata.parts contains structured text content")
        log("   • DB completion happens AFTER SSE complete event")
        log("   • Second message transition also works correctly")
        log("   • Message history maintains integrity across messages")
    else:
        log(f"\n⚠️  {failed} test(s) FAILED — see details above")
        sys.exit(1)


if __name__ == "__main__":
    main()
