import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  Check,
  CloudDownload,
  Cpu,
  FolderOpen,
  MoreVertical,
  Star,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { IconButton } from '../components/ui/IconButton'
import { Dropdown } from '../components/ui/Dropdown'
import { LoadingState } from '../components/ui/LoadingState'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../lib/toast'
import { getInitials } from '../lib/avatar'
import { formatBytes, importGgufModel, scanGgufFolder } from '../lib/gguf'
import { importImageModel, scanImageModelFolder } from '../lib/imageEngine'
import {
  deleteModel,
  findModelByPath,
  insertModel,
  listModels,
  setDefaultModel,
  type ModelRecord,
} from '../lib/db'
import { CURATED_MODELS, type CuratedModel } from '../lib/curatedModels'
import {
  cancelModelDownload,
  onDownloadProgress,
  startModelDownload,
  type DownloadProgress,
} from '../lib/modelsDownloader'

function compatibilityBadge(sizeBytes: number | null) {
  if (!sizeBytes) return <Badge>Unknown</Badge>
  const gb = sizeBytes / 1024 ** 3
  if (gb <= 3) return <Badge tone="success">Ultra Light</Badge>
  if (gb <= 6) return <Badge tone="success">Recommended</Badge>
  if (gb <= 10) return <Badge tone="accent">Balanced</Badge>
  return <Badge tone="warning">Heavy</Badge>
}

