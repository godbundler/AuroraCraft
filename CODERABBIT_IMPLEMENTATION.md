# CodeRabbit Integration - Remaining Implementation

## ✅ Completed
1. Database schema (users + code_reviews tables)
2. CodeRabbit CLI installed (v0.4.4)
3. Backend API endpoints created
4. Routes registered in server

## 📝 Remaining Steps

### Step 4: Admin Panel UI (`client/src/pages/admin/users.tsx`)

Add CodeRabbit column and grant button:

```tsx
// Add state
const [grantModalOpen, setGrantModalOpen] = useState(false)
const [selectedUser, setSelectedUser] = useState<string | null>(null)
const [apiKey, setApiKey] = useState('')

// Add column in table header
<th className="px-4 py-3 text-left font-medium text-text-muted">CodeRabbit</th>

// Add column in table body
<td className="px-4 py-3">
  {user.coderabbitEnabled ? (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <CheckCircle2 className="h-3 w-3" />
      Enabled
    </span>
  ) : (
    <button
      onClick={() => {
        setSelectedUser(user.id)
        setGrantModalOpen(true)
      }}
      className="text-xs text-primary hover:underline"
    >
      Grant Access
    </button>
  )}
</td>

// Add modal at end
{grantModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">Grant CodeRabbit Access</h2>
      <p className="mt-2 text-sm text-text-muted">
        Enter your CodeRabbit API key to enable code reviews for this user.
      </p>
      <input
        type="text"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="cr-************"
        className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => {
            setGrantModalOpen(false)
            setApiKey('')
          }}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            await fetch(`/api/admin/users/${selectedUser}/coderabbit/grant`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ apiKey }),
            })
            setGrantModalOpen(false)
            setApiKey('')
            // Refresh users list
          }}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm text-white"
        >
          Grant Access
        </button>
      </div>
    </div>
  </div>
)}
```

### Step 5: Workspace Review Button (`client/src/pages/workspace.tsx`)

Add after GitHub buttons:

```tsx
// Add state
const [coderabbitEnabled, setCoderabbitEnabled] = useState(false)
const [reviewModalOpen, setReviewModalOpen] = useState(false)
const [reviewScope, setReviewScope] = useState<'full' | 'uncommitted' | 'recent'>('uncommitted')
const [reviewing, setReviewing] = useState(false)

// Check status on mount
useEffect(() => {
  fetch(`/api/projects/${projectId}/coderabbit/status`, { credentials: 'include' })
    .then(r => r.json())
    .then(data => setCoderabbitEnabled(data.enabled))
}, [projectId])

// Add button
{coderabbitEnabled && (
  <button
    onClick={() => setReviewModalOpen(true)}
    disabled={isAgentWorking}
    className="rounded-md border border-border p-1.5 text-text-dim hover:bg-surface-hover disabled:opacity-50"
    title="Review Code"
  >
    <Shield className="h-4 w-4" />
  </button>
)}

// Add modal
{reviewModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">Code Review</h2>
      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={reviewScope === 'full'}
            onChange={() => setReviewScope('full')}
          />
          <span className="text-sm">Full Codebase Review</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={reviewScope === 'uncommitted'}
            onChange={() => setReviewScope('uncommitted')}
          />
          <span className="text-sm">Unpushed Codes Review</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={reviewScope === 'recent'}
            onChange={() => setReviewScope('recent')}
          />
          <span className="text-sm">Recent AI Changes Review</span>
        </label>
      </div>
      <div className="mt-6 flex gap-3">
        <button onClick={() => setReviewModalOpen(false)} className="flex-1 rounded-lg border px-4 py-2">
          Cancel
        </button>
        <button
          onClick={async () => {
            setReviewing(true)
            // Lock UI here
            const res = await fetch(`/api/projects/${projectId}/coderabbit/review`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ scope: reviewScope }),
            })
            const data = await res.json()
            setReviewing(false)
            setReviewModalOpen(false)
            // Show results
          }}
          disabled={reviewing}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-white"
        >
          {reviewing ? 'Reviewing...' : 'Start Review'}
        </button>
      </div>
    </div>
  </div>
)}
```

### Step 6: Review History Panel

Create new component `ReviewHistory.tsx` and add to workspace sidebar.

### Step 7: Auto-Fix Modal

Show issues with checkboxes, send selected to AI chat.

## 🔑 Key Points
- Admin gets API key from https://app.coderabbit.ai/settings/api-keys
- Reviews run in background, can take minutes
- Lock UI during review (disable chat, editor, file tree)
- Parse JSON output from `--agent` flag
- Store results in `code_reviews` table
