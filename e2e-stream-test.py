#!/usr/bin/env python3
"""E2E test for AuroraCraft real-time SSE streaming."""
import requests
import threading
import time
import json
import sys

BASE = "http://localhost:3000"

# Get session cookie
sess = requests.Session()
r = sess.post(f"{BASE}/api/auth/login", json={"login": "e2euser", "password": "testpass123"})
if r.status_code != 200:
    print(f"Login failed: {r.status_code} {r.text}")
    sys.exit(1)
print("✓ Logged in")

# Get or create project
r = sess.get(f"{BASE}/api/projects")
projects = r.json()
if not projects:
    print("No projects found")
    sys.exit(1)
project = projects[0]
PROJECT_ID = project["id"]
print(f"✓ Project: {project['name']} ({PROJECT_ID})")

# Create a fresh session
r = sess.post(f"{BASE}/api/projects/{PROJECT_ID}/agent/sessions")
if r.status_code != 201:
    print(f"Session create failed: {r.status_code} {r.text}")
    sys.exit(1)
sid = r.json()["id"]
print(f"✓ Session created: {sid}")

# Collect SSE events with timestamps
events = []
sse_connected = threading.Event()
sse_done = threading.Event()

def listen_sse():
    url = f"{BASE}/api/projects/{PROJECT_ID}/agent/sessions/{sid}/stream"
    try:
        r = sess.get(url, stream=True, timeout=120)
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                data = line[6:]
                ts = time.time()
                try:
                    event = json.loads(data)
                    events.append({"time": ts, "event": event})
                    etype = event.get("type", "?")
                    if etype == "status" and event.get("status") == "connected":
                        sse_connected.set()
                    elif etype == "text-delta":
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] TEXT: {repr(event.get('content','')[:60])}")
                    elif etype == "thinking":
                        done = event.get("done", False)
                        content = event.get("content", "")
                        label = "THINK-DONE" if done else "THINKING"
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] {label}: {repr(content[:60])}")
                    elif etype == "file-op":
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] FILE-OP: {event.get('action','')} {event.get('path','')} [{event.get('status','')}]")
                    elif etype == "todo":
                        items = event.get("items", [])
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] TODO: {len(items)} items")
                    elif etype == "complete":
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] COMPLETE")
                        sse_done.set()
                    elif etype == "error":
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] ERROR: {event.get('message','')}")
                        sse_done.set()
                    elif etype == "status":
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] STATUS: {event.get('status','')}")
                    else:
                        print(f"  [{time.strftime('%H:%M:%S', time.localtime(ts))}.{int(ts*1000)%1000:03d}] {etype}: {json.dumps(event)[:80]}")
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        print(f"SSE error: {e}")
    finally:
        sse_done.set()

# Start SSE listener
print("\n=== Starting SSE listener ===")
t = threading.Thread(target=listen_sse, daemon=True)
t.start()

# Wait for SSE to connect
if not sse_connected.wait(timeout=10):
    print("✗ SSE failed to connect within 10s")
    sys.exit(1)
print("✓ SSE connected\n")

# Send message
print("=== Sending 'hi' message ===")
send_time = time.time()
r = sess.post(
    f"{BASE}/api/projects/{PROJECT_ID}/agent/sessions/{sid}/messages",
    json={"content": "hi", "model": "opencode/minimax-m2.5-free"}
)
print(f"✓ Message sent: HTTP {r.status_code}")
if r.status_code != 201:
    print(f"  Response: {r.text[:300]}")

# Wait for completion
print("\n=== Streaming events (real-time) ===")
sse_done.wait(timeout=120)
end_time = time.time()

# Give a moment for any trailing events
time.sleep(2)

# Summary
print(f"\n{'='*60}")
print(f"=== STREAMING TEST RESULTS ===")
print(f"{'='*60}")

text_events = [e for e in events if e["event"].get("type") == "text-delta"]
thinking_events = [e for e in events if e["event"].get("type") == "thinking"]
fileop_events = [e for e in events if e["event"].get("type") == "file-op"]
todo_events = [e for e in events if e["event"].get("type") == "todo"]
status_events = [e for e in events if e["event"].get("type") == "status"]
complete_events = [e for e in events if e["event"].get("type") == "complete"]
error_events = [e for e in events if e["event"].get("type") == "error"]

print(f"Total SSE events: {len(events)}")
print(f"  Text-delta:  {len(text_events)}")
print(f"  Thinking:    {len(thinking_events)}")
print(f"  File-op:     {len(fileop_events)}")
print(f"  Todo:        {len(todo_events)}")
print(f"  Status:      {len(status_events)}")
print(f"  Complete:    {len(complete_events)}")
print(f"  Error:       {len(error_events)}")

if text_events:
    first_text = text_events[0]["time"]
    last_text = text_events[-1]["time"]
    full_text = "".join(e["event"].get("content", "") for e in text_events)
    print(f"\nTimeline:")
    print(f"  Message sent:        {time.strftime('%H:%M:%S', time.localtime(send_time))}.{int(send_time*1000)%1000:03d}")
    print(f"  First text-delta:    {time.strftime('%H:%M:%S', time.localtime(first_text))}.{int(first_text*1000)%1000:03d}")
    print(f"  Last text-delta:     {time.strftime('%H:%M:%S', time.localtime(last_text))}.{int(last_text*1000)%1000:03d}")
    print(f"  Time to first text:  {first_text - send_time:.3f}s")
    print(f"  Streaming duration:  {last_text - first_text:.3f}s")
    print(f"  Total time:          {end_time - send_time:.3f}s")
    print(f"  Full text ({len(full_text)} chars): {full_text[:300]}")

    if len(text_events) > 1:
        spread = last_text - first_text
        if spread > 0.5:
            print(f"\n✓✓✓ REAL-TIME STREAMING CONFIRMED! Text arrived over {spread:.1f}s in {len(text_events)} chunks ✓✓✓")
        else:
            print(f"\n⚠ Text arrived in {len(text_events)} chunks but in {spread:.3f}s (may be buffered)")
    else:
        print(f"\n⚠ Only 1 text-delta event")
else:
    print(f"\n✗ NO text-delta events received!")
    if error_events:
        for e in error_events:
            print(f"  Error: {e['event'].get('message','')}")
    print(f"  Total time: {end_time - send_time:.3f}s")

if thinking_events:
    print(f"✓ Thinking: {len(thinking_events)} events streamed")
if complete_events:
    print(f"✓ Complete event received")
