import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Terminal } from 'lucide-react'
import { useAdminUsers } from '@/hooks/use-admin'
import { api } from '@/lib/api'
import type { KiroAuthStatus } from '@/types'

function KiroAuthButton({ userId }: { userId: string }) {
  const [status, setStatus] = useState<KiroAuthStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const checkStatus = async () => {
    setLoading(true)
    try {
      const result = await api.get<KiroAuthStatus>(`/admin/kiro/status/${userId}`)
      setStatus(result)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-text-dim" />
  }

  if (status) {
    return (
      <div className="flex items-center gap-1.5">
        {status.authenticated ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" />
            Kiro Auth
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-warning">
            <XCircle className="h-3 w-3" />
            No Kiro
          </span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={checkStatus}
      className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-primary/10 hover:text-primary"
    >
      <Terminal className="h-3 w-3" />
      Check Kiro
    </button>
  )
}

export default function AdminUsersPage() {
  const { users, isLoading } = useAdminUsers()

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-text">Users</h1>
      <p className="mt-1 text-sm text-text-muted">Manage user accounts and roles</p>

      {isLoading ? (
        <div className="mt-6 flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-dim" />
        </div>
      ) : users.length === 0 ? (
        <div className="mt-6 text-center py-12">
          <p className="text-sm text-text-dim">No users found</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-3 text-left font-medium text-text-muted">Username</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Email</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Role</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
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
                  <td className="px-4 py-3 text-text-dim">
                    {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <KiroAuthButton userId={user.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
