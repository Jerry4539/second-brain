import { ChevronDown } from 'lucide-react'
import { forwardRef, type SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, ...rest }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={`w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]
          px-3.5 py-2.5 pr-9 text-sm text-[var(--text)] transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]
          disabled:opacity-50 disabled:pointer-events-none ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />
    </div>
  ),
)

Select.displayName = 'Select'
