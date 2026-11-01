import type { ComponentType, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ComponentType<{ size?: number | string; className?: string }>
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-elevated)] text-[var(--muted)]">
        <Icon size={22} />
      </div>
      <h2 className="text-base font-medium text-[var(--text)]">{title}</h2>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
