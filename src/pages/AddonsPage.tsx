import { useEffect, useState, useMemo } from 'react'
import {
  Blocks,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  RotateCw,
  X,
  AlertTriangle,
  Gamepad2,
  Terminal,
  Activity,
} from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Dialog } from '../components/ui/Dialog'
import { LoadingState } from '../components/ui/LoadingState'
import { useToast } from '../lib/toast'
import type { AddonRecord } from '../lib/db'
import {
  fetchInstalledAddons,
  installAddonFromZip,
  installStarterAddon,
  toggleAddonStatus,
  uninstallAddonById,
  getAddonDataUrl,
  getAddonContent,
} from '../lib/addons'

type FilterType = 'all' | 'game' | 'theme' | 'tool'

export function AddonsPage() {
  const { showToast } = useToast()
  const [addons, setAddons] = useState<AddonRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [installing, setInstalling] = useState(false)
  const [installingStarter, setInstallingStarter] = useState<string | null>(null)

  // Runner modal state
  const [activeAddon, setActiveAddon] = useState<AddonRecord | null>(null)
  const [activeAddonUrl, setActiveAddonUrl] = useState<string | null>(null)
  const [activeAddonHtml, setActiveAddonHtml] = useState<string | null>(null)
  const [loadingRunner, setLoadingRunner] = useState(false)

  // Delete modal state
  const [addonToDelete, setAddonToDelete] = useState<AddonRecord | null>(null)

  const loadAddons = async () => {
    try {
      setLoading(true)
      const list = await fetchInstalledAddons()
      setAddons(list)
    } catch (err) {
      console.error('Failed to load addons:', err)
      showToast('Failed to load add-ons', 'warning')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAddons()
  }, [])

  const handleInstallZip = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Add-on Zip Package', extensions: ['zip'] }],
      })
      if (!selected) return

      const zipPath = typeof selected === 'string' ? selected : selected[0]
      if (!zipPath) return

      setInstalling(true)
      const installed = await installAddonFromZip(zipPath)
      showToast(`Installed add-on "${installed.name}"`, 'success')
      await loadAddons()
    } catch (err) {
      console.error('Add-on install error:', err)
      showToast(
        typeof err === 'string' ? err : 'Failed to install add-on zip',
        'warning',
      )
    } finally {
      setInstalling(false)
    }
  }

  const handleInstallStarter = async (starterId: string) => {
    try {
      setInstallingStarter(starterId)
      const installed = await installStarterAddon(starterId)
      showToast(`Installed starter "${installed.name}"`, 'success')
      await loadAddons()
    } catch (err) {
      console.error('Starter install error:', err)
      showToast(
        typeof err === 'string' ? err : 'Failed to install starter add-on',
        'warning',
      )
    } finally {
      setInstallingStarter(null)
    }
  }

  const handleToggle = async (addon: AddonRecord) => {
    try {
      const nextState = !addon.enabled
      await toggleAddonStatus(addon.id, nextState)
      setAddons((prev) =>
        prev.map((a) =>
          a.id === addon.id ? { ...a, enabled: nextState ? 1 : 0 } : a,
        ),
      )
      showToast(
        `${addon.name} ${nextState ? 'enabled' : 'disabled'}`,
        'success',
      )
    } catch (err) {
      console.error('Toggle error:', err)
      showToast('Failed to update add-on state', 'warning')
    }
  }

  const handleConfirmUninstall = async () => {
    if (!addonToDelete) return
    try {
      await uninstallAddonById(addonToDelete.id)
      setAddons((prev) => prev.filter((a) => a.id !== addonToDelete.id))
      showToast(`Uninstalled "${addonToDelete.name}"`, 'success')
      setAddonToDelete(null)
      if (activeAddon?.id === addonToDelete.id) {
        setActiveAddon(null)
        setActiveAddonUrl(null)
        setActiveAddonHtml(null)
      }
    } catch (err) {
      console.error('Uninstall error:', err)
      showToast('Failed to uninstall add-on', 'warning')
    }
  }

  const handleLaunch = async (addon: AddonRecord) => {
    if (!addon.enabled) {
      showToast('Enable this add-on to launch it', 'info')
      return
    }
    try {
      setLoadingRunner(true)
      setActiveAddon(addon)
      try {
        const content = await getAddonContent(addon.id, addon.entry)
        setActiveAddonHtml(content)
        setActiveAddonUrl(null)
      } catch {
        const dataUrl = await getAddonDataUrl(addon.id, addon.entry)
        setActiveAddonUrl(dataUrl)
        setActiveAddonHtml(null)
      }
    } catch (err) {
      console.error('Launch error:', err)
      showToast(
        typeof err === 'string' ? err : 'Failed to launch add-on',
        'warning',
      )
      setActiveAddon(null)
      setActiveAddonUrl(null)
      setActiveAddonHtml(null)
    } finally {
      setLoadingRunner(false)
    }
  }

  const filteredAddons = useMemo(() => {
    if (filter === 'all') return addons
    return addons.filter((a) => a.type.toLowerCase() === filter)
  }, [addons, filter])

  const isStarterInstalled = (id: string) => addons.some((a) => a.id === id)

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Add-ons"
        description="Extend Second Brain with sandboxed mini-games, visual themes, and creative tools."
        actions={
          <Button
            variant="primary"
            onClick={handleInstallZip}
            disabled={installing}
          >
            <Plus className="w-4 h-4 mr-2" />
            {installing ? 'Extracting...' : 'Install from ZIP'}
          </Button>
        }
      />

      {/* Security sandbox announcement */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)]">
        <div className="p-2.5 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1 text-sm">
          <div className="font-semibold text-[var(--text)]">Sandboxed Execution</div>
          <div className="text-[var(--muted)] mt-0.5 leading-relaxed">
            All add-ons run inside a strictly isolated runtime with path-traversal safeguards and zero native system permissions. They cannot access your private files or terminal.
          </div>
        </div>
      </div>

      {/* Starter Add-on Packs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-[var(--muted)]">
            Starter Packs (3 Ready-to-Install)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Starter 1: Potato vs Mosquito */}
          <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex flex-col justify-between shadow-[var(--shadow-sm)]">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text)] text-sm">Potato vs Mosquito</h3>
                    <div className="text-[11px] text-[var(--muted)]">v1.0.0 • Offline Arcade</div>
                  </div>
                </div>
                <Badge tone="warning">Game</Badge>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                Swat pesky mosquitoes before they take a bite of the sacred potato! Offline arcade action.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
              {isStarterInstalled('potato-vs-mosquito') ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Installed
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  disabled={installingStarter === 'potato-vs-mosquito'}
                  onClick={() => handleInstallStarter('potato-vs-mosquito')}
                >
                  {installingStarter === 'potato-vs-mosquito' ? 'Installing...' : 'Get Starter Game'}
                </Button>
              )}
              {isStarterInstalled('potato-vs-mosquito') && (
                <Button
                  variant="primary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => {
                    const match = addons.find((a) => a.id === 'potato-vs-mosquito')
                    if (match) handleLaunch(match)
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Play
                </Button>
              )}
            </div>
          </div>

          {/* Starter 2: Retro Matrix Rain */}
          <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex flex-col justify-between shadow-[var(--shadow-sm)]">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text)] text-sm">Retro Matrix Rain</h3>
                    <div className="text-[11px] text-[var(--muted)]">v1.0.0 • Visual Theme</div>
                  </div>
                </div>
                <Badge tone="accent">Theme</Badge>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                Hypnotic cyberpunk digital rain visualizer with customizable speed, neon colors, and ambient controls.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
              {isStarterInstalled('retro-matrix-rain') ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Installed
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  disabled={installingStarter === 'retro-matrix-rain'}
                  onClick={() => handleInstallStarter('retro-matrix-rain')}
                >
                  {installingStarter === 'retro-matrix-rain' ? 'Installing...' : 'Get Starter Theme'}
                </Button>
              )}
              {isStarterInstalled('retro-matrix-rain') && (
                <Button
                  variant="primary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => {
                    const match = addons.find((a) => a.id === 'retro-matrix-rain')
                    if (match) handleLaunch(match)
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Launch
                </Button>
              )}
            </div>
          </div>

          {/* Starter 3: Cyber Pong */}
          <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex flex-col justify-between shadow-[var(--shadow-sm)]">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                    <Gamepad2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text)] text-sm">Cyber Pong</h3>
                    <div className="text-[11px] text-[var(--muted)]">v1.0.0 • AI Paddle Battle</div>
                  </div>
                </div>
                <Badge tone="success">Game</Badge>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                Fast-paced neon arcade paddle battle against AI with responsive physics and audio sound effects.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
              {isStarterInstalled('cyber-pong') ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Installed
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  disabled={installingStarter === 'cyber-pong'}
                  onClick={() => handleInstallStarter('cyber-pong')}
                >
                  {installingStarter === 'cyber-pong' ? 'Installing...' : 'Get Starter Game'}
                </Button>
              )}
              {isStarterInstalled('cyber-pong') && (
                <Button
                  variant="primary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => {
                    const match = addons.find((a) => a.id === 'cyber-pong')
                    if (match) handleLaunch(match)
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Play
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Installed Add-ons Header & Filters */}
      <div className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Blocks className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold tracking-wider uppercase text-[var(--muted)]">
              Installed Library ({addons.length})
            </h2>
          </div>
          <div className="flex items-center gap-1.5 bg-[var(--surface-elevated)] p-1 rounded-xl border border-[var(--border)] self-start sm:self-auto">
            {(['all', 'game', 'theme', 'tool'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {f === 'all' ? 'All Types' : f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingState label="Loading installed add-ons..." />
          </div>
        ) : filteredAddons.length === 0 ? (
          <EmptyState
            icon={Blocks}
            title={
              filter === 'all'
                ? 'No add-ons installed yet'
                : `No ${filter} add-ons found`
            }
            description="Install one of the starter packs above or import any custom community add-on ZIP package."
            action={
              <Button variant="secondary" onClick={handleInstallZip}>
                <Plus className="w-4 h-4 mr-2" /> Install from ZIP
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAddons.map((addon) => {
              const isGame = addon.type.toLowerCase() === 'game'

              return (
                <div
                  key={addon.id}
                  className={`p-5 rounded-2xl bg-[var(--surface-elevated)] border transition-all flex flex-col justify-between ${
                    addon.enabled
                      ? 'border-[var(--border)] hover:border-[var(--accent)]/50'
                      : 'border-[var(--border)]/50 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <Badge
                        tone={
                          isGame ? 'warning' : 'accent'
                        }
                      >
                        {addon.type}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted)] font-mono">
                          v{addon.version}
                        </span>
                        {/* Enable toggle switch */}
                        <button
                          type="button"
                          onClick={() => handleToggle(addon)}
                          role="switch"
                          aria-checked={addon.enabled === 1}
                          className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none ${
                            addon.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-elevated)] border border-[var(--border)]'
                          }`}
                          title={addon.enabled ? 'Click to disable' : 'Click to enable'}
                        >
                          <span
                            className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                              addon.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-semibold text-[var(--text)] text-base">
                      {addon.name}
                    </h3>
                    <div className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                      ID: {addon.id}
                    </div>

                    <div className="mt-3 text-xs text-[var(--muted)]">
                      Entry: <code className="text-[var(--text)] font-mono">{addon.entry}</code>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                    <Button
                      variant="primary"
                      className="px-3 py-1.5 text-xs"
                      disabled={!addon.enabled}
                      onClick={() => handleLaunch(addon)}
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      {isGame ? 'Play' : 'Launch'}
                    </Button>

                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => setAddonToDelete(addon)}
                      title="Uninstall add-on"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sandboxed Runner Modal (Phase 9 preview & Phase 10 Sandbox Bridge) */}
      {activeAddon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-5xl bg-[var(--surface-elevated)] rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden" style={{ height: 'min(84vh, 720px)' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-semibold text-[var(--text)] text-sm">
                  {activeAddon.name}
                </h3>
                <Badge tone="neutral">Sandboxed Runtime</Badge>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLaunch(activeAddon)}
                  className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-elevated)] transition-colors"
                  title="Reload add-on"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setActiveAddon(null)
                    setActiveAddonUrl(null)
                    setActiveAddonHtml(null)
                  }}
                  className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-elevated)] transition-colors"
                  title="Close runner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sandboxed Iframe Runner */}
            <div className="flex-1 bg-black relative">
              {loadingRunner || (!activeAddonHtml && !activeAddonUrl) ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <LoadingState label="Preparing sandboxed environment..." />
                </div>
              ) : (
                <iframe
                  title={activeAddon.name}
                  srcDoc={activeAddonHtml || undefined}
                  src={!activeAddonHtml && activeAddonUrl ? activeAddonUrl : undefined}
                  sandbox="allow-scripts allow-forms allow-modals"
                  className="w-full h-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Uninstall Confirmation Dialog */}
      <Dialog
        open={Boolean(addonToDelete)}
        onClose={() => setAddonToDelete(null)}
        title="Uninstall Add-on"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              Are you sure you want to uninstall{' '}
              <strong className="text-[var(--text)] font-semibold">
                {addonToDelete?.name}
              </strong>
              ? All extracted files and add-on data will be permanently removed.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setAddonToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleConfirmUninstall}
            >
              Uninstall Add-on
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
