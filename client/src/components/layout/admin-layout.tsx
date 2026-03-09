import { Link, Outlet, useLocation } from 'react-router'
import { Navbar } from './navbar'
import { LayoutDashboard, Users, Cpu, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'

const sidebarItems = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'AI Runtime', href: '/admin/ai-runtime', icon: Cpu },
  { label: 'Projects', href: '/admin/projects', icon: FolderKanban },
]

export function AdminLayout() {
  const location = useLocation()

  return (
    <>
      <Navbar />
      <div className="flex flex-1">
        <aside className="w-60 border-r border-border bg-surface">
          <nav className="flex flex-col gap-1 p-3">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-text-dim">
              Admin Panel
            </p>
            {sidebarItems.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </>
  )
}
