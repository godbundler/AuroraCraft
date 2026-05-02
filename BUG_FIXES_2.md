# Bug Fixes - Session 2

## Bug 2: Large Gaps Between Badges ✅ FIXED

### Problem
Large empty blank spaces appeared between badges while the agent was running. Gaps would shrink to normal only after session completion.

### Root Cause
The streaming text items had `min-h-[1.5rem]` class, creating minimum height even for empty or very short text content.

### Fix
Removed `min-h-[1.5rem]` from streaming text items in `StreamingMessage` component.

**File Changed:**
- `client/src/pages/workspace.tsx` (line 432)

**Before:**
```tsx
<div key={item.id} className="min-h-[1.5rem]">
  <MarkdownContent content={item.content || ''} />
</div>
```

**After:**
```tsx
<div key={item.id}>
  <MarkdownContent content={item.content || ''} />
</div>
```

### Result
Consistent spacing between badges during and after agent execution.

---

## Bug 1: Badges & Streaming Stop on Version Update ⚠️ IN PROGRESS

### Problem
When user asks to update a version, the agent stops showing:
- Thinking badges
- File operation badges
- Live streaming text

### Investigation
Found that OpenCode's SSE event stream (`/event` endpoint) keeps disconnecting:
```
[OpenCode] SSE stream disconnected, reconnecting in 2s...
```

This causes the backend to lose connection to OpenCode's event stream, preventing real-time updates from being forwarded to the frontend.

### Root Cause
OpenCode's `/event` endpoint is not responding or requires different connection parameters. The SSE connection fails immediately after connecting.

### Potential Solutions
1. Check OpenCode version and API compatibility
2. Verify OpenCode authentication requirements
3. Check if OpenCode needs to be started differently
4. Investigate alternative event streaming methods

### Status
**Needs further investigation** - OpenCode event streaming infrastructure needs to be debugged.

---

## Summary

| Bug | Status | Fix |
|-----|--------|-----|
| Bug 2: Large Gaps | ✅ Fixed | Removed min-height from text items |
| Bug 1: Streaming Stops | ⚠️ In Progress | OpenCode SSE connection failing |

### Next Steps for Bug 1
1. Test OpenCode `/event` endpoint directly
2. Check OpenCode logs for errors
3. Verify OpenCode version compatibility
4. Consider alternative event streaming approach
