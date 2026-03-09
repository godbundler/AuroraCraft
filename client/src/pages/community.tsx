import { Search, Globe, User } from 'lucide-react'
import { useState } from 'react'

const mockCommunityProjects = [
  { id: '1', name: 'EconomyPlus', author: 'craftmaster', description: 'Advanced economy system with shops, banks, and trading', software: 'Paper', language: 'Java', stars: 42 },
  { id: '2', name: 'MobArena', author: 'arenadev', description: 'Customizable mob arena with waves, rewards, and leaderboards', software: 'Spigot', language: 'Java', stars: 38 },
  { id: '3', name: 'TeleportPlus', author: 'tpmaster', description: 'Enhanced teleportation with homes, warps, and TPA requests', software: 'Paper', language: 'Kotlin', stars: 25 },
  { id: '4', name: 'ChatFormatter', author: 'chatdev', description: 'Beautiful chat formatting with prefixes, colors, and hover events', software: 'Paper', language: 'Java', stars: 19 },
  { id: '5', name: 'WorldProtect', author: 'guardian', description: 'Region protection with flags, permissions, and rollback', software: 'Paper', language: 'Java', stars: 56 },
  { id: '6', name: 'CustomEnchants', author: 'enchanter', description: 'Create custom enchantments with unique effects and particles', software: 'Spigot', language: 'Kotlin', stars: 31 },
]

export default function CommunityPage() {
  const [search, setSearch] = useState('')

  const filtered = mockCommunityProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Community Creations
        </h1>
        <p className="mt-4 text-text-muted">
          Discover plugins built by the AuroraCraft community
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search community projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((project) => (
          <div
            key={project.id}
            className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-bright hover:bg-surface-hover"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-text group-hover:text-primary">
                {project.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-text-dim">
                <Globe className="h-3 w-3" />
                Public
              </div>
            </div>
            <p className="mt-2 text-sm text-text-muted line-clamp-2">
              {project.description}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded bg-accent px-2 py-0.5 text-xs text-text-muted">
                {project.software}
              </span>
              <span className="rounded bg-accent px-2 py-0.5 text-xs text-text-muted">
                {project.language}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-text-dim">
              <User className="h-3 w-3" />
              {project.author}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
