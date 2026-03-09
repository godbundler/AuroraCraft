const mockUsers = [
  { id: '1', username: 'admin', email: 'admin@auroracraft.dev', role: 'admin', createdAt: '2026-01-01' },
  { id: '2', username: 'craftmaster', email: 'craft@example.com', role: 'user', createdAt: '2026-02-15' },
  { id: '3', username: 'plugindev', email: 'dev@example.com', role: 'user', createdAt: '2026-02-20' },
  { id: '4', username: 'builderx', email: 'builder@example.com', role: 'user', createdAt: '2026-03-01' },
]

export default function AdminUsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-text">Users</h1>
      <p className="mt-1 text-sm text-text-muted">Manage user accounts and roles</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left font-medium text-text-muted">Username</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Email</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Role</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Joined</th>
            </tr>
          </thead>
          <tbody>
            {mockUsers.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium text-text">{user.username}</td>
                <td className="px-4 py-3 text-text-muted">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                    user.role === 'admin'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-accent text-text-muted'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-dim">{user.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
