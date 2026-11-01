import { forwardRef, type TextareaHTMLAttributes } from 'react'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]
        px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]
        disabled:opacity-50 disabled:pointer-events-none ${className}`}
      {...rest}
    />
  ),
)

Textarea.displayName = 'Textarea'
