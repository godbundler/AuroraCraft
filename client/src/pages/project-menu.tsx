import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft,
  LayoutDashboard,
  BarChart3,
  Settings,
  Loader2,
  Save,
  MessageSquare,
  Bot,
  FileCode,
  Zap,
  Calendar,
  Globe,
  Lock,
  Trash2,
  Blocks,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useProject, useProjectStats } from '@/hooks/use-projects'
import type { UpdateProjectInput } from '@/types'

type TabId = 'overview' | 'stats' | 'settings'

const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const softwareOptions = [
  { value: 'paper', label: 'Paper' },
  { value: 'spigot', label: 'Spigot' },
  { value: 'bukkit', label: 'Bukkit' },
  { value: 'velocity', label: 'Velocity' },
  { value: 'bungeecord', label: 'BungeeCord' },
]

const javaVersions = ['21', '17', '11', '8']

interface OverviewForm {
  name: string
  description: string
  software: string
  language: 'java' | 'kotlin'
  javaVersion: string
  compiler: 'maven' | 'gradle'
}

export default function ProjectMenuPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { project, isLoading, updateProject, isUpdating, deleteProject, isDeleting } = useProject(projectId ?? '')
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-text-muted">Project not found</p>
        <Link to="/dashboard" className="text-sm font-medium text-primary hover:text-primary-hover">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/workspace/${projectId}`}
            className="flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Link>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Blocks className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-text">{project.name}</span>
          </div>
        </div>
        <Link
          to={`/workspace/${projectId}`}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Open Workspace
          <ExternalLink className="h-3 w-3" />
        </Link>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-surface">
          <nav className="flex flex-col gap-1 p-3">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-text-dim">
              Project Menu
            </p>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {activeTab === 'overview' && (
              <OverviewTab
                project={project}
                updateProject={updateProject}
                isUpdating={isUpdating}
              />
            )}
            {activeTab === 'stats' && (
              <StatsTab projectId={projectId ?? ''} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                project={project}
                updateProject={updateProject}
                isUpdating={isUpdating}
                deleteProject={deleteProject}
                isDeleting={isDeleting}
                onDeleted={() => navigate('/dashboard')}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Overview Tab ────────────────────────────────────────────────────

function OverviewTab({
  project,
  updateProject,
  isUpdating,
}: {
  project: NonNullable<ReturnType<typeof useProject>['project']>
  updateProject: (data: UpdateProjectInput) => Promise<unknown>
  isUpdating: boolean
}) {
  const [form, setForm] = useState<OverviewForm>({
    name: project.name,
    description: project.description ?? '',
    software: project.software,
    language: project.language,
    javaVersion: project.javaVersion,
    compiler: project.compiler,
  })

  const [errors, setErrors] = useState<Partial<Record<keyof OverviewForm, string>>>({})

  useEffect(() => {
    setForm({
      name: project.name,
      description: project.description ?? '',
      software: project.software,
      language: project.language,
      javaVersion: project.javaVersion,
      compiler: project.compiler,
    })
  }, [project])

  const isFormValid = form.name.trim().length >= 2 && form.name.trim().length <= 128 && form.description.length <= 1000

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof OverviewForm, string>> = {}
    if (form.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters'
    if (form.name.trim().length > 128) newErrors.name = 'Name must be 128 characters or fewer'
    if (form.description.length > 1000) newErrors.description = 'Description must be 1000 characters or fewer'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const hasChanges =
    form.name !== project.name ||
    form.description !== (project.description ?? '') ||
    form.software !== project.software ||
    form.language !== project.language ||
    form.javaVersion !== project.javaVersion ||
    form.compiler !== project.compiler

  const handleSave = async () => {
    if (!validate()) return
    try {
      await updateProject({
        name: form.name.trim(),
        description: form.description.trim() || null,
        software: form.software,
        language: form.language,
        javaVersion: form.javaVersion,
        compiler: form.compiler,
      })
      toast.success('Project updated successfully')
    } catch {
      toast.error('Failed to update project')
    }
  }

  const updateField = <K extends keyof OverviewForm>(key: K, value: OverviewForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text">Overview</h1>
          <p className="mt-1 text-sm text-text-muted">View and edit your project configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || !isFormValid || isUpdating}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            hasChanges && isFormValid
              ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
              : 'bg-surface text-text-dim cursor-not-allowed'
          )}
        >
          <Save className="h-4 w-4" />
          {isUpdating ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="mt-8 space-y-6">
        {/* Project Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">Project Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            className={cn(
              'w-full rounded-lg border bg-background px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1',
              errors.name
                ? 'border-destructive focus:border-destructive focus:ring-destructive'
                : 'border-border focus:border-primary focus:ring-primary'
            )}
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            className={cn(
              'w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1',
              errors.description
                ? 'border-destructive focus:border-destructive focus:ring-destructive'
                : 'border-border focus:border-primary focus:ring-primary'
            )}
            placeholder="A short description of your project..."
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            <p className="ml-auto text-xs text-text-dim">{form.description.length}/1000</p>
          </div>
        </div>

        {/* Project Type (read-only) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">Project Type</label>
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-sm font-medium text-text">Minecraft Plugin</p>
            <p className="text-xs text-text-dim">Server-side plugin for Minecraft Java Edition</p>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Software */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Server Software</label>
            <select
              value={form.software}
              onChange={(e) => updateField('software', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {softwareOptions.map((sw) => (
                <option key={sw.value} value={sw.value}>{sw.label}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Language</label>
            <div className="flex gap-2">
              {(['java', 'kotlin'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => updateField('language', lang)}
                  className={cn(
                    'flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    form.language === lang
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-text-muted hover:border-border-bright hover:bg-surface-hover'
                  )}
                >
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Java Version */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Java Version</label>
            <select
              value={form.javaVersion}
              onChange={(e) => updateField('javaVersion', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {javaVersions.map((v) => (
                <option key={v} value={v}>Java {v}</option>
              ))}
            </select>
          </div>

          {/* Compiler */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Build Tool</label>
            <div className="flex gap-2">
              {(['gradle', 'maven'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => updateField('compiler', c)}
                  className={cn(
                    'flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    form.compiler === c
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-text-muted hover:border-border-bright hover:bg-surface-hover'
                  )}
                >
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stats Tab ───────────────────────────────────────────────────────

function StatsTab({ projectId }: { projectId: string }) {
  const { stats, isLoading } = useProjectStats(projectId)

  if (isLoading) {
    return (
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text">Stats</h1>
        <p className="mt-1 text-sm text-text-muted">Project activity and usage statistics</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-5">
              <div className="h-4 w-24 rounded bg-border" />
              <div className="mt-3 h-8 w-16 rounded bg-border" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'User Messages', value: stats?.userMessages ?? 0, icon: MessageSquare, color: 'text-primary' },
    { label: 'AI Messages', value: stats?.aiMessages ?? 0, icon: Bot, color: 'text-emerald-400' },
    { label: 'File Actions', value: stats?.fileActions ?? 0, icon: FileCode, color: 'text-amber-400' },
    { label: 'Tokens Used', value: stats?.tokensUsed ?? 0, icon: Zap, color: 'text-violet-400', placeholder: true },
    {
      label: 'Created',
      value: stats?.createdAt
        ? new Date(stats.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—',
      icon: Calendar,
      color: 'text-text-dim',
      isDate: true,
    },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight text-text">Stats</h1>
      <p className="mt-1 text-sm text-text-muted">Project activity and usage statistics</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-bright"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">{card.label}</p>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
            {card.isDate ? (
              <p className="mt-2 text-lg font-semibold text-text">{card.value}</p>
            ) : (
              <div className="mt-2 flex items-baseline gap-1">
                <p className="text-2xl font-bold text-text">{card.value.toLocaleString()}</p>
                {card.placeholder && (
                  <span className="text-xs text-text-dim">(placeholder)</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Settings Tab ────────────────────────────────────────────────────

function SettingsTab({
  project,
  updateProject,
  isUpdating,
  deleteProject,
  isDeleting,
  onDeleted,
}: {
  project: NonNullable<ReturnType<typeof useProject>['project']>
  updateProject: (data: UpdateProjectInput) => Promise<unknown>
  isUpdating: boolean
  deleteProject: () => Promise<unknown>
  isDeleting: boolean
  onDeleted: () => void
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const toggleVisibility = async () => {
    const newVisibility = project.visibility === 'public' ? 'private' : 'public'
    try {
      await updateProject({ visibility: newVisibility })
      toast.success(`Project is now ${newVisibility}`)
    } catch {
      toast.error('Failed to update visibility')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteProject()
      toast.success('Project deleted')
      onDeleted()
    } catch {
      toast.error('Failed to delete project')
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight text-text">Settings</h1>
      <p className="mt-1 text-sm text-text-muted">Manage project visibility and other settings</p>

      {/* Visibility */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-text">Visibility</h2>
        <p className="mt-1 text-xs text-text-muted">
          Control who can see your project. Public projects are visible to all users.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {project.visibility === 'public' ? (
              <Globe className="h-5 w-5 text-primary" />
            ) : (
              <Lock className="h-5 w-5 text-text-dim" />
            )}
            <div>
              <p className="text-sm font-medium text-text">
                {project.visibility === 'public' ? 'Public' : 'Private'}
              </p>
              <p className="text-xs text-text-dim">
                {project.visibility === 'public'
                  ? 'Anyone can view this project'
                  : 'Only you can access this project'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleVisibility}
            disabled={isUpdating}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
              project.visibility === 'public' ? 'bg-primary' : 'bg-border-bright'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                project.visibility === 'public' ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
        <p className="mt-1 text-xs text-text-muted">
          Irreversible actions that permanently affect your project.
        </p>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-destructive/20 bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text">Delete this project</p>
            <p className="text-xs text-text-dim">
              Once deleted, this project and all its data cannot be recovered.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="shrink-0 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            Delete Project
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-text">Delete project?</h3>
            </div>
            <p className="mt-3 text-sm text-text-muted">
              This will permanently delete{' '}
              <span className="font-medium text-text">{project.name}</span> and all associated
              data, including files, chat history, and sessions. This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors',
                  isDeleting ? 'bg-destructive/70' : 'bg-destructive hover:bg-destructive/90'
                )}
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
