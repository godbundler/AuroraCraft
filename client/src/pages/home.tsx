import { Link } from 'react-router'
import { Blocks, Sparkles, Shield, Zap, Code2, Globe, ArrowRight } from 'lucide-react'

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Development',
    description: 'Describe your plugin idea and let AI generate production-ready code with best practices built in.',
  },
  {
    icon: Code2,
    title: 'Intelligent Code Editor',
    description: 'Full-featured Monaco editor with AI-assisted completions, refactoring, and real-time error detection.',
  },
  {
    icon: Zap,
    title: 'Instant Compilation',
    description: 'One-click compilation with automatic dependency resolution. Test your plugin in seconds.',
  },
  {
    icon: Shield,
    title: 'Isolated Workspaces',
    description: 'Each project runs in its own secure environment with dedicated resources and file isolation.',
  },
  {
    icon: Globe,
    title: 'Community Sharing',
    description: 'Share your plugins with the community. Browse, fork, and collaborate on public projects.',
  },
  {
    icon: Blocks,
    title: 'Multi-Platform Support',
    description: 'Build for Paper, Spigot, Bukkit, and more. Support for Java and Kotlin with Maven or Gradle.',
  },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-text-muted">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-Powered Minecraft Plugin Development
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl lg:text-6xl">
              Build Minecraft Plugins{' '}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                with AI
              </span>
            </h1>
            <p className="mt-6 text-lg text-text-muted sm:text-xl">
              AuroraCraft is the modern platform for creating Minecraft plugins.
              Describe your idea, and our AI agent builds, tests, and compiles it for you.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Start Building
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-6 py-3 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text">
              Everything you need to build plugins
            </h2>
            <p className="mt-4 text-text-muted">
              From idea to compiled JAR, AuroraCraft handles the entire development workflow.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-bright hover:bg-surface-hover"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-text">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-hover p-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text">
              Ready to build your first plugin?
            </h2>
            <p className="mt-4 text-text-muted">
              Join developers who are building Minecraft plugins faster with AI.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Create Your Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
