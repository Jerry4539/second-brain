import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export interface DropdownItem {
  label: string
  icon?: ComponentType<{ size?: number | string; className?: string }>
  onSelect?: () => void
  destructive?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

interface Coords {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function updatePosition() {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < 170 && rect.top > 170

      setCoords({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        left: align === 'left' ? rect.left : undefined,
        right: align === 'right' ? window.innerWidth - rect.right : undefined,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={triggerRef} className="relative inline-block">
      <div onClick={() => setOpen((prev) => !prev)}>{trigger}</div>
      {open && coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : 'auto',
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
              left: coords.left !== undefined ? `${coords.left}px` : 'auto',
              right: coords.right !== undefined ? `${coords.right}px` : 'auto',
            }}
            className="z-50 min-w-44 rounded-xl border border-[var(--border)]
              bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-lifted)] animate-in fade-in duration-100"
          >
            {items.map(({ label, icon: Icon, onSelect, destructive }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onSelect?.()
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors
                  duration-150 hover:bg-[var(--surface)] ${
                    destructive ? 'text-red-500' : 'text-[var(--text)]'
                  }`}
              >
                {Icon && <Icon size={15} />}
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