export function ModelsPage() {
  const [models, setModels] = useState<ModelRecord[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text')
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({})
  const { showToast } = useToast()

  async function refresh() {
    setModels(await listModels())
  }

  useEffect(() => {
    refresh()

    let unlisten: (() => void) | undefined
    onDownloadProgress((progress) => {
      setDownloads((prev) => ({
        ...prev,
        [progress.id]: progress,
      }))
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])

  async function importOneText(path: string): Promise<{ status: 'imported' | 'duplicate' | 'error'; message?: string }> {
    try {
      const existing = await findModelByPath(path)
      if (existing) return { status: 'duplicate' }
      const info = await importGgufModel(path)
      await insertModel({
        id: crypto.randomUUID(),
        name: info.name,
        path,
        sizeBytes: info.size_bytes,
        quantization: info.quantization,
        architecture: info.architecture,
        kind: 'text',
        format: 'gguf',
      })
      return { status: 'imported' }
    } catch (error) {
      console.error(error)
      return { status: 'error', message: String(error) }
    }
  }

  async function importOneImage(path: string): Promise<{ status: 'imported' | 'duplicate' | 'error'; message?: string }> {
    try {
      const existing = await findModelByPath(path)
      if (existing) return { status: 'duplicate' }
      const info = await importImageModel(path)
      await insertModel({
        id: crypto.randomUUID(),
        name: info.name,
        path,
        sizeBytes: info.size_bytes,
        quantization: null,
        architecture: info.architecture,
        kind: 'image',
        format: info.format,
      })
      return { status: 'imported' }
    } catch (error) {
      console.error(error)
      return { status: 'error', message: String(error) }
    }
  }

  async function handleImportFile() {
    const selected = await open(
      activeTab === 'text'
        ? { multiple: false, filters: [{ name: 'GGUF Model', extensions: ['gguf'] }] }
        : {
            multiple: false,
            filters: [
              { name: 'Image Model', extensions: ['safetensors', 'ckpt', 'gguf', 'pt', 'sft'] },
            ],
          },
    )
    if (!selected || Array.isArray(selected)) return

    setBusy(true)
    const result = activeTab === 'text' ? await importOneText(selected) : await importOneImage(selected)
    setBusy(false)

    if (result.status === 'imported') {
      showToast('Model imported', 'success')
      await refresh()
    } else if (result.status === 'duplicate') {
      showToast('That model is already imported', 'warning')
    } else {
      showToast(`Could not import model: ${result.message || 'Unknown error'}`, 'warning')
    }
  }

  async function handleScanFolder() {
    const folder = await open({ directory: true })
    if (!folder || Array.isArray(folder)) return

    setBusy(true)
    const paths =
      activeTab === 'text' ? await scanGgufFolder(folder) : await scanImageModelFolder(folder)
    let imported = 0
    for (const path of paths) {
      const result = activeTab === 'text' ? await importOneText(path) : await importOneImage(path)
      if (result.status === 'imported') imported += 1
    }
    setBusy(false)
    await refresh()
    showToast(
      imported > 0
        ? `Imported ${imported} model${imported === 1 ? '' : 's'}`
        : 'No new models found in that folder',
      imported > 0 ? 'success' : 'info',
    )
  }

  async function handleSetDefault(id: string) {
    await setDefaultModel(id)
    await refresh()
    showToast('Default model updated', 'success')
  }

  async function handleDelete(model: ModelRecord) {
    if (!window.confirm(`Remove "${model.name}" from Second Brain? The file on disk is not deleted.`)) {
      return
    }
    await deleteModel(model.id)
    await refresh()
    showToast('Model removed', 'success')
  }

  async function handleDownloadCurated(curated: CuratedModel) {
    try {
      showToast(`Starting download: ${curated.name}…`, 'info')
      setDownloads((prev) => ({
        ...prev,
        [curated.id]: {
          id: curated.id,
          downloadedBytes: 0,
          totalBytes: null,
          percentage: 0,
        },
      }))

      const savedPath = await startModelDownload(
        curated.id,
        curated.downloadUrl,
        curated.filename,
      )

      // Auto-import upon download completion
      const res =
        curated.kind === 'text'
          ? await importOneText(savedPath)
          : await importOneImage(savedPath)

      setDownloads((prev) => {
        const next = { ...prev }
        delete next[curated.id]
        return next
      })

      if (res.status === 'imported') {
        showToast(`${curated.name} downloaded & added to library!`, 'success')
        await refresh()
      } else if (res.status === 'duplicate') {
        showToast(`${curated.name} downloaded and already in library`, 'info')
        await refresh()
      } else {
        showToast(`Downloaded, but import failed: ${res.message || 'unknown'}`, 'warning')
      }
    } catch (err) {
      setDownloads((prev) => {
        const next = { ...prev }
        delete next[curated.id]
        return next
      })
      showToast(`Download failed: ${String(err)}`, 'warning')
    }
  }

  async function handleCancelDownload(id: string) {
    try {
      await cancelModelDownload(id)
      setDownloads((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      showToast('Download cancelled', 'info')
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = models?.filter((model) => model.kind === activeTab) ?? null
  const curatedForTab = CURATED_MODELS.filter((m) => m.kind === activeTab)

  function isModelInstalled(curated: CuratedModel) {
    if (!models) return false
    return models.some((m) => {
      const cleanPath = m.path.toLowerCase()
      const cleanFile = curated.filename.toLowerCase()
      return cleanPath.endsWith(cleanFile) || m.name.toLowerCase().includes(curated.name.toLowerCase().slice(0, 8))
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Models"
        description="Import your own local GGUF/Safetensors or 1-click download curated CPU-optimized models."
        actions={
          <>
            <Button variant="secondary" onClick={handleScanFolder} disabled={busy}>
              <FolderOpen size={15} />
              Scan folder
            </Button>
            <Button onClick={handleImportFile} disabled={busy}>
              <Upload size={15} />
              {activeTab === 'text' ? 'Import GGUF' : 'Import image model'}
            </Button>
          </>
        }
      />

      <Tabs
        tabs={[
          { id: 'text', label: 'Text models' },
          { id: 'image', label: 'Image models' },
        ]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as 'text' | 'image')}
      >
        {() => (
          <div className="space-y-8">
            {/* Installed Models Section */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                  My Library ({filtered?.length ?? 0})
                </h3>
              </div>

              {models === null && <LoadingState label="Loading models…" />}

              {filtered !== null && filtered.length === 0 && (
                <EmptyState
                  icon={Cpu}
                  title={activeTab === 'text' ? 'No text models imported' : 'No image models imported'}
                  description={
                    activeTab === 'text'
                      ? 'Download one of the recommended chill models below, or import your own .gguf file.'
                      : 'Download SD-Turbo below (1–4 step fast generation), or import a .safetensors/.gguf file.'
                  }
                  action={
                    <Button onClick={handleImportFile} disabled={busy}>
                      <Upload size={15} />
                      {activeTab === 'text' ? 'Import GGUF' : 'Import image model'}
                    </Button>
                  }
                />
              )}

              {filtered !== null && filtered.length > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                        <th className="px-5 py-3 font-medium">Model</th>
                        <th className="px-5 py-3 font-medium">Size</th>
                        <th className="px-5 py-3 font-medium">{activeTab === 'text' ? 'Quant' : 'Architecture'}</th>
                        <th className="px-5 py-3 font-medium">Compatibility</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((model) => (
                        <tr
                          key={model.id}
                          className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-elevated)]"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-xs font-semibold text-[var(--accent)]">
                                {getInitials(model.name)}
                              </div>
                              <div>
                                <div className="font-medium text-[var(--text)]">
                                  {model.name}
                                </div>
                                {model.is_default === 1 && (
                                  <div className="text-xs text-[var(--muted)]">Default model</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-[var(--muted)]">
                            {formatBytes(model.size_bytes ?? 0)}
                          </td>
                          <td className="px-5 py-3 text-[var(--muted)]">
                            {(activeTab === 'text' ? model.quantization : model.architecture) ?? '—'}
                          </td>
                          <td className="px-5 py-3">{compatibilityBadge(model.size_bytes)}</td>
                          <td className="px-5 py-3">
                            <Badge tone="success">{model.status}</Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Dropdown
                              trigger={
                                <IconButton label="Model actions">
                                  <MoreVertical size={16} />
                                </IconButton>
                              }
                              items={[
                                {
                                  label: 'Set as default',
                                  icon: Star,
                                  onSelect: () => handleSetDefault(model.id),
                                },
                                {
                                  label: 'Reveal in folder',
                                  icon: FolderOpen,
                                  onSelect: () => revealItemInDir(model.path),
                                },
                                {
                                  label: 'Delete',
                                  icon: Trash2,
                                  destructive: true,
                                  onSelect: () => handleDelete(model),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Curated Fast & CPU-Optimized Models Hub */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap size={17} className="text-amber-500" />
                    <h3 className="text-base font-semibold text-[var(--text)]">
                      Chill & Fast Models (One-Click Download)
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    Curated models optimized for Windows CPU and Apple Silicon (Mac M4). Bounded CPU usage ensures your PC stays calm and never slows down.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {curatedForTab.map((curated) => {
                  const installed = isModelInstalled(curated)
                  const dl = downloads[curated.id]
                  const isDownloading = Boolean(dl)

                  return (
                    <div
                      key={curated.id}
                      className="flex flex-col justify-between rounded-2xl border border-[var(--border)]
                        bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)]"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-[var(--text)]">
                              {curated.name}
                            </div>
                            <div className="mt-0.5 text-xs text-[var(--muted)]">
                              {curated.sizeLabel} • {curated.ramEstimate}
                            </div>
                          </div>
                          <Badge tone={curated.badgeTone}>{curated.badge}</Badge>
                        </div>

                        <p className="text-xs leading-relaxed text-[var(--muted)]">
                          {curated.description}
                        </p>

                        <div className="rounded-xl bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--text)]">
                          <span className="font-medium text-amber-500">Ideal for: </span>
                          {curated.idealFor}
                        </div>
                      </div>

                      <div className="mt-4 pt-2">
                        {isDownloading ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-[var(--text)]">
                                Downloading {dl.percentage}%
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCancelDownload(curated.id)}
                                className="flex items-center gap-1 text-[var(--muted)] hover:text-red-500"
                              >
                                <X size={13} />
                                Cancel
                              </button>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                              <div
                                className="h-full bg-[var(--accent)] transition-all duration-300"
                                style={{ width: `${dl.percentage}%` }}
                              />
                            </div>
                            <div className="text-right text-[11px] text-[var(--muted)]">
                              {formatBytes(dl.downloadedBytes)}
                              {dl.totalBytes ? ` / ${formatBytes(dl.totalBytes)}` : ''}
                            </div>
                          </div>
                        ) : installed ? (
                          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check size={14} />
                            Downloaded & Ready
                          </div>
                        ) : (
                          <Button
                            className="w-full justify-center"
                            onClick={() => handleDownloadCurated(curated)}
                            disabled={busy}
                          >
                            <CloudDownload size={15} />
                            Download ({curated.sizeLabel})
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  )
}
