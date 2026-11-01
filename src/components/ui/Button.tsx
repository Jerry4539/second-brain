import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium ' +
  'px-4 py-2.5 transition-all duration-150 active:scale-[0.98] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--bg)] disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)]',
  secondary:
    'bg-[var(--surface-elevated)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)]',
  ghost: 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-elevated)]',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
