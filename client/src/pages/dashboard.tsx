import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search, Globe, Lock, MoreHorizontal } from 'lucide-react'

interface MockProject {
  id: string
  name: string
  software: string
  language: string
  isPublic: boolean
  updatedAt: string
}

const mockProjects: MockProject[] = [
  { id: '1', name: 'EconomyPlus', software: 'Paper', language: 'Java', isPublic: true, updatedAt: '2 hours ago' },
  { id: '2', name: 'CustomEnchants', software: 'Spigot', language: 'Kotlin', isPublic: false, updatedAt: '1 day ago' },
  { id: '3', name: 'WorldGuard-Lite', software: 'Paper', language: 'Java', isPublic: true, updatedAt: '3 days ago' },
  { id: '4', name: 'ChatFormatter', software: 'Paper', language: 'Java', isPublic: false, updatedAt: '1 week ago' },
]

type SortKey = 'name' | 'updatedAt'

export default function DashboardPage() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('updatedAt')

  const filtered = mockProjects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return 0 // Already sorted by updatedAt in mock data
    })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Projects</h1>
          <p className="mt-1 text-sm text-text-muted">Manage your Minecraft plugin projects</p>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="updatedAt">Last updated</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((project) => (
          <Link
            key={project.id}
            to={`/workspace/${project.id}`}
            className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-bright hover:bg-surface-hover"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-text group-hover:text-primary">
                  {project.name}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded bg-accent px-2 py-0.5 text-xs text-text-muted">
                    {project.software}
                  </span>
                  <span className="rounded bg-accent px-2 py-0.5 text-xs text-text-muted">
                    {project.language}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {project.isPublic ? (
                  <Globe className="h-4 w-4 text-text-dim" />
                ) : (
                  <Lock className="h-4 w-4 text-text-dim" />
                )}
                <button
                  onClick={(e) => e.preventDefault()}
                  className="rounded p-1 text-text-dim hover:bg-accent hover:text-text-muted"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-text-dim">Updated {project.updatedAt}</p>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-text-muted">No projects found</p>
          <Link
            to="/projects/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover"
          >
            <Plus className="h-4 w-4" />
            Create your first project
          </Link>
        </div>
      )}
    </div>
  )
}
