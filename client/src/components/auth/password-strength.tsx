import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface PasswordStrengthProps {
  password: string
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' }

    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-destructive' }
    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-warning' }
    if (score <= 3) return { score: 3, label: 'Good', color: 'bg-primary' }
    return { score: 4, label: 'Strong', color: 'bg-success' }
  }, [password])

  if (!password) return null

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              level <= strength.score ? strength.color : 'bg-border'
            )}
          />
        ))}
      </div>
      <p className="text-xs text-text-dim">{strength.label}</p>
    </div>
  )
}
