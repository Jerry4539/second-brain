import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface ImageGenerationHudProps {
  isInline?: boolean
}

export function ImageGenerationHud({ isInline = false }: ImageGenerationHudProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Creative developing stages based on elapsed time without fake percentage jumps
  const getStageText = (seconds: number) => {
    if (seconds < 6) return 'Warming latent canvas…'
    if (seconds < 25) return 'Synthesizing diffusion details…'
    if (seconds < 60) return 'Refining lighting & texture…'
    return 'Finalizing image render…'
  }

  return (
    <div
      className={`relative mx-auto flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-card)] transition-all ${
        isInline
          ? 'aspect-square w-full max-w-[340px] p-5'
          : 'aspect-square w-full max-w-[480px] max-h-[480px] p-8'
      }`}
    >
      {/* Ethereal darkroom ambient glow that pulses gently */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 animate-pulse-glow"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, var(--accent) 0%, transparent 68%)',
        }}
      />

      {/* Subtle sweeping light shimmer across the canvas */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--accent)]/5 to-transparent opacity-60" />

      {/* Top indicator: minimalist status pill */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/80 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-[var(--muted)] shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span>{getStageText(elapsed)}</span>
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Center: Delicate creative insignia */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--border)]/80 bg-[var(--surface)]/90 text-[var(--accent)] shadow-xl backdrop-blur-md transition-transform duration-500">
          <Sparkles size={28} className="animate-pulse" />
          {/* Subtle spinning dashed aura */}
          <div className="absolute -inset-2 rounded-[28px] border border-dashed border-[var(--accent)]/30 animate-spin-slow pointer-events-none" />
        </div>
        <p className="mt-4 text-xs font-medium text-[var(--text)] tracking-wide">
          Developing artwork
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          Iterative diffusion on local CPU
        </p>
      </div>

      {/* Bottom: Smooth, continuous indeterminate progress hairline */}
      <div className="relative z-10 w-full pt-4">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-[var(--border)]/50">
          <div className="absolute top-0 bottom-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent animate-shimmer-slide" />
        </div>
      </div>
    </div>
  )
}
