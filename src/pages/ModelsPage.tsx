import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  Check,
  CloudDownload,
  Cpu,
  FolderOpen,
  Gauge,
  HardDrive,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { LoadingState } from '../components/ui/LoadingState'
import { useToast } from '../lib/toast'
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
import { getSystemSpecs, type SystemSpecs } from '../lib/systemInfo'

function cleanSpeedLabel(raw: string): string {
  return raw.replace(/\s*\((Metal|CPU)\)/i, '').trim()
}

function getDeviceFitLabel(minRamGb: number, totalRamGb = 16): {
  label: string
  tone: 'emerald' | 'amber'
} {
  if (minRamGb <= totalRamGb * 0.5) {
    return { label: 'Ultra Smooth', tone: 'emerald' }
  }
  if (minRamGb <= totalRamGb) {
    return { label: 'Fits Your Mac', tone: 'emerald' }
  }
  return { label: `Needs ${minRamGb} GB RAM`, tone: 'amber' }
}

export function ModelsPage() {
  const [models, setModels] = useState<ModelRecord[] | null>(null)
  const [specs, setSpecs] = useState<SystemSpecs | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text')
  const [onlyRecommended, setOnlyRecommended] = useState(false)
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({})
  const { showToast } = useToast()

  async function refresh() {
    try {
      setModels(await listModels())
    } catch (err) {
      console.error('Failed to list models:', err)
      setModels([])
    }
  }

  useEffect(() => {
    refresh()
    getSystemSpecs().then(setSpecs).catch(() => {})

    let unlisten: (() => void) | undefined
    onDownloadProgress((progress) => {
      setDownloads((prev) => ({
        ...prev,
        [progress.id]: progress,
      }))
    })
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => {})

    return () => {
      unlisten?.()
    }
  }, [])

  async function importOneText(
    path: string,
  ): Promise<{ status: 'imported' | 'duplicate' | 'error'; message?: string }> {
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

  async function importOneImage(
    path: string,
  ): Promise<{ status: 'imported' | 'duplicate' | 'error'; message?: string }> {
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
              {
                name: 'Image Model',
                extensions: ['safetensors', 'ckpt', 'gguf', 'pt', 'sft'],
              },
            ],
          },
    )
    if (!selected || Array.isArray(selected)) return

    setBusy(true)
    const result =
      activeTab === 'text' ? await importOneText(selected) : await importOneImage(selected)
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
      const result =
        activeTab === 'text' ? await importOneText(path) : await importOneImage(path)
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
    if (
      !window.confirm(
        `Remove "${model.name}" from Second Brain? The file on disk is not deleted.`,
      )
    ) {
      return
    }
    await deleteModel(model.id)
    await refresh()
    showToast('Model removed', 'success')
  }

  async function handleDownloadCurated(curated: CuratedModel) {
    try {
      showToast(`Downloading ${curated.name}…`, 'info')
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
        showToast(`${curated.name} ready to use!`, 'success')
        await refresh()
      } else if (res.status === 'duplicate') {
        showToast(`${curated.name} is already in your library`, 'info')
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

  const installedForTab = models?.filter((model) => model.kind === activeTab) ?? null
  const totalRam = specs?.total_ram_gb ?? 16

  const curatedForTab = CURATED_MODELS.filter((m) => {
    if (m.kind !== activeTab) return false
    if (onlyRecommended) {
      return m.minRamGb <= totalRam && m.tier !== 'pro'
    }
    return true
  })

  function findInstalledMatch(curated: CuratedModel): ModelRecord | undefined {
    if (!models) return undefined
    const cleanFile = curated.filename.toLowerCase()
    return models.find((m) => m.path.toLowerCase().endsWith(cleanFile))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {/* ===================================================================== */}
      {/* 1. UNIFIED BENTO TOP BAR: Tabs + Hardware Pill + Import Actions       */}
      {/* ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]">
        {/* Left: Segmented Text / Image Switcher */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'text'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <MessageSquare size={13} />
            <span>Chat Models</span>
            {models && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeTab === 'text'
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--surface)] text-[var(--muted)]'
                }`}
              >
                {models.filter((m) => m.kind === 'text').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'image'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <ImageIcon size={13} />
            <span>Image Models</span>
            {models && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeTab === 'image'
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--surface)] text-[var(--muted)]'
                }`}
              >
                {models.filter((m) => m.kind === 'image').length}
              </span>
            )}
          </button>
        </div>

        {/* Center/Right: Concise Hardware Fit Chip + Local Import */}
        <div className="flex flex-wrap items-center gap-2">
          {specs && (
            <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 px-3 py-1.5 text-xs sm:flex">
              <Cpu size={13} className="text-emerald-500" />
              <span className="font-medium text-[var(--text)]">{specs.cpu_brand}</span>
              <span className="text-[var(--muted)]">•</span>
              <span className="text-[var(--muted)]">{specs.total_ram_gb} GB RAM</span>
            </div>
          )}

          <Button
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={handleScanFolder}
            disabled={busy}
          >
            <FolderOpen size={13} />
            <span>Scan Folder</span>
          </Button>

          <Button className="h-8 px-3 text-xs" onClick={handleImportFile} disabled={busy}>
            <Upload size={13} />
            <span>Import File</span>
          </Button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. INSTALLED MODELS ("MY LIBRARY") — Compact Bento Strip              */}
      {/* ===================================================================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Installed & Ready ({installedForTab?.length ?? 0})
          </h2>
        </div>

        {models === null && <LoadingState label="Loading models…" />}

        {installedForTab !== null && installedForTab.length === 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-5 py-4 text-xs text-[var(--muted)]">
            <span>
              No {activeTab} models installed yet. Pick one below to download in 1 click.
            </span>
          </div>
        )}

        {installedForTab !== null && installedForTab.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {installedForTab.map((model) => {
              const isDefault = model.is_default === 1
              return (
                <div
                  key={model.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all ${
                    isDefault
                      ? 'border-[var(--accent)]/50 bg-[var(--surface)] shadow-[var(--shadow-sm)]'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--text)]">
                        {model.name}
                      </span>
                      {isDefault && (
                        <span className="shrink-0 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span>{formatBytes(model.size_bytes ?? 0)}</span>
                      {(model.quantization || model.architecture) && (
                        <>
                          <span>•</span>
                          <span>{model.quantization ?? model.architecture}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(model.id)}
                        className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        title="Use as default model"
                      >
                        <Star size={11} />
                        <span>Set Default</span>
                      </button>
                    )}
                    <IconButton
                      label="Show in Finder"
                      onClick={() => revealItemInDir(model.path)}
                      className="h-7 w-7"
                    >
                      <FolderOpen size={13} />
                    </IconButton>
                    <IconButton
                      label="Remove model"
                      onClick={() => handleDelete(model)}
                      className="h-7 w-7 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 3. MODEL PICKER CATALOG — Only Essential Decision Metrics             */}
      {/* ===================================================================== */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {activeTab === 'text' ? 'Choose a Chat Model' : 'Choose an Image Generator'}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Sorted from smallest & fastest to smartest — compare size, speed, and best use case at a glance.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOnlyRecommended((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              onlyRecommended
                ? 'border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Sparkles size={12} />
            <span>Lightweight Only (&lt;2 GB)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {curatedForTab.map((curated) => {
            const installedRecord = findInstalledMatch(curated)
            const installed = Boolean(installedRecord)
            const dl = downloads[curated.id]
            const isDownloading = Boolean(dl)
            const speedText = cleanSpeedLabel(
              specs?.has_metal ? curated.metalSpeed : curated.cpuSpeed,
            )
            const fit = getDeviceFitLabel(curated.minRamGb, totalRam)

            return (
              <div
                key={curated.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--accent)]/40"
              >
                <div className="space-y-3">
                  {/* Row 1: Model Name + Role Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)] leading-snug">
                      {curated.name}
                    </h3>
                    <span className="shrink-0 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      {curated.badge.split('•')[0].trim()}
                    </span>
                  </div>

                  {/* Row 2: Concise "Best For" 1-Liner */}
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    {curated.idealFor}
                  </p>

                  {/* Row 3: The 3 Essential Decision Metrics (Size • Speed • Fit) */}
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-elevated)]/60 p-2 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[var(--muted)]">Size</span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text)]">
                        <HardDrive size={10} className="text-[var(--muted)]" />
                        {curated.sizeLabel}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center border-x border-[var(--border)]/70 px-1">
                      <span className="text-[10px] text-[var(--muted)]">Speed</span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                        <Gauge size={10} />
                        {speedText}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[var(--muted)]">Device Fit</span>
                      <span
                        className={`mt-0.5 text-xs font-semibold ${
                          fit.tone === 'emerald' ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      >
                        {fit.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 4: Action Button */}
                <div className="mt-4">
                  {isDownloading ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--text)]">
                          Downloading {dl.percentage}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancelDownload(curated.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-red-500"
                        >
                          <X size={12} />
                          Cancel
                        </button>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                        <div
                          className="h-full bg-[var(--accent)] transition-all duration-300"
                          style={{ width: `${dl.percentage}%` }}
                        />
                      </div>
                    </div>
                  ) : installed ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Check size={13} />
                        Installed
                      </span>
                      {installedRecord && installedRecord.is_default !== 1 && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(installedRecord.id)}
                          className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
                        >
                          Make Default
                        </button>
                      )}
                    </div>
                  ) : (
                    <Button
                      className="h-9 w-full justify-center text-xs"
                      onClick={() => handleDownloadCurated(curated)}
                      disabled={busy}
                    >
                      <CloudDownload size={14} />
                      <span>Download ({curated.sizeLabel})</span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
