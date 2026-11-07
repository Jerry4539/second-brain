import { useCallback, useEffect, useRef, useState } from 'react'

interface ImageGenerationHudProps {
  isInline?: boolean
}

type Point = { x: number; y: number }
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

const GRID_SIZE = 17
const TICK_MS = 125

function randomFood(snake: Point[]): Point {
  while (true) {
    const pt = {
      x: 1 + Math.floor(Math.random() * (GRID_SIZE - 2)),
      y: 1 + Math.floor(Math.random() * (GRID_SIZE - 2)),
    }
    if (!snake.some((s) => s.x === pt.x && s.y === pt.y)) {
      return pt
    }
  }
}

export function ImageGenerationHud({ isInline = false }: ImageGenerationHudProps) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Minimalist Dot-Matrix Snake state
  const [snake, setSnake] = useState<Point[]>([
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 },
  ])
  const [food, setFood] = useState<Point>({ x: 11, y: 5 })
  const [score, setScore] = useState(0)

  const dirRef = useRef<Direction>('RIGHT')
  const nextDirRef = useRef<Direction>('RIGHT')
  const gridRef = useRef<HTMLDivElement>(null)

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

  const resetGame = useCallback(() => {
    const initial = [
      { x: 5, y: 8 },
      { x: 4, y: 8 },
      { x: 3, y: 8 },
      { x: 2, y: 8 },
    ]
    setSnake(initial)
    setFood(randomFood(initial))
    dirRef.current = 'RIGHT'
    nextDirRef.current = 'RIGHT'
    setScore(0)
  }, [])

  const changeDirection = useCallback((desired: Direction) => {
    const current = dirRef.current
    if (desired === 'UP' && current !== 'DOWN') nextDirRef.current = 'UP'
    if (desired === 'DOWN' && current !== 'UP') nextDirRef.current = 'DOWN'
    if (desired === 'LEFT' && current !== 'RIGHT') nextDirRef.current = 'LEFT'
    if (desired === 'RIGHT' && current !== 'LEFT') nextDirRef.current = 'RIGHT'
  }, [])

  // Keyboard controls (Arrows / WASD / Escape)
  useEffect(() => {
    if (!playing) return

    function handleKeyDown(e: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          changeDirection('UP')
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          changeDirection('DOWN')
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          changeDirection('LEFT')
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          changeDirection('RIGHT')
          break
        case 'Escape':
          setPlaying(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playing, changeDirection])

  // Seamless Dot-Matrix Game Loop (auto-resets gently on self-collision, zero modal clutter)
  useEffect(() => {
    if (!playing) return

    const interval = setInterval(() => {
      setSnake((prev) => {
        const dir = nextDirRef.current
        dirRef.current = dir
        const head = prev[0]
        const nextHead = {
          x:
            dir === 'LEFT'
              ? (head.x - 1 + GRID_SIZE) % GRID_SIZE
              : dir === 'RIGHT'
                ? (head.x + 1) % GRID_SIZE
                : head.x,
          y:
            dir === 'UP'
              ? (head.y - 1 + GRID_SIZE) % GRID_SIZE
              : dir === 'DOWN'
                ? (head.y + 1) % GRID_SIZE
                : head.y,
        }

        // Self-collision gently resets tail
        if (prev.some((seg) => seg.x === nextHead.x && seg.y === nextHead.y)) {
          const initial = [
            { x: 5, y: 8 },
            { x: 4, y: 8 },
            { x: 3, y: 8 },
            { x: 2, y: 8 },
          ]
          dirRef.current = 'RIGHT'
          nextDirRef.current = 'RIGHT'
          setScore(0)
          return initial
        }

        const ateFood = nextHead.x === food.x && nextHead.y === food.y
        const nextSnake = ateFood ? [nextHead, ...prev] : [nextHead, ...prev.slice(0, -1)]

        if (ateFood) {
          setScore((s) => s + 1)
          setFood(randomFood(nextSnake))
        }

        return nextSnake
      })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [playing, food])

  // Tap / Click anywhere on the grid to start playing OR steer toward the tapped point
  function handleGridTap(e: React.MouseEvent<HTMLDivElement>) {
    if (!playing) {
      setPlaying(true)
      resetGame()
      return
    }

    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    const clickX = ((e.clientX - rect.left) / rect.width) * GRID_SIZE
    const clickY = ((e.clientY - rect.top) / rect.height) * GRID_SIZE
    const head = snake[0]
    const dx = clickX - (head.x + 0.5)
    const dy = clickY - (head.y + 0.5)

    const current = dirRef.current
    // If moving horizontally, a tap steers vertically (or turns if tapped strongly on the opposite axis)
    if (current === 'LEFT' || current === 'RIGHT') {
      if (Math.abs(dy) > 0.35) {
        changeDirection(dy < 0 ? 'UP' : 'DOWN')
      }
    } else {
      if (Math.abs(dx) > 0.35) {
        changeDirection(dx < 0 ? 'LEFT' : 'RIGHT')
      }
    }
  }

  // Smooth asymptotic progress percentage (1% -> 96%)
  const seconds = elapsedMs / 1000
  const progressPct = Math.min(96, Math.max(1, Math.round((1 - Math.exp(-seconds / 10)) * 98)))

  const statusLabel = playing
    ? 'Sketching it out'
    : seconds < 4
      ? 'Creating image'
      : seconds < 12
        ? 'Sketching it out'
        : 'Refining details'

  return (
    <div
      className={`select-none ${
        isInline ? 'w-full max-w-[320px]' : 'mx-auto w-full max-w-[360px]'
      }`}
    >
      {/* Minimal Top Status Label */}
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <span className="text-[13px] font-normal tracking-tight text-[var(--text)]/90">
          {statusLabel}
        </span>
        {playing && (
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            {score > 0 ? `Score ${score} • ` : ''}Exit game
          </button>
        )}
      </div>

      {/* Sleek Dot-Matrix Canvas (Tap to Play / Tap to Steer) */}
      <div
        ref={gridRef}
        onClick={handleGridTap}
        role="button"
        tabIndex={0}
        title={playing ? 'Tap anywhere or use Arrow/WASD keys to steer' : 'Tap to play while image renders'}
        className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl bg-[var(--surface-elevated)]/25 p-3 transition-colors hover:bg-[var(--surface-elevated)]/40"
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

            if (playing) {
              const snakeIdx = snake.findIndex((s) => s.x === x && s.y === y)
              const isHead = snakeIdx === 0
              const isBody = snakeIdx > 0
              const isFood = food.x === x && food.y === y

              if (isHead) {
                const isVertical = dirRef.current === 'UP' || dirRef.current === 'DOWN'
                return (
                  <div key={idx} className="flex items-center justify-center">
                    <div
                      className={`flex h-3.5 w-3.5 items-center justify-center gap-[2px] rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] ${
                        isVertical ? 'flex-row' : 'flex-col'
                      }`}
                    >
                      <span className="h-[2px] w-[2px] rounded-full bg-black/80" />
                      <span className="h-[2px] w-[2px] rounded-full bg-black/80" />
                    </div>
                  </div>
                )
              }

              if (isBody) {
                // Smoothly taper body dots from head to tail, matching the reference design
                const ratio = 1 - snakeIdx / Math.max(snake.length + 1, 5)
                const sizePx = Math.max(4, Math.round(11 * ratio))
                return (
                  <div key={idx} className="flex items-center justify-center">
                    <span
                      className="rounded-full bg-[var(--accent)] transition-all duration-75"
                      style={{
                        width: `${sizePx}px`,
                        height: `${sizePx}px`,
                        opacity: Math.max(0.45, ratio),
                      }}
                    />
                  </div>
                )
              }

              if (isFood) {
                return (
                  <div key={idx} className="flex items-center justify-center">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
                  </div>
                )
              }

              return (
                <div key={idx} className="flex items-center justify-center">
                  <span className="h-[2.5px] w-[2.5px] rounded-full bg-[var(--text)]/15" />
                </div>
              )
            }

            // Ambient Wave Shimmer Mode (Before Tap)
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

        {/* Subtle Tap-to-Play Hint on Hover (When in Wave Mode) */}
        {!playing && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/75 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
            Tap to play
          </div>
        )}

        {/* Minimal Progress Pill in Bottom-Right */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-[var(--surface-elevated)]/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--accent)] shadow-xs backdrop-blur-md">
          {progressPct}%
        </div>
      </div>
    </div>
  )
}
