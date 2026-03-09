import { Check } from 'lucide-react'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started with plugin development.',
    features: [
      'Up to 3 projects',
      'Basic AI assistance',
      'Community support',
      'Public projects only',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: 'per month',
    description: 'For serious developers who need more power.',
    features: [
      'Unlimited projects',
      'Advanced AI models',
      'Private projects',
      'Priority compilation',
      'Priority support',
      'GitHub integration',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$29',
    period: 'per month',
    description: 'For teams building plugins together.',
    features: [
      'Everything in Pro',
      'Team workspaces',
      'Shared projects',
      'Admin controls',
      'API access',
      'Custom AI models',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-text-muted">
          Choose the plan that fits your needs. Upgrade or downgrade at any time.
        </p>
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative rounded-xl border p-8 ${
              tier.highlighted
                ? 'border-primary bg-gradient-to-b from-primary/5 to-surface'
                : 'border-border bg-surface'
            }`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Most Popular
                </span>
              </div>
            )}
            <h3 className="text-lg font-semibold text-text">{tier.name}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-text">{tier.price}</span>
              <span className="text-sm text-text-dim">/{tier.period}</span>
            </div>
            <p className="mt-4 text-sm text-text-muted">{tier.description}</p>
            <button
              className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tier.highlighted
                  ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                  : 'border border-border bg-surface-hover text-text hover:bg-accent'
              }`}
            >
              {tier.cta}
            </button>
            <ul className="mt-8 space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-text-muted">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
