export default function AdminAIRuntimePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-text">AI Runtime</h1>
      <p className="mt-1 text-sm text-text-muted">Configure AI model settings and runtime parameters</p>

      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-text">Model Configuration</h2>
          <p className="mt-1 text-sm text-text-dim">Select and configure the AI models used for code generation.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Default Model</label>
              <select
                disabled
                className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-muted opacity-50"
              >
                <option>Claude Sonnet 4</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Max Tokens</label>
              <input
                disabled
                type="number"
                value="4096"
                className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-muted opacity-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Temperature</label>
              <input
                disabled
                type="number"
                value="0.7"
                step="0.1"
                className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-muted opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-text">Runtime Status</h2>
          <p className="mt-1 text-sm text-text-dim">Current status of the AI runtime engine.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-sm text-text-muted">Not configured</span>
          </div>
        </div>
      </div>
    </div>
  )
}
