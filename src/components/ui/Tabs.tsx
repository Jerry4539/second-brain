import { useState, type ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
}

interface TabsProps {
  tabs: TabItem[]
  defaultTab?: string
  value?: string
  onChange?: (id: string) => void
  children: (activeTab: string) => ReactNode
}

export function Tabs({ tabs, defaultTab, value, onChange, children }: TabsProps) {
  const [internalActive, setInternalActive] = useState(defaultTab ?? tabs[0]?.id)
  const active = value ?? internalActive

  function select(id: string) {
    if (onChange) onChange(id)
    else setInternalActive(id)
  }

  return (
    <div>
      <div className="mb-6 inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => select(tab.id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              active === tab.id
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  )
}
