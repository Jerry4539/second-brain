import { Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import { isTauriRuntime } from '../../lib/db'

export function AppShell() {
  const location = useLocation()
  const isCanvas = location.pathname === '/canvas'
  const isChat = location.pathname === '/chat'
  const inTauri = isTauriRuntime()

  return (
    <div className="flex h-screen w-screen gap-3 overflow-hidden bg-[var(--bg)] p-3 text-[var(--text)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3 h-full overflow-hidden">
        {!inTauri && (
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-2 text-xs text-[var(--text)]">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-[var(--warning)]" />
              <span>
                <strong>Browser Preview Mode:</strong> You opened <code>localhost:1420</code> in a web browser where Tauri native APIs are unavailable. Use the native <strong>Second Brain</strong> desktop window (or run <code>npm run dev</code>) to download and run AI models.
              </span>
            </div>
          </div>
        )}
        {!isChat && (
          <header
            className="flex h-12 shrink-0 items-center justify-end rounded-2xl border border-[var(--border)]
              bg-[var(--surface)] px-5 shadow-[var(--shadow-sm)]"
          >
            <ThemeToggle />
          </header>
        )}
        <main
          className={`flex-1 min-h-0 ${
            isChat
              ? 'flex flex-col overflow-hidden'
              : `rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${
                  isCanvas
                    ? 'p-2 flex flex-col overflow-hidden'
                    : 'overflow-y-auto px-4 py-4 md:px-6 md:py-6'
                }`
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
