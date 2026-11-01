import { Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 text-[var(--muted)]">
      <Loader2 size={22} className="animate-spin text-[var(--accent)]" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
