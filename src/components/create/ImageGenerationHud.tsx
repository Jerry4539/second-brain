import { useEffect, useState } from 'react'

interface ImageGenerationHudProps {
  isInline?: boolean
}

const GRID_SIZE = 17

export function ImageGenerationHud({ isInline = false }: ImageGenerationHudProps) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [phase, setPhase] = useState(0)

  // Smooth wave phase + simulated progress timer
  useEffect(() => {
    const start = performance.now()
    const interval = setInterval(() => {
      const now = performance.now()
      setElapsedMs(now - start)
      setPhase((p) => p + 0.16)
    }, 60)
    return () => clearInterval(interval)
  }, [])

  const seconds = elapsedMs / 1000
  const progressPct = Math.min(96, Math.max(1, Math.round((1 - Math.exp(-seconds / 10)) * 98)))

  const statusLabel =
    seconds < 4
      ? 'Synthesizing prompt latent'
      : seconds < 12
        ? 'Diffusion denoising steps'
        : 'Refining micro-details'

  return (
    <div
      className={`select-none ${
        isInline ? 'w-full max-w-[320px]' : 'mx-auto w-full max-w-[360px]'
      }`}
    >
      {/* Minimal Top Status Label */}
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <span className="text-[13px] font-medium tracking-tight text-[var(--text)]/90">
          {statusLabel}
        </span>
        <span className="text-[11px] font-mono text-[var(--muted)]">
          {seconds.toFixed(1)}s
        </span>
      </div>

      {/* Sleek Dot-Matrix Generative Shimmer Canvas */}
      <div
        className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--surface-elevated)]/25 p-3 transition-colors hover:bg-[var(--surface-elevated)]/40"
      >
        <div
          className="h-full w-full"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
            const x = idx % GRID_SIZE
            const y = Math.floor(idx / GRID_SIZE)

            // Ambient Wave Shimmer Mode
            const distFromWave = Math.sin(x * 0.38 + y * 0.32 - phase)
            const glow = Math.max(0, distFromWave)
            const isLit = glow > 0.35

            return (
              <div key={idx} className="flex items-center justify-center">
                <span
                  className="rounded-full transition-colors duration-150"
                  style={{
                    width: isLit ? '3.5px' : '2.5px',
                    height: isLit ? '3.5px' : '2.5px',
                    backgroundColor: isLit ? 'var(--accent)' : 'currentColor',
                    opacity: isLit ? 0.25 + glow * 0.7 : 0.14,
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Minimal Progress Pill in Bottom-Right */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-[var(--surface-elevated)]/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--accent)] shadow-xs backdrop-blur-md">
          {progressPct}%
        </div>
      </div>
    </div>
  )
}
