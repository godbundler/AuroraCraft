import { Users, FolderKanban, Cpu, Activity } from 'lucide-react'

const stats = [
  { label: 'Total Users', value: '1,234', icon: Users, change: '+12%' },
  { label: 'Active Projects', value: '567', icon: FolderKanban, change: '+8%' },
  { label: 'AI Runs Today', value: '2,891', icon: Cpu, change: '+23%' },
  { label: 'Uptime', value: '99.9%', icon: Activity, change: '' },
]

export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-text">Overview</h1>
      <p className="mt-1 text-sm text-text-muted">System status and key metrics</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-text-dim" />
            </div>
            <p className="mt-2 text-2xl font-bold text-text">{stat.value}</p>
            {stat.change && (
              <p className="mt-1 text-xs text-success">{stat.change} from last month</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text">Recent Activity</h2>
        <p className="mt-2 text-sm text-text-dim">Activity feed will be displayed here.</p>
      </div>
    </div>
  )
}
