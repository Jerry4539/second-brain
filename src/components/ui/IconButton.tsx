import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  active?: boolean
}

export function IconButton({
  label,
  children,
  active = false,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-lg p-2 transition-all
        duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-[var(--accent)] disabled:opacity-50 disabled:pointer-events-none
        ${active ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'}
        ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
