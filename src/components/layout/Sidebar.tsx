import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navItems } from '../../lib/navigation'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col rounded-2xl border border-[var(--border)]
        bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] transition-[width] duration-200 ease-in-out ${
          collapsed ? 'w-16' : 'w-60'
        }`}
    >
      <div
        className={`flex items-center py-2 ${
          collapsed ? 'flex-col gap-2' : 'justify-between px-2'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-semibold text-white shadow-[var(--shadow-sm)]">
            S
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-[var(--text)]">
              Second Brain
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)]
            transition-colors duration-150 hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="mt-3 flex-1 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            aria-label={label}
            className={({ isActive }) =>
              `flex items-center rounded-xl py-2.5 text-sm transition-colors duration-150 ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } ${
                isActive
                  ? 'bg-[var(--surface-elevated)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]'
              }`
            }
          >
            <Icon size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="pt-2">
        <div
          title="Offline mode — zero cloud dependencies"
          className={`flex items-center rounded-xl border border-[var(--border)] py-2 text-xs text-[var(--muted)] ${
            collapsed ? 'justify-center px-0' : 'gap-2 px-3'
          }`}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          {!collapsed && <span>Offline</span>}
        </div>
      </div>
    </aside>
  )
}
