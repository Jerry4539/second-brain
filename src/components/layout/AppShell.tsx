import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

export function AppShell() {
  const location = useLocation()
  const isCanvas = location.pathname === '/canvas'
  const isChat = location.pathname === '/chat'
  const isPlay = location.pathname === '/play'

  return (
    <div className="flex h-screen w-screen gap-3 overflow-hidden bg-[var(--bg)] p-3 text-[var(--text)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3 h-full overflow-hidden">
        <header
          className="flex h-12 shrink-0 items-center justify-end rounded-2xl border border-[var(--border)]
            bg-[var(--surface)] px-5 shadow-[var(--shadow-sm)]"
        >
          <ThemeToggle />
        </header>
        <main
          className={`flex-1 min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${
            isCanvas
              ? 'p-2.5 flex flex-col overflow-hidden'
              : isChat
              ? 'p-4 flex flex-col overflow-hidden'
              : 'overflow-y-auto px-4 py-4 md:px-6 md:py-6'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
