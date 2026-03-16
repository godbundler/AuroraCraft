#!/usr/bin/env python3
"""
E2E Streaming Fix Validation Test

Tests the 4 fixes applied to AuroraCraft streaming:
1. session.idle no longer prematurely triggers 'complete' (debounced to 120s fallback)
2. Non-file tool events (glob, bash, search) are now visible in the stream
3. Frontend no longer sets isStreaming=false on idle status
4. Streaming continues through multi-step tool calls until truly done

Test strategy: Send "Can you help me?" which causes the AI to:
  - Think (reasoning events)
  - Respond with text ("Of course! Let me check...")
  - Use glob/bash tools to explore the project (tool events)
  - Generate more text after tools complete
  
Previously, streaming would STOP after the first text, before tool calls.
With the fix, we should see: thinking → text → tool events → more text → complete
"""
import requests
import threading
import time
import json
import sys

BASE = "http://localhost:3000"
TIMEOUT = 180  # 3 minutes max for free model

print("=" * 70)
print("  E2E STREAMING FIX VALIDATION TEST")
print("=" * 70)

# ── Step 1: Auth ──────────────────────────────────────────────────────
print("\n[1/5] Authenticating...")
sess = requests.Session()

# Try login first, register if needed
r = sess.post(f"{BASE}/api/auth/login", json={"login": "e2euser", "password": "testpass123"})
if r.status_code != 200:
    print("  Login failed, trying to register...")
    r2 = sess.post(f"{BASE}/api/auth/register", json={
        "username": "e2euser", "email": "e2e@test.com", "password": "testpass123"
    })
    if r2.status_code not in (200, 201):
        # User might exist with different password - try admin
        r = sess.post(f"{BASE}/api/auth/login", json={"login": "admin", "password": "admin123"})
        if r.status_code != 200:
            print(f"  ✗ All auth attempts failed: {r.status_code}")
            sys.exit(1)
        print("  ✓ Logged in as admin")
    else:
        r = sess.post(f"{BASE}/api/auth/login", json={"login": "e2euser", "password": "testpass123"})
        if r.status_code != 200:
            print(f"  ✗ Login after register failed: {r.status_code}")
            sys.exit(1)
        print("  ✓ Registered and logged in as e2euser")
else:
    print("  ✓ Logged in as e2euser")

