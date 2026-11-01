import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'success' | 'warning'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
}

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-elevated)] text-[var(--muted)] border-[var(--border)]',
  accent: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30',
  success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
