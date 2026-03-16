#!/usr/bin/env python3
"""E2E test: Verify 2nd+ messages in a session work correctly.

Tests the fix for the bug where stale 'complete' events from the 1st message
were replayed to the 2nd message's subscriber, causing it to immediately
resolve and never capture the actual response.
"""

import requests
import threading
import time
import json
import sys

BASE = "http://localhost:3000"
MODEL = "opencode/minimax-m2.5-free"

def log(msg):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def wait_for_completion(sess, pid, sid, timeout=180):
    """Poll session status until completed/failed, return session data."""
    start = time.time()
    while time.time() - start < timeout:
        data = sess.get(f"{BASE}/api/projects/{pid}/agent/sessions/{sid}").json()
        status = data.get("status", "?")
        if status in ("completed", "failed", "cancelled"):
            return data
        time.sleep(2)
    return sess.get(f"{BASE}/api/projects/{pid}/agent/sessions/{sid}").json()

def collect_sse_events(sess, pid, sid, stop_event, event_list):
    """Background thread to collect SSE events."""
    try:
        r = sess.get(
            f"{BASE}/api/projects/{pid}/agent/sessions/{sid}/stream",
            stream=True, timeout=200
        )
        for line in r.iter_lines(decode_unicode=True):
            if stop_event.is_set():
                break
            if line and line.startswith("data: "):
                try:
                    ev = json.loads(line[6:])
                    event_list.append({"t": time.time(), "e": ev})
                    et = ev.get("type", "?")
                    if et == "text-delta":
                        log(f"  📝 TEXT: {ev.get('content', '')[:80]!r}")
                    elif et == "thinking":
                        if ev.get("done"):
                            log(f"  🧠 THINKING done")
                        # Don't spam non-done thinking events
                    elif et == "file-op":
                        log(f"  📁 {ev.get('action','?')} {ev.get('path','?')[:40]} [{ev.get('status','?')}]")
                    elif et == "status":
                        log(f"  📊 STATUS: {ev.get('status','?')}")
                    elif et == "complete":
                        log(f"  ✅ COMPLETE")
                    elif et == "error":
                        log(f"  ❌ ERROR: {ev.get('message','?')}")
                except json.JSONDecodeError:
                    pass
    except Exception as ex:
        if not stop_event.is_set():
            log(f"  SSE ended: {type(ex).__name__}")

