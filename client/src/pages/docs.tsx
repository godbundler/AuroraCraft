import { BookOpen, FileCode, Blocks, Terminal } from 'lucide-react'

const sections = [
  {
    icon: BookOpen,
    title: 'Getting Started',
    description: 'Learn the basics of AuroraCraft and create your first Minecraft plugin project.',
  },
  {
    icon: FileCode,
    title: 'Plugin Development',
    description: 'Understand how to use the AI agent to generate, modify, and optimize your plugin code.',
  },
  {
    icon: Blocks,
    title: 'Platform Guide',
    description: 'Supported Minecraft server software, Java versions, and build tools explained.',
  },
  {
    icon: Terminal,
    title: 'API Reference',
    description: 'Technical reference for advanced users and integrations.',
  },
]

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Documentation
        </h1>
        <p className="mt-4 text-text-muted">
          Everything you need to know about building plugins with AuroraCraft.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-bright hover:bg-surface-hover"
          >
            <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5">
              <section.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-text">{section.title}</h3>
            <p className="mt-2 text-sm text-text-muted">{section.description}</p>
            <p className="mt-4 text-xs text-text-dim">Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  )
}
