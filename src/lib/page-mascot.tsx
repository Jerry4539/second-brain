import { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from 'react'

export const DIRECTIONS = [
  'up-left',
  'up',
  'up-right',
  'left',
  'center',
  'right',
  'down-left',
  'down',
  'down-right',
] as const

export const REACTIONS = [
  'blink',
  'heart',
  'sparkle',
  'surprised',
  'wink',
  'bashful',
  'sleepy',
  'dizzy',
  'delighted',
] as const

export type Direction = (typeof DIRECTIONS)[number]
export type Reaction = (typeof REACTIONS)[number]

export interface MascotProps {
  /** URL of the 3×3 direction sheet (order: up-left, up, up-right, left, center, right, down-left, down, down-right). */
  directions: string
  /** URL of the 3×3 reaction sheet (order: blink, heart, sparkle, surprised, wink, bashful, sleepy, dizzy, delighted). Omit to disable click reactions. */
  reactions?: string
  /** Rendered width and height in CSS pixels. @default 160 */
  size?: number
  /** Accessible label for the interactive button. @default "Mascot" */
  alt?: string
  /** Forwarded to the root button element. */
  className?: string
  /** Merged onto the root button element. */
  style?: CSSProperties
}

// 8-way compass sector index → DIRECTIONS index (skips 4, which is 'center')
// Sector 0 = East, going counter-clockwise in screen space (y-down) so sector 2 = South, 4 = West, 6 = North
const SECTOR_TO_DIRECTION: readonly Direction[] = [
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
]

// Reactions cycled through on click. Blink is handled separately via the first frame of the boop sequence.
const CLICK_REACTIONS: readonly Reaction[] = ['heart', 'sparkle', 'delighted']

const DEAD_ZONE = 28 // px from mascot center inside which it looks straight ahead
const HYSTERESIS = 0.12 // radians (~7°) of angular margin before switching sectors

const BOOP_KEYFRAMES = `
@keyframes pm-boop {
  0%   { transform: scale(1, 1) translateY(0); }
  20%  { transform: scale(1.14, 0.86) translateY(4%); }
  48%  { transform: scale(0.93, 1.08) translateY(-6%); }
  74%  { transform: scale(1.03, 0.98) translateY(1%); }
  100% { transform: scale(1, 1) translateY(0); }
}`

function sheetPosition(index: number): string {
  const col = index % 3
  const row = Math.floor(index / 3)
  return `${col * 50}% ${row * 50}%`
}

export function Mascot({
  directions,
  reactions,
  size = 160,
  alt = 'Mascot',
  className,
  style,
}: MascotProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const sectorRef = useRef<number | null>(null)
  const clickCountRef = useRef(0)
  const boopTimersRef = useRef<number[]>([])
  const styleId = useId()

  const [direction, setDirection] = useState<Direction>('center')
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [booping, setBooping] = useState(false)

  // Preload sheets so the first reaction/direction change doesn't flash empty
  useEffect(() => {
    const d = new Image()
    d.src = directions
    if (reactions) {
      const r = new Image()
      r.src = reactions
    }
  }, [directions, reactions])

  // Pointer tracking
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let lastX = 0
    let lastY = 0

    const update = () => {
      raf = 0
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = lastX - cx
      const dy = lastY - cy
      const dist = Math.hypot(dx, dy)

      if (dist < DEAD_ZONE) {
        sectorRef.current = null
        setDirection('center')
        return
      }

      // Angle in [0, 2π), 0 = East, increasing clockwise (screen coords)
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)
      const sectorSize = Math.PI / 4
      const prev = sectorRef.current

      if (prev !== null) {
        const prevCenter = prev * sectorSize
        let diff = Math.abs(angle - prevCenter)
        if (diff > Math.PI) diff = Math.PI * 2 - diff
        if (diff < sectorSize / 2 + HYSTERESIS) return
      }

      const next = Math.floor((angle + sectorSize / 2) / sectorSize) % 8
      sectorRef.current = next
      setDirection(SECTOR_TO_DIRECTION[next])
    }

    const onMove = (e: PointerEvent) => {
      lastX = e.clientX
      lastY = e.clientY
      if (!raf) raf = window.requestAnimationFrame(update)
    }

    const onBlur = () => {
      sectorRef.current = null
      setDirection('center')
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('blur', onBlur)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // Cleanup boop timers on unmount
  useEffect(() => {
    const timers = boopTimersRef.current
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  const boop = useCallback(() => {
    boopTimersRef.current.forEach((t) => window.clearTimeout(t))
    boopTimersRef.current = []

    // Restart CSS keyframe if clicked mid-boop
    setBooping(false)
    requestAnimationFrame(() => setBooping(true))

    if (!reactions) {
      boopTimersRef.current.push(window.setTimeout(() => setBooping(false), 380))
      return
    }

    const pick = CLICK_REACTIONS[clickCountRef.current % CLICK_REACTIONS.length]
    clickCountRef.current += 1

    setReaction('blink')
    boopTimersRef.current.push(
      window.setTimeout(() => setReaction(pick), 90),
      window.setTimeout(() => {
        setReaction(null)
        setBooping(false)
      }, 1500),
    )
  }, [reactions])

  const showingReaction = reaction !== null && reactions !== undefined
  const sheet = showingReaction ? reactions : directions
  const frameIndex = showingReaction
    ? REACTIONS.indexOf(reaction)
    : DIRECTIONS.indexOf(direction)

  return (
    <>
      <style id={styleId}>{BOOP_KEYFRAMES}</style>
      <button
        ref={ref}
        type="button"
        aria-label={alt}
        onClick={boop}
        className={className}
        style={{
          width: size,
          height: size,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          display: 'inline-block',
          ...style,
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            backgroundImage: `url(${sheet})`,
            backgroundSize: '300% 300%',
            backgroundPosition: sheetPosition(frameIndex),
            backgroundRepeat: 'no-repeat',
            transformOrigin: '50% 85%',
            animation: booping ? 'pm-boop 380ms cubic-bezier(.2,.9,.3,1.2)' : undefined,
            willChange: 'background-position, transform',
          }}
        />
      </button>
    </>
  )
}