def main():
    sess = requests.Session()

    # Login
    r = sess.post(f"{BASE}/api/auth/login", json={"login": "e2euser", "password": "testpass123"})
    if r.status_code != 200:
        log(f"❌ Login failed: {r.status_code} {r.text}")
        sys.exit(1)
    log("✅ Logged in")

    # Get projects
    projects = sess.get(f"{BASE}/api/projects").json()
    if not projects:
        log("❌ No projects found")
        sys.exit(1)
    PID = projects[0]["id"]
    log(f"Project: {projects[0]['name']} ({PID})")

    # Create a new session
    session = sess.post(f"{BASE}/api/projects/{PID}/agent/sessions").json()
    SID = session["id"]
    log(f"Session: {SID}")

    # Start SSE listener (stays connected for both messages)
    events = []
    stop_sse = threading.Event()
    t = threading.Thread(target=collect_sse_events, args=(sess, PID, SID, stop_sse, events), daemon=True)
    t.start()
    time.sleep(1)

    # ═══════════════════════════════════════════════════════════════
    # MESSAGE 1
    # ═══════════════════════════════════════════════════════════════
    log("")
    log("═══ MESSAGE 1: 'Hi' ═══")
    r = sess.post(f"{BASE}/api/projects/{PID}/agent/sessions/{SID}/messages",
                  json={"content": "Hi", "model": MODEL})
    if r.status_code != 201:
        log(f"❌ Send failed: {r.status_code} {r.text}")
        sys.exit(1)
    log("Sent. Waiting for completion (up to 3 min)...")

    data = wait_for_completion(sess, PID, SID, timeout=180)
    msg1_count = len(data.get("messages", []))
    msg1_status = data.get("status", "?")
    log(f"Result: {msg1_count} messages, status={msg1_status}")

    if msg1_status != "completed" or msg1_count < 2:
        log(f"❌ Message 1 failed to complete (status={msg1_status}, msgs={msg1_count})")
        # Try to continue anyway to test message 2
        if msg1_count < 2:
            log("Cannot continue without message 1 completing")
            sys.exit(1)

    msg1_events = [e for e in events]
    complete_in_msg1 = sum(1 for e in msg1_events if e["e"].get("type") == "complete")
    log(f"✅ Message 1 done: {len(msg1_events)} SSE events, {complete_in_msg1} complete events")

    # ═══════════════════════════════════════════════════════════════
    # MESSAGE 2
    # ═══════════════════════════════════════════════════════════════
    log("")
    log("═══ MESSAGE 2: 'Can you help me ?' ═══")

    # Record event count before message 2
    events_before_msg2 = len(events)

    r = sess.post(f"{BASE}/api/projects/{PID}/agent/sessions/{SID}/messages",
                  json={"content": "Can you help me ?", "model": MODEL})
    if r.status_code == 409:
        log(f"❌ FAIL: 409 - Session stuck as 'running' from message 1")
        sys.exit(1)
    if r.status_code != 201:
        log(f"❌ Send failed: {r.status_code} {r.text}")
        sys.exit(1)
    log("Sent. Waiting for completion (up to 3 min)...")

    data = wait_for_completion(sess, PID, SID, timeout=180)
    msg2_count = len(data.get("messages", []))
    msg2_status = data.get("status", "?")
    log(f"Result: {msg2_count} messages, status={msg2_status}")

    # Events from message 2 only
    msg2_events = events[events_before_msg2:]
    text_in_msg2 = [e for e in msg2_events if e["e"].get("type") == "text-delta"]
    complete_in_msg2 = [e for e in msg2_events if e["e"].get("type") == "complete"]
    thinking_in_msg2 = [e for e in msg2_events if e["e"].get("type") == "thinking"]

    stop_sse.set()

    # ═══════════════════════════════════════════════════════════════
    # VALIDATION
    # ═══════════════════════════════════════════════════════════════
    log("")
    log("═══ VALIDATION ═══")
    all_passed = True

    # Test 1: Should have 4+ messages
    if msg2_count >= 4:
        log(f"✅ {msg2_count} messages (user+agent+user+agent)")
    elif msg2_count == 3:
        log(f"❌ FAIL: Only 3 messages — 2nd agent response NOT saved!")
        all_passed = False
    else:
        log(f"❌ FAIL: Unexpected {msg2_count} messages")
        all_passed = False

    # Test 2: Session should be completed
    if msg2_status == "completed":
        log(f"✅ Session completed")
    elif msg2_status == "running":
        log(f"❌ FAIL: Session stuck as 'running'")
        all_passed = False
    else:
        log(f"⚠️  Session status: {msg2_status}")

    # Test 3: SSE streamed events for message 2
    log(f"Message 2 SSE: {len(msg2_events)} events ({len(text_in_msg2)} text, {len(thinking_in_msg2)} thinking, {len(complete_in_msg2)} complete)")
    if len(msg2_events) > 0:
        log(f"✅ SSE events received for message 2")
    else:
        log(f"⚠️  No SSE events for message 2 (might be timing issue)")

    # Test 4: 2nd response is different from 1st
    messages = data.get("messages", [])
    agent_msgs = [m for m in messages if m.get("role") == "agent"]
    if len(agent_msgs) >= 2:
        t1 = agent_msgs[0].get("content", "")[:100]
        t2 = agent_msgs[1].get("content", "")[:100]
        if t1 != t2:
            log(f"✅ Responses are different (not stale)")
            log(f"   1st: {t1!r}")
            log(f"   2nd: {t2!r}")
        else:
            log(f"❌ FAIL: Responses identical (stale data!)")
            all_passed = False

    log("")
    if all_passed:
        log("🎉 ALL TESTS PASSED — 2nd message works correctly!")
    else:
        log("💥 SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
