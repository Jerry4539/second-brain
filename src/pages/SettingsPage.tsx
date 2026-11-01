import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Dialog } from '../components/ui/Dialog'
import { getDb, getSetting, setSetting, listModels, setDefaultModel, type ModelRecord } from '../lib/db'
import { useToast } from '../lib/toast'

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
    >
      <h2 className="mb-4 text-sm font-medium text-[var(--muted)]">{title}</h2>
      {children}
    </section>
  )
}

type DbStatus = 'checking' | 'connected' | 'error'

export function SettingsPage() {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [userName, setUserName] = useState('User')
  const [botName, setBotName] = useState('Second Brain')
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking')
  const [models, setModels] = useState<ModelRecord[]>([])
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        await getDb()
        const storedUserName = await getSetting('user_name')
        const storedBotName = await getSetting('bot_name')
        const importedModels = await listModels('text')
        if (cancelled) return
        if (storedUserName) setUserName(storedUserName)
        if (storedBotName) setBotName(storedBotName)
        setModels(importedModels)
        setDbStatus('connected')
      } catch {
        if (!cancelled) setDbStatus('error')
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDefaultModelChange(id: string) {
    if (!id) return
    await setDefaultModel(id)
    setModels(await listModels('text'))
    showToast('Default model updated', 'success')
  }

  async function saveUserName(value: string) {
    setUserName(value)
    await setSetting('user_name', value)
    showToast('Name saved', 'success')
  }

  async function saveBotName(value: string) {
    setBotName(value)
    await setSetting('bot_name', value)
    showToast('Bot name saved', 'success')
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="Settings"
        description="Appearance, AI, storage, and diagnostics."
        actions={
          <Button variant="secondary" onClick={() => setAboutOpen(true)}>
            <Info size={15} />
            About
          </Button>
        }
      />

      <SettingsSection title="Appearance">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text)]">Theme</span>
          <ThemeToggle />
        </div>
      </SettingsSection>

      <SettingsSection title="Profile">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
            Your name
            <Input
              value={userName}
              placeholder="Your name"
              onChange={(event) => setUserName(event.target.value)}
              onBlur={(event) => saveUserName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
            Bot name
            <Input
              value={botName}
              placeholder="Bot name"
              onChange={(event) => setBotName(event.target.value)}
              onBlur={(event) => saveBotName(event.target.value)}
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="AI">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-[var(--text)]">Default text model</span>
          <div className="w-56">
            <Select
              value={models.find((m) => m.is_default === 1)?.id ?? ''}
              onChange={(event) => handleDefaultModelChange(event.target.value)}
              disabled={models.length === 0}
            >
              {models.length === 0 && <option value="">No models imported</option>}
              {models.length > 0 && (
                <option value="" disabled>
                  Select a model
                </option>
              )}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Image engine and Jev configuration will appear here once those
          systems are connected.
        </p>
      </SettingsSection>

      <SettingsSection title="Storage">
        <p className="text-sm text-[var(--muted)]">
          Models, library, and add-ons locations will be configurable here.
        </p>
      </SettingsSection>

      <SettingsSection title="Diagnostics">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text)]">Local database</span>
          {dbStatus === 'checking' && <Badge>Checking…</Badge>}
          {dbStatus === 'connected' && <Badge tone="success">Connected</Badge>}
          {dbStatus === 'error' && <Badge tone="warning">Unavailable</Badge>}
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Runtime status and logs will appear here.
        </p>
      </SettingsSection>

      <Dialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="Second Brain"
        description="A calm, local-first desktop companion for talking, creating, and playing."
      >
        <p className="text-sm text-[var(--muted)]">
          Version 0.1.0 — Phase 0/1 shell. No AI runtimes are connected yet.
        </p>
      </Dialog>
    </div>
  )
}