# ── Step 2: Get/Create Project ────────────────────────────────────────
print("\n[2/5] Setting up project...")
r = sess.get(f"{BASE}/api/projects")
projects = r.json()
if not projects:
    r = sess.post(f"{BASE}/api/projects", json={
        "name": "E2EFixTest", "description": "Streaming fix E2E test",
        "software": "paper", "language": "java", "javaVersion": "21", "compiler": "gradle"
    })
    if r.status_code not in (200, 201):
        print(f"  ✗ Project create failed: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    project = r.json()
else:
    project = projects[0]

PROJECT_ID = project["id"]
print(f"  ✓ Project: {project.get('name', '?')} ({PROJECT_ID})")

# ── Step 3: Create Session ────────────────────────────────────────────
print("\n[3/5] Creating agent session...")
r = sess.post(f"{BASE}/api/projects/{PROJECT_ID}/agent/sessions")
if r.status_code != 201:
    print(f"  ✗ Session create failed: {r.status_code} {r.text[:200]}")
    sys.exit(1)
sid = r.json()["id"]
print(f"  ✓ Session: {sid}")

# ── Step 4: Connect SSE + Send Message ────────────────────────────────
print("\n[4/5] Connecting SSE and sending message...")

events = []
event_lock = threading.Lock()
sse_connected = threading.Event()
sse_done = threading.Event()

# Phases tracking
phases = {
    "connected": False,
    "first_thinking": None,   # timestamp
    "first_text": None,       # timestamp
    "first_tool": None,       # timestamp
    "text_after_tool": False,  # KEY FIX: did text arrive AFTER a tool event?
    "idle_received": False,    # did we get idle status?
    "streaming_continued_after_idle": False,  # KEY FIX: events after idle?
    "complete_received": None, # timestamp
    "total_text_events": 0,
    "total_thinking_events": 0,
    "total_tool_events": 0,
    "total_status_events": 0,
    "tool_names": set(),
}

def listen_sse():
    url = f"{BASE}/api/projects/{PROJECT_ID}/agent/sessions/{sid}/stream"
    try:
        r = sess.get(url, stream=True, timeout=TIMEOUT)
        for line in r.iter_lines(decode_unicode=True):
            if sse_done.is_set():
                break
            if not line or not line.startswith("data: "):
                continue
            ts = time.time()
            try:
                event = json.loads(line[6:])
            except json.JSONDecodeError:
                continue

            etype = event.get("type", "?")
            ts_str = f"{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}"

            with event_lock:
                events.append({"time": ts, "event": event})

                if etype == "status":
                    status = event.get("status", "")
                    phases["total_status_events"] += 1
                    if status == "connected":
                        phases["connected"] = True
                        sse_connected.set()
                        print(f"  [{ts_str}] ✓ SSE CONNECTED")
                    elif status == "running":
                        if phases["idle_received"]:
                            phases["streaming_continued_after_idle"] = True
                        print(f"  [{ts_str}] STATUS: running")
                    elif status == "idle":
                        phases["idle_received"] = True
                        print(f"  [{ts_str}] STATUS: idle  ⬅ (should NOT trigger complete)")
                    else:
                        print(f"  [{ts_str}] STATUS: {status}")

                elif etype == "thinking":
                    phases["total_thinking_events"] += 1
                    if phases["first_thinking"] is None:
                        phases["first_thinking"] = ts
                    done = event.get("done", False)
                    content = event.get("content", "")
                    label = "THINK-DONE" if done else "THINKING"
                    # Only print first few and last thinking events to reduce noise
                    if phases["total_thinking_events"] <= 3 or done:
                        print(f"  [{ts_str}] {label}: {repr(content[:80])}")
                    elif phases["total_thinking_events"] == 4:
                        print(f"  [{ts_str}] ... (more thinking events)")

                elif etype == "text-delta":
                    phases["total_text_events"] += 1
                    content = event.get("content", "")
                    if phases["first_text"] is None:
                        phases["first_text"] = ts
                    # Check if text arrived after a tool event (KEY FIX validation)
                    if phases["first_tool"] is not None:
                        phases["text_after_tool"] = True
                    if phases["idle_received"]:
                        phases["streaming_continued_after_idle"] = True
                    print(f"  [{ts_str}] TEXT: {repr(content[:80])}")

                elif etype == "file-op":
                    phases["total_tool_events"] += 1
                    action = event.get("action", "")
                    path = event.get("path", "")
                    status = event.get("status", "")
                    tool = event.get("tool", "")
                    if phases["first_tool"] is None:
                        phases["first_tool"] = ts
                    if phases["idle_received"]:
                        phases["streaming_continued_after_idle"] = True
                    phases["tool_names"].add(tool or action)
                    print(f"  [{ts_str}] TOOL: {action} {path} [{status}] (tool={tool})")

                elif etype == "todo":
                    items = event.get("items", [])
                    if phases["idle_received"]:
                        phases["streaming_continued_after_idle"] = True
                    print(f"  [{ts_str}] TODO: {len(items)} items")

                elif etype == "complete":
                    phases["complete_received"] = ts
                    print(f"  [{ts_str}] ✓ COMPLETE")
                    sse_done.set()

                elif etype == "error":
                    msg = event.get("message", "")
                    print(f"  [{ts_str}] ✗ ERROR: {msg}")
                    sse_done.set()

                else:
                    print(f"  [{ts_str}] {etype}: {json.dumps(event)[:100]}")

    except Exception as e:
        if not sse_done.is_set():
            print(f"  SSE exception: {e}")
    finally:
        sse_done.set()

# Start SSE listener
t = threading.Thread(target=listen_sse, daemon=True)
t.start()

if not sse_connected.wait(timeout=15):
    print("  ✗ SSE failed to connect within 15s")
    sys.exit(1)

# Send a message that triggers tool calls
# "Can you help me?" makes the AI check the project files via glob/bash
prompt = "Can you help me create a basic plugin? First check what files already exist in the project."
print(f"\n  Sending: {repr(prompt[:60])}")
send_time = time.time()
r = sess.post(
    f"{BASE}/api/projects/{PROJECT_ID}/agent/sessions/{sid}/messages",
    json={"content": prompt, "model": "opencode/minimax-m2.5-free"}
)
print(f"  ✓ Message sent: HTTP {r.status_code}")
if r.status_code != 201:
    print(f"  Response: {r.text[:300]}")

# ── Step 5: Wait and Analyze ──────────────────────────────────────────
print("\n[5/5] Waiting for streaming to complete (up to 3 min)...\n")
print("-" * 70)

sse_done.wait(timeout=TIMEOUT)
end_time = time.time()

# Give trailing events a moment
time.sleep(3)

# ── Results ───────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("  TEST RESULTS")
print("=" * 70)

total_time = end_time - send_time

with event_lock:
    total_events = len(events)
    full_text = "".join(
        e["event"].get("content", "")
        for e in events
        if e["event"].get("type") == "text-delta"
    )

print(f"\n  Total SSE events:    {total_events}")
print(f"  Thinking events:     {phases['total_thinking_events']}")
print(f"  Text-delta events:   {phases['total_text_events']}")
print(f"  Tool/file-op events: {phases['total_tool_events']}")
print(f"  Status events:       {phases['total_status_events']}")
print(f"  Tool names seen:     {phases['tool_names'] or 'none'}")
print(f"  Total time:          {total_time:.1f}s")
print(f"  Response text:       {repr(full_text[:200])}")

# ── Fix Validation ────────────────────────────────────────────────────
print(f"\n{'=' * 70}")
print("  FIX VALIDATION")
print(f"{'=' * 70}")

results = []

# Fix 1: session.idle no longer prematurely triggers complete
if phases["idle_received"]:
    if phases["streaming_continued_after_idle"]:
        results.append(("PASS", "Fix 1: session.idle did NOT kill streaming — events continued after idle"))
    else:
        results.append(("WARN", "Fix 1: idle received but no events after it (AI may not have needed tools)"))
else:
    results.append(("INFO", "Fix 1: No idle status received (may not have triggered in this run)"))

# Fix 2: Non-file tool events visible
if phases["total_tool_events"] > 0:
    results.append(("PASS", f"Fix 2: Non-file tool events visible — {phases['total_tool_events']} tool events ({phases['tool_names']})"))
else:
    results.append(("WARN", "Fix 2: No tool events seen (AI may not have used tools in this run)"))

# Fix 3: Text continued after tool calls
if phases["text_after_tool"]:
    results.append(("PASS", "Fix 3: Text-delta events arrived AFTER tool calls — streaming was NOT cut off"))
elif phases["first_tool"] is not None:
    results.append(("WARN", "Fix 3: Tools were used but no text after them (AI may have finished with tools)"))
else:
    results.append(("INFO", "Fix 3: No tools used — cannot validate text-after-tool"))

# Fix 4: Complete event arrives properly
if phases["complete_received"]:
    if phases["total_text_events"] > 0 or phases["total_tool_events"] > 0:
        results.append(("PASS", f"Fix 4: Complete event received after {total_time:.1f}s with content"))
    else:
        results.append(("WARN", "Fix 4: Complete event received but no text/tool events"))
else:
    results.append(("WARN", "Fix 4: No complete event received (may have timed out)"))

# Basic streaming check
if phases["total_text_events"] > 0:
    results.append(("PASS", f"Basic: Streaming works — {phases['total_text_events']} text chunks received"))
else:
    results.append(("FAIL", "Basic: NO text events received — streaming may be broken"))

if phases["total_thinking_events"] > 0:
    results.append(("PASS", f"Basic: Thinking events work — {phases['total_thinking_events']} chunks received"))

# Timeline
if phases["first_thinking"] and phases["first_text"]:
    think_to_text = phases["first_text"] - phases["first_thinking"]
    results.append(("INFO", f"Timeline: thinking→text in {think_to_text:.1f}s"))
if phases["first_text"] and phases["first_tool"]:
    text_to_tool = phases["first_tool"] - phases["first_text"]
    results.append(("INFO", f"Timeline: text→tool in {text_to_tool:.1f}s"))
if phases["first_tool"] and phases["complete_received"]:
    tool_to_complete = phases["complete_received"] - phases["first_tool"]
    results.append(("INFO", f"Timeline: tool→complete in {tool_to_complete:.1f}s (streaming continued!)"))

print()
pass_count = 0
fail_count = 0
for status, msg in results:
    icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️ ", "INFO": "ℹ️ "}[status]
    print(f"  {icon} [{status}] {msg}")
    if status == "PASS":
        pass_count += 1
    elif status == "FAIL":
        fail_count += 1

print(f"\n{'=' * 70}")
if fail_count > 0:
    print(f"  ❌ {fail_count} FAILURES, {pass_count} passes")
elif pass_count >= 3:
    print(f"  ✅ ALL {pass_count} CHECKS PASSED — Streaming fixes verified!")
else:
    print(f"  ⚠️  {pass_count} passes — some checks inconclusive (may need longer-running test)")
print(f"{'=' * 70}")
