import { Globe, Lock } from 'lucide-react'

const mockProjects = [
  { id: '1', name: 'EconomyPlus', owner: 'craftmaster', isPublic: true, software: 'Paper', createdAt: '2026-02-15' },
  { id: '2', name: 'CustomEnchants', owner: 'enchanter', isPublic: false, software: 'Spigot', createdAt: '2026-02-20' },
  { id: '3', name: 'MobArena', owner: 'arenadev', isPublic: true, software: 'Paper', createdAt: '2026-03-01' },
  { id: '4', name: 'TeleportPlus', owner: 'tpmaster', isPublic: true, software: 'Paper', createdAt: '2026-03-05' },
]

export default function AdminProjectsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-text">Projects</h1>
      <p className="mt-1 text-sm text-text-muted">View and manage all projects on the platform</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left font-medium text-text-muted">Name</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Visibility</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Software</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Created</th>
            </tr>
          </thead>
          <tbody>
            {mockProjects.map((project) => (
              <tr key={project.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium text-text">{project.name}</td>
                <td className="px-4 py-3 text-text-muted">{project.owner}</td>
                <td className="px-4 py-3">
                  {project.isPublic ? (
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Globe className="h-3 w-3" /> Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Lock className="h-3 w-3" /> Private
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted">{project.software}</td>
                <td className="px-4 py-3 text-text-dim">{project.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
