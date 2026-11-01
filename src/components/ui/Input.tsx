import { forwardRef, type InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...rest }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 py-2.5
        text-sm text-[var(--text)] placeholder:text-[var(--muted)] transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]
        disabled:opacity-50 disabled:pointer-events-none ${className}`}
      {...rest}
    />
  ),
)

Input.displayName = 'Input'
