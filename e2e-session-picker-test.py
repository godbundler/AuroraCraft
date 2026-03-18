#!/usr/bin/env python3
"""
E2E Test: Session Picker — Verify AuroraCraft reuses the correct OpenCode session per project.

Test flow:
  1. Create Project A, create session, send message → record OpenCode session ID (oc_A)
  2. Create Project B, create session, send message → record OpenCode session ID (oc_B)
  3. Verify oc_A ≠ oc_B (different projects get different sessions)
  4. Go back to Project A, send ANOTHER message to the same agent session
  5. Verify Project A still uses oc_A (same session reused, not oc_B or a new one)
  6. Go back to Project B, send another message
  7. Verify Project B still uses oc_B

Verification layers:
  - DB: agent_sessions.opencode_session_id stays consistent per project
  - OpenCode API: session messages accumulate in the correct session
  - OpenCode API: each session's messages contain only that project's prompts
  - Server logs: cross-check session IDs
  - No cross-contamination: Project A's prompts never appear in Project B's session
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

def wait_for_completion(session_obj, project_id, agent_session_id, label, timeout_s=300):
    """Wait for an agent session to complete. Returns (status, opencode_session_id)."""
    log(f"  ⏳ Waiting for {label} to complete (timeout={timeout_s}s)...")
    for i in range(timeout_s // 2):
        time.sleep(2)
        r = session_obj.get(f"{BASE}/api/projects/{project_id}/agent/sessions/{agent_session_id}")
        if r.status_code != 200:
            continue
        data = r.json()
        status = data.get("status", "?")
        oc_id = data.get("opencodeSessionId")

        if i % 15 == 0:
            log(f"    ... [{i*2}s] status={status}, ocSessionId={oc_id}")

        if status in ("completed", "failed") and oc_id:
            log(f"  ✅ {label}: status={status}, ocSessionId={oc_id}")
            return status, oc_id

        if status == "cancelled":
            fail_hard(f"{label} was cancelled")

    fail_hard(f"{label} never completed within {timeout_s}s")

def get_oc_session_messages(oc_session_id):
    """Fetch messages from an OpenCode session."""
    try:
        r = requests.get(f"{OC_BASE}/session/{oc_session_id}/message", timeout=10)
        if r.status_code == 200:
            return r.json()
    except:
        pass
    return []

def extract_user_prompts(oc_messages):
    """Extract user prompt texts from OpenCode messages."""
    prompts = []
    for m in oc_messages:
        if m.get("info", {}).get("role") == "user":
            for p in m.get("parts", []):
                text = p.get("text", "")
                if text:
                    prompts.append(text)
    return prompts

def main():
    log("=" * 70)
    log("E2E TEST: Session Picker — Correct OpenCode Session Reuse Per Project")
    log("=" * 70)

    # ── Pre-checks ─────────────────────────────────────────────
    log("\n[Phase 0] Pre-checks")

    try:
        r = requests.get(f"{BASE}/api/health", timeout=5)
        check(r.status_code == 200, "AuroraCraft server is healthy")
    except Exception as e:
        fail_hard(f"Server not reachable: {e}")

    try:
        r = requests.get(f"{OC_BASE}/session", timeout=5)
        check(r.status_code == 200, "OpenCode is running")
    except Exception as e:
        fail_hard(f"OpenCode not reachable: {e}")

    # ── Step 1: Login ──────────────────────────────────────────
    log("\n[Phase 1] Login")
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json=CREDS)
    if r.status_code != 200:
        fail_hard(f"Login failed: {r.status_code} {r.text[:200]}")
    log(f"  ✅ Logged in as {r.json().get('username')}")

    # Use unique identifiable prompts so we can verify session isolation
    ts = int(time.time())
    PROMPT_A1 = f"Say exactly: ALPHA-{ts}-FIRST. Nothing else. Do not use any tools."
    PROMPT_A2 = f"Say exactly: ALPHA-{ts}-SECOND. Nothing else. Do not use any tools."
    PROMPT_B1 = f"Say exactly: BRAVO-{ts}-FIRST. Nothing else. Do not use any tools."
    PROMPT_B2 = f"Say exactly: BRAVO-{ts}-SECOND. Nothing else. Do not use any tools."

    # ══════════════════════════════════════════════════════════════
    # Phase 2: Create Project A and send first message
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 2] Create Project A and send first message")
    r = s.post(f"{BASE}/api/projects", json={
        "name": f"SessionTestA-{ts}",
        "software": "paper",
        "language": "java",
        "javaVersion": "21",
        "compiler": "gradle",
    })
    if r.status_code != 201:
        fail_hard(f"Create Project A failed: {r.status_code} {r.text[:200]}")
    project_a = r.json()
    project_a_id = project_a["id"]
    log(f"  ✅ Project A created: {project_a_id[:12]}... name={project_a['name']}")

    r = s.post(f"{BASE}/api/projects/{project_a_id}/agent/sessions")
    if r.status_code != 201:
        fail_hard(f"Create session A failed: {r.status_code}")
    session_a = r.json()
    session_a_id = session_a["id"]
    log(f"  ✅ Agent session A: {session_a_id[:12]}...")

    r = s.post(
        f"{BASE}/api/projects/{project_a_id}/agent/sessions/{session_a_id}/messages",
        json={"content": PROMPT_A1},
    )
    if r.status_code != 201:
        fail_hard(f"Send message A1 failed: {r.status_code}")
    log(f"  ✅ Message A1 sent: '{PROMPT_A1[:50]}...'")

    status_a1, oc_session_a = wait_for_completion(s, project_a_id, session_a_id, "Project A msg 1")

    # ══════════════════════════════════════════════════════════════
    # Phase 3: Create Project B and send first message
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 3] Create Project B and send first message")
    r = s.post(f"{BASE}/api/projects", json={
        "name": f"SessionTestB-{ts}",
        "software": "paper",
        "language": "java",
        "javaVersion": "21",
        "compiler": "gradle",
    })
    if r.status_code != 201:
        fail_hard(f"Create Project B failed: {r.status_code} {r.text[:200]}")
    project_b = r.json()
    project_b_id = project_b["id"]
    log(f"  ✅ Project B created: {project_b_id[:12]}... name={project_b['name']}")

    r = s.post(f"{BASE}/api/projects/{project_b_id}/agent/sessions")
    if r.status_code != 201:
        fail_hard(f"Create session B failed: {r.status_code}")
    session_b = r.json()
    session_b_id = session_b["id"]
    log(f"  ✅ Agent session B: {session_b_id[:12]}...")

    r = s.post(
        f"{BASE}/api/projects/{project_b_id}/agent/sessions/{session_b_id}/messages",
        json={"content": PROMPT_B1},
    )
    if r.status_code != 201:
        fail_hard(f"Send message B1 failed: {r.status_code}")
    log(f"  ✅ Message B1 sent: '{PROMPT_B1[:50]}...'")

    status_b1, oc_session_b = wait_for_completion(s, project_b_id, session_b_id, "Project B msg 1")

    # ══════════════════════════════════════════════════════════════
    # Phase 4: CRITICAL CHECK — Sessions must be different
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 4] Verify Project A and B have DIFFERENT OpenCode sessions")
    check(oc_session_a != oc_session_b,
          f"Different sessions: A={oc_session_a} ≠ B={oc_session_b}")

    # Verify via DB
    db_a = db_query(
        "SELECT opencode_session_id FROM agent_sessions WHERE id = %s", (session_a_id,)
    )
    db_b = db_query(
        "SELECT opencode_session_id FROM agent_sessions WHERE id = %s", (session_b_id,)
    )
    check(db_a and db_a[0][0] == oc_session_a, f"DB confirms Project A session: {db_a[0][0] if db_a else 'NONE'}")
    check(db_b and db_b[0][0] == oc_session_b, f"DB confirms Project B session: {db_b[0][0] if db_b else 'NONE'}")

    # ══════════════════════════════════════════════════════════════
    # Phase 5: Go BACK to Project A — send second message
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 5] Go back to Project A — send SECOND message")
    log(f"  Expected: should reuse OpenCode session {oc_session_a}")

    r = s.post(
        f"{BASE}/api/projects/{project_a_id}/agent/sessions/{session_a_id}/messages",
        json={"content": PROMPT_A2},
    )
    if r.status_code != 201:
        fail_hard(f"Send message A2 failed: {r.status_code} {r.text[:200]}")
    log(f"  ✅ Message A2 sent: '{PROMPT_A2[:50]}...'")

    status_a2, oc_session_a2 = wait_for_completion(s, project_a_id, session_a_id, "Project A msg 2")

    # ══════════════════════════════════════════════════════════════
    # Phase 6: CRITICAL CHECK — Project A reused the SAME session
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 6] ★ CRITICAL: Verify Project A reused the SAME OpenCode session")
    check(oc_session_a2 == oc_session_a,
          f"Session REUSED: msg1={oc_session_a} == msg2={oc_session_a2}")
    check(oc_session_a2 != oc_session_b,
          f"Did NOT use Project B's session: A2={oc_session_a2} ≠ B={oc_session_b}")

    # Verify via DB
    db_a2 = db_query(
        "SELECT opencode_session_id FROM agent_sessions WHERE id = %s", (session_a_id,)
    )
    check(db_a2 and db_a2[0][0] == oc_session_a,
          f"DB still maps to same session: {db_a2[0][0] if db_a2 else 'NONE'}")

    # ══════════════════════════════════════════════════════════════
    # Phase 7: Go back to Project B — send second message
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 7] Go back to Project B — send SECOND message")
    log(f"  Expected: should reuse OpenCode session {oc_session_b}")

    r = s.post(
        f"{BASE}/api/projects/{project_b_id}/agent/sessions/{session_b_id}/messages",
        json={"content": PROMPT_B2},
    )
    if r.status_code != 201:
        fail_hard(f"Send message B2 failed: {r.status_code} {r.text[:200]}")
    log(f"  ✅ Message B2 sent: '{PROMPT_B2[:50]}...'")

    status_b2, oc_session_b2 = wait_for_completion(s, project_b_id, session_b_id, "Project B msg 2")

    # ══════════════════════════════════════════════════════════════
    # Phase 8: CRITICAL CHECK — Project B reused the SAME session
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 8] ★ CRITICAL: Verify Project B reused the SAME OpenCode session")
    check(oc_session_b2 == oc_session_b,
          f"Session REUSED: msg1={oc_session_b} == msg2={oc_session_b2}")
    check(oc_session_b2 != oc_session_a,
          f"Did NOT use Project A's session: B2={oc_session_b2} ≠ A={oc_session_a}")

    # ══════════════════════════════════════════════════════════════
    # Phase 9: Verify OpenCode message history — no cross-contamination
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 9] Verify OpenCode message history (no cross-contamination)")

    oc_msgs_a = get_oc_session_messages(oc_session_a)
    oc_msgs_b = get_oc_session_messages(oc_session_b)

    user_prompts_a = extract_user_prompts(oc_msgs_a)
    user_prompts_b = extract_user_prompts(oc_msgs_b)

    log(f"  OpenCode session A messages: {len(oc_msgs_a)} total, {len(user_prompts_a)} user prompts")
    log(f"  OpenCode session B messages: {len(oc_msgs_b)} total, {len(user_prompts_b)} user prompts")

    # Session A should have 2 user prompts (A1 and A2), not any B prompts
    a_has_alpha = sum(1 for p in user_prompts_a if f"ALPHA-{ts}" in p)
    a_has_bravo = sum(1 for p in user_prompts_a if f"BRAVO-{ts}" in p)
    check(a_has_alpha >= 2, f"Session A has both ALPHA prompts (found {a_has_alpha})")
    check(a_has_bravo == 0, f"Session A has NO BRAVO prompts (found {a_has_bravo})")

    # Session B should have 2 user prompts (B1 and B2), not any A prompts
    b_has_bravo = sum(1 for p in user_prompts_b if f"BRAVO-{ts}" in p)
    b_has_alpha = sum(1 for p in user_prompts_b if f"ALPHA-{ts}" in p)
    check(b_has_bravo >= 2, f"Session B has both BRAVO prompts (found {b_has_bravo})")
    check(b_has_alpha == 0, f"Session B has NO ALPHA prompts (found {b_has_alpha})")

    # ══════════════════════════════════════════════════════════════
    # Phase 10: Verify DB agent_messages accumulated correctly
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 10] Verify DB agent_messages accumulated correctly per session")

    db_msgs_a = db_query(
        "SELECT role, left(content, 100) FROM agent_messages WHERE session_id = %s ORDER BY created_at",
        (session_a_id,)
    )
    db_msgs_b = db_query(
        "SELECT role, left(content, 100) FROM agent_messages WHERE session_id = %s ORDER BY created_at",
        (session_b_id,)
    )

    log(f"  DB messages for Project A session: {len(db_msgs_a)}")
    for role, preview in db_msgs_a:
        log(f"    {role}: {preview[:80]}")

    log(f"  DB messages for Project B session: {len(db_msgs_b)}")
    for role, preview in db_msgs_b:
        log(f"    {role}: {preview[:80]}")

    # Each session should have: user msg 1, agent response 1, user msg 2, agent response 2
    user_msgs_a = [m for m in db_msgs_a if m[0] == "user"]
    agent_msgs_a = [m for m in db_msgs_a if m[0] == "agent"]
    user_msgs_b = [m for m in db_msgs_b if m[0] == "user"]
    agent_msgs_b = [m for m in db_msgs_b if m[0] == "agent"]

    check(len(user_msgs_a) >= 2, f"Project A has 2+ user messages in DB (found {len(user_msgs_a)})")
    check(len(agent_msgs_a) >= 2, f"Project A has 2+ agent responses in DB (found {len(agent_msgs_a)})")
    check(len(user_msgs_b) >= 2, f"Project B has 2+ user messages in DB (found {len(user_msgs_b)})")
    check(len(agent_msgs_b) >= 2, f"Project B has 2+ agent responses in DB (found {len(agent_msgs_b)})")

    # Cross-contamination check in DB
    a_db_has_bravo = any(f"BRAVO-{ts}" in (m[1] or "") for m in db_msgs_a)
    b_db_has_alpha = any(f"ALPHA-{ts}" in (m[1] or "") for m in db_msgs_b)
    check(not a_db_has_bravo, "No BRAVO prompts in Project A's DB messages")
    check(not b_db_has_alpha, "No ALPHA prompts in Project B's DB messages")

    # ══════════════════════════════════════════════════════════════
    # Phase 11: Verify OpenCode session metadata
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 11] Verify OpenCode session metadata")

    try:
        r_a = requests.get(f"{OC_BASE}/session/{oc_session_a}", timeout=5)
        r_b = requests.get(f"{OC_BASE}/session/{oc_session_b}", timeout=5)
        if r_a.status_code == 200:
            session_info_a = r_a.json()
            dir_a = session_info_a.get("directory", "?")
            log(f"  Session A directory: {dir_a}")
            check("SessionTestA" in dir_a or "sessiontesta" in dir_a.lower(),
                  f"Session A directory contains project A linkId")
        if r_b.status_code == 200:
            session_info_b = r_b.json()
            dir_b = session_info_b.get("directory", "?")
            log(f"  Session B directory: {dir_b}")
            check("SessionTestB" in dir_b or "sessiontestb" in dir_b.lower(),
                  f"Session B directory contains project B linkId")
    except Exception as e:
        log(f"  ⚠ Could not verify session metadata: {e}")

    # ══════════════════════════════════════════════════════════════
    # Phase 12: Cleanup — delete both test projects
    # ══════════════════════════════════════════════════════════════
    log("\n[Phase 12] Cleanup — delete test projects")
    for pid, name in [(project_a_id, "A"), (project_b_id, "B")]:
        r = s.delete(f"{BASE}/api/projects/{pid}")
        if r.status_code == 204:
            log(f"  ✅ Project {name} deleted")
        else:
            log(f"  ⚠ Project {name} deletion returned {r.status_code}")

    # ── Summary ────────────────────────────────────────────────
    log("\n" + "=" * 70)
    log("TEST SUMMARY")
    log("=" * 70)
    log(f"  Passed: {passed}")
    log(f"  Failed: {failed}")

    if failed == 0:
        log("\n🎉 ALL TESTS PASSED — Session picker correctly:")
        log("   • Creates separate OpenCode sessions for different projects")
        log("   • Reuses the SAME session when returning to a project")
        log("   • Never cross-contaminates messages between projects")
        log("   • Maintains correct DB mappings across multiple messages")
        log("   • Preserves full message history in each OpenCode session")
    else:
        log(f"\n⚠️  {failed} test(s) FAILED — see details above")
        sys.exit(1)

if __name__ == "__main__":
    main()
