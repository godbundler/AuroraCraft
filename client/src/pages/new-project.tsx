import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = ['Project Info', 'Platform', 'Build Config', 'Source']

const softwareOptions = [
  { value: 'paper', label: 'Paper', description: 'High performance Minecraft fork' },
  { value: 'spigot', label: 'Spigot', description: 'Popular Bukkit fork' },
  { value: 'bukkit', label: 'Bukkit', description: 'Original modding API' },
  { value: 'velocity', label: 'Velocity', description: 'Modern proxy server' },
  { value: 'bungeecord', label: 'BungeeCord', description: 'Legacy proxy server' },
]

const javaVersions = ['21', '17', '11', '8']
const compilers = [
  { value: 'gradle', label: 'Gradle', description: 'Modern build tool (recommended)' },
  { value: 'maven', label: 'Maven', description: 'Traditional build tool' },
]

export default function NewProjectPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    software: 'paper',
    language: 'java' as 'java' | 'kotlin',
    javaVersion: '21',
    compiler: 'gradle',
    source: 'blank' as 'blank' | 'zip' | 'github',
  })

  const canProceed = () => {
    switch (step) {
      case 0: return form.name.trim().length >= 2
      case 1: return !!form.software
      case 2: return !!form.compiler && !!form.javaVersion
      case 3: return !!form.source
      default: return false
    }
  }

  const handleCreate = () => {
    // In a real app, this would POST to the API
    navigate('/dashboard')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 inline-flex items-center gap-2 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </button>

      <h1 className="text-2xl font-bold tracking-tight text-text">Create New Project</h1>
      <p className="mt-1 text-sm text-text-muted">Set up your Minecraft plugin project</p>

      {/* Step indicators */}
      <div className="mt-8 flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                    ? 'border-2 border-primary text-primary'
                    : 'border border-border text-text-dim'
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn(
              'hidden text-xs sm:block',
              i === step ? 'text-text' : 'text-text-dim'
            )}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={cn(
                'h-px flex-1',
                i < step ? 'bg-primary' : 'bg-border'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Project Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="MyAwesomePlugin"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Project Type</label>
              <div className="rounded-lg border border-primary bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-text">Minecraft Plugin</p>
                <p className="text-xs text-text-muted">Server-side plugin for Minecraft Java Edition</p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-3 block text-sm font-medium text-text">Server Software</label>
              <div className="space-y-2">
                {softwareOptions.map((sw) => (
                  <button
                    key={sw.value}
                    onClick={() => setForm({ ...form, software: sw.value })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                      form.software === sw.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border-bright hover:bg-surface-hover'
                    )}
                  >
                    <div className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      form.software === sw.value
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    )}>
                      {form.software === sw.value && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">{sw.label}</p>
                      <p className="text-xs text-text-muted">{sw.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-medium text-text">Language</label>
              <div className="flex gap-3">
                {(['java', 'kotlin'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setForm({ ...form, language: lang })}
                    className={cn(
                      'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                      form.language === lang
                        ? 'border-primary bg-primary/5 text-text'
                        : 'border-border text-text-muted hover:border-border-bright'
                    )}
                  >
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Java Version</label>
              <select
                value={form.javaVersion}
                onChange={(e) => setForm({ ...form, javaVersion: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {javaVersions.map((v) => (
                  <option key={v} value={v}>Java {v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-text">Build Tool</label>
              <div className="space-y-2">
                {compilers.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, compiler: c.value })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                      form.compiler === c.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border-bright hover:bg-surface-hover'
                    )}
                  >
                    <div className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      form.compiler === c.value
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    )}>
                      {form.compiler === c.value && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">{c.label}</p>
                      <p className="text-xs text-text-muted">{c.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="mb-3 block text-sm font-medium text-text">Project Source</label>
            <div className="space-y-2">
              {[
                { value: 'blank' as const, label: 'Blank Project', description: 'Start from scratch with a clean template' },
                { value: 'zip' as const, label: 'Upload ZIP', description: 'Import from a ZIP archive (coming soon)' },
                { value: 'github' as const, label: 'GitHub Repository', description: 'Clone from a GitHub repo (coming soon)' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => opt.value === 'blank' && setForm({ ...form, source: opt.value })}
                  disabled={opt.value !== 'blank'}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                    form.source === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border-bright hover:bg-surface-hover',
                    opt.value !== 'blank' && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    form.source === opt.value
                      ? 'border-primary bg-primary'
                      : 'border-border'
                  )}>
                    {form.source === opt.value && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{opt.label}</p>
                    <p className="text-xs text-text-muted">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-surface disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={!canProceed()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Create Project
          </button>
        )}
      </div>
    </div>
  )
}
