import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type ToastTone = 'info' | 'success' | 'warning'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const icons: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3200)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
          {toasts.map(({ id, message, tone }) => {
            const Icon = icons[tone]
            return (
              <div
                key={id}
                className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[var(--border)]
                  bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text)] shadow-[var(--shadow-lifted)]"
              >
                <Icon size={16} className="text-[var(--accent)]" />
                {message}
                <button
                  type="button"
                  onClick={() => dismiss(id)}
                  className="ml-1 text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
