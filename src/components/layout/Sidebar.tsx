import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Mascot } from 'page-mascot'
import { navItems } from '../../lib/navigation'
import { useNetworkStatus } from '../../lib/networkStatus'

export function Sidebar() {
  const { effectiveOnline, forceOffline, toggleForceOffline } = useNetworkStatus()
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [mascotChoice, setMascotChoice] = useState<string>(() => {
    return localStorage.getItem('second-brain-mascot-choice') || 'cap'
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) setMascotChoice(detail)
    }
    window.addEventListener('second-brain-mascot-change', handler)
    const storageHandler = () => {
      setMascotChoice(localStorage.getItem('second-brain-mascot-choice') || 'cap')
    }
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener('second-brain-mascot-change', handler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])

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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            {mascotChoice === 'cap' ? (
              <Mascot
                directions="/mascots/cap-directions.webp"
                reactions="/mascots/cap-reactions.webp"
                size={36}
              />
            ) : mascotChoice === 'mochi' ? (
              <img
                src="/mochiboard/stamps/mochi-happy.png"
                alt="Mochi Mascot"
                className="h-8 w-8 object-contain transition-transform hover:scale-110 cursor-pointer"
              />
            ) : mascotChoice === 'bot' ? (
              <span className="text-2xl transition-transform hover:scale-110 cursor-pointer select-none" title="Cyber Bot">🤖</span>
            ) : mascotChoice === 'fox' ? (
              <span className="text-2xl transition-transform hover:scale-110 cursor-pointer select-none" title="Kitsune Fox">🦊</span>
            ) : (
              <span className="text-2xl transition-transform hover:scale-110 cursor-pointer select-none" title="Cosmo Neko">🐱</span>
            )}
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
        <button
          type="button"
          onClick={() => toggleForceOffline()}
          title={
            effectiveOnline
              ? 'Internet Connected • Live web & external tools active (Click to force air-gapped mode)'
              : forceOffline
              ? 'Air-Gapped Mode Forced • Click to re-enable online access'
              : 'Offline • Operating from local models and memories only (Click to toggle)'
          }
          className={`flex w-full items-center rounded-xl border py-2 text-xs transition-all duration-200 ${
            collapsed ? 'justify-center px-0' : 'justify-between px-3'
          } ${
            effectiveOnline
              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
              : 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="relative flex h-2 w-2 shrink-0">
              {effectiveOnline && (
                <span className="absolute -inset-0.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  effectiveOnline ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            {!collapsed && (
              <span className="truncate font-medium">
                {effectiveOnline ? 'Online' : forceOffline ? 'Offline (Air-gap)' : 'Offline'}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="text-[10px] opacity-75">
              {effectiveOnline ? 'Live Web' : 'Local Only'}
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}
