import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  Copy,
  Download,
  ImagePlus,
  RefreshCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { Input } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { useToast } from '../lib/toast'
import {
  generateImage,
  imageEngineStatus,
  readImageDataUrl,
  type ImageEngineStatus,
} from '../lib/imageEngine'
import { ImageGenerationHud } from '../components/create/ImageGenerationHud'
import {
  deleteImage,
  getSetting,
  insertImage,
  listImages,
  listModels,
  setDefaultModel,
  setSetting,
  toggleFavoriteImage,
  type ImageRecord,
  type ModelRecord,
} from '../lib/db'

const SIZE_PRESETS = [
  { label: 'Small Square (256×256) — Quick Preview', width: 256, height: 256 },
  { label: 'Compact Square (384×384) — Fast Preview', width: 384, height: 384 },
  { label: 'Standard Square (512×512) — Balanced', width: 512, height: 512 },
  { label: 'HD Square (768×768) — High Quality', width: 768, height: 768 },
  { label: 'Portrait (512×768) — Tall', width: 512, height: 768 },
  { label: 'HD Portrait (768×1024) — High Detail', width: 768, height: 1024 },
  { label: 'Landscape (768×512) — Wide', width: 768, height: 512 },
  { label: 'HD Landscape (1024×768) — High Detail', width: 1024, height: 768 },
  { label: 'Widescreen (1024×576) — 16:9', width: 1024, height: 576 },
  { label: 'Portrait Story (576×1024) — 9:16', width: 576, height: 1024 },
]

interface Viewing {
  image: ImageRecord
  dataUrl: string
}

export function CreatePage() {
  const [models, setModels] = useState<ModelRecord[] | null>(null)
  const [modelId, setModelId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [presetIndex, setPresetIndex] = useState(0)
  const [steps, setSteps] = useState(6)
  const [savedStepPref, setSavedStepPref] = useState<number | null>(null)
  const [cfgScaleInput, setCfgScaleInput] = useState('')
  const [seedInput, setSeedInput] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [engineStatus, setEngineStatus] = useState<ImageEngineStatus | null>(null)
  const [viewing, setViewing] = useState<Viewing | null>(null)
  const [history, setHistory] = useState<ImageRecord[]>([])
  const [historyThumbs, setHistoryThumbs] = useState<Record<string, string>>({})
  const cancelRef = useRef<(() => void) | null>(null)
  const { showToast } = useToast()
  const location = useLocation()

  useEffect(() => {
    if (location.state && typeof location.state === 'object' && 'initialPrompt' in location.state) {
      const statePrompt = (location.state as { initialPrompt?: string }).initialPrompt
      if (statePrompt) setPrompt(statePrompt)
    }
  }, [location.state])

  useEffect(() => {
    Promise.all([
      listModels('image'),
      getSetting('default_image_model_id'),
      getSetting('image_gen_steps'),
      getSetting('image_gen_resolution'),
      getSetting('image_gen_cfg'),
    ])
      .then(([list, savedModelId, storedSteps, storedRes, storedCfg]) => {
        setModels(list)
        const defaultModel =
          list.find((m) => m.id === savedModelId) ??
          list.find((m) => m.is_default === 1) ??
          list[0]
        if (defaultModel) setModelId(defaultModel.id)
        if (storedSteps && !isNaN(Number(storedSteps))) {
          const parsed = Math.max(2, Math.min(30, Number(storedSteps)))
          setSavedStepPref(parsed)
          setSteps(parsed)
        }
        if (storedRes === '384') setPresetIndex(1)
        else if (storedRes === '512') setPresetIndex(0)
        if (storedCfg) setCfgScaleInput(storedCfg)
      })
      .catch(() => {
        setModels([])
      })
    refreshHistory()
  }, [])

  const selectedModel = models?.find((m) => m.id === modelId) ?? null
  const isLcm = Boolean(
    selectedModel?.architecture === 'LCM' ||
    selectedModel?.name?.toLowerCase().includes('lcm') ||
    selectedModel?.path?.toLowerCase().includes('lcm'),
  )
  const isTurbo = Boolean(
    selectedModel?.name?.toLowerCase().includes('turbo') ||
    selectedModel?.path?.toLowerCase().includes('turbo'),
  )
  const isFastModel = isLcm || isTurbo

  useEffect(() => {
    if (selectedModel) {
      setSteps(savedStepPref ?? (isFastModel ? 6 : 20))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, isFastModel, savedStepPref])

  async function refreshHistory() {
    try {
      const images = await listImages(12)
      setHistory(images)
      const entries = await Promise.all(
        images.map(async (image) => {
          try {
            return [image.id, await readImageDataUrl(image.file_path)] as const
          } catch {
            return [image.id, ''] as const
          }
        }),
      )
      setHistoryThumbs(Object.fromEntries(entries))
    } catch {
      setHistory([])
    }
  }

  async function handleGenerate() {
    if (!modelId) {
      showToast('Import an image model first', 'warning')
      return
    }
    if (!prompt.trim()) {
      showToast('Type a prompt first', 'warning')
      return
    }

    const model = models?.find((m) => m.id === modelId)
    if (!model) return
    const preset = SIZE_PRESETS[presetIndex]
    const seed = seedInput.trim() ? Number(seedInput.trim()) : undefined
    const modelIsLcm = Boolean(
      model.architecture === 'LCM' ||
      model.name.toLowerCase().includes('lcm') ||
      model.path.toLowerCase().includes('lcm'),
    )
    const modelIsTurbo = Boolean(
      model.name.toLowerCase().includes('turbo') ||
      model.path.toLowerCase().includes('turbo'),
    )

    const parsedCfg = cfgScaleInput.trim() ? parseFloat(cfgScaleInput.trim()) : NaN
    const customCfg = !isNaN(parsedCfg) && parsedCfg > 0 ? parsedCfg : undefined
    const defaultCfg = modelIsLcm || modelIsTurbo ? 1.0 : 7.0
    const finalCfg = customCfg ?? defaultCfg

    const DEFAULT_NEGATIVE_PROMPT =
      'ugly, deformed, noisy, blurry, low contrast, oversaturated, grainy, pixelated, bad anatomy, mutated, extra limbs, artifacts'
    const finalNegativePrompt = negativePrompt.trim() || DEFAULT_NEGATIVE_PROMPT

    setGenerating(true)
    const { result, cancel } = generateImage({
      modelPath: model.path,
      prompt: prompt.trim(),
      negativePrompt: finalNegativePrompt,
      width: preset.width,
      height: preset.height,
      steps,
      seed,
      cfgScale: finalCfg,
      samplingMethod: modelIsLcm ? 'lcm' : undefined,
    })
    cancelRef.current = cancel

    try {
      const filePath = await result
      const id = crypto.randomUUID()
      await insertImage({
        id,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || null,
        filePath,
        seed: seed ?? null,
        steps,
        modelId,
        width: preset.width,
        height: preset.height,
      })
      const dataUrl = await readImageDataUrl(filePath)
      const [saved] = await listImages(1)
      if (saved) setViewing({ image: saved, dataUrl })
      await refreshHistory()
      imageEngineStatus().then(setEngineStatus).catch(() => { })
      showToast('Image generated', 'success')
    } catch (error) {
      const message = String(error)
      showToast(
        message.includes('cancelled') ? 'Generation cancelled' : message,
        message.includes('cancelled') ? 'info' : 'warning',
      )
    } finally {
      setGenerating(false)
      cancelRef.current = null
      imageEngineStatus().then(setEngineStatus).catch(() => { })
    }
  }

  function handleCancel() {
    cancelRef.current?.()
  }

  async function handleRegenerate() {
    if (viewing) {
      setPrompt(viewing.image.prompt)
      setNegativePrompt(viewing.image.negative_prompt ?? '')
    }
    await handleGenerate()
  }

  async function handleToggleFavorite(image: ImageRecord) {
    await toggleFavoriteImage(image.id, image.is_favorite === 0)
    await refreshHistory()
    if (viewing?.image.id === image.id) {
      setViewing({ ...viewing, image: { ...image, is_favorite: image.is_favorite === 0 ? 1 : 0 } })
    }
  }

  async function handleDelete(image: ImageRecord) {
    if (!window.confirm('Remove this image from your library?')) return
    await deleteImage(image.id)
    if (viewing?.image.id === image.id) setViewing(null)
    await refreshHistory()
    showToast('Image removed', 'success')
  }

  async function handleCopyPrompt(image: ImageRecord) {
    await navigator.clipboard.writeText(image.prompt)
    showToast('Prompt copied', 'success')
  }

  async function openHistoryItem(image: ImageRecord) {
    const dataUrl = historyThumbs[image.id] || (await readImageDataUrl(image.file_path))
    setViewing({ image, dataUrl })
  }

  if (models === null) {
    return (
      <div>
        <PageHeader title="Create" description="Turn imagination into strange, funny, or beautiful images." />
        <LoadingState label="Loading image models…" />
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div>
        <PageHeader title="Create" description="Turn imagination into strange, funny, or beautiful images." />
        <EmptyState
          icon={ImagePlus}
          title="No image model imported yet"
          description="Import a stable-diffusion.cpp compatible model (.safetensors/.ckpt/.gguf) on the Models page to start generating images."
          action={
            <Link to="/models">
              <Button>Go to Models</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Create"
        description="Turn imagination into strange, funny, or beautiful images."
      />

      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <Textarea
          rows={3}
          placeholder="Create something strange..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={generating}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Select
            value={modelId}
            onChange={(e) => {
              const newId = e.target.value
              setModelId(newId)
              setSetting('default_image_model_id', newId).catch(() => { })
              setDefaultModel(newId).catch(() => { })
            }}
            disabled={generating}
            className="max-w-[220px]"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </Select>
          <Select
            value={presetIndex}
            onChange={(e) => setPresetIndex(Number(e.target.value))}
            disabled={generating}
            className="max-w-[200px]"
          >
            {SIZE_PRESETS.map((preset, index) => (
              <option key={preset.label} value={index}>
                {preset.label}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            onClick={() => setAdvancedOpen((v) => !v)}
            disabled={generating}
          >
            {advancedOpen ? 'Hide advanced' : 'Advanced'}
          </Button>
          <div className="ml-auto flex gap-2">
            {generating ? (
              <Button variant="secondary" onClick={handleCancel}>
                <X size={15} />
                Cancel
              </Button>
            ) : (
              <Button onClick={handleGenerate}>Generate</Button>
            )}
          </div>
        </div>

        {engineStatus?.warm_model && !generating && (
          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Model warm in memory — next generations start instantly</span>
          </div>
        )}

        {advancedOpen && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--muted)]">Negative prompt</label>
              <Textarea
                rows={2}
                placeholder="Avoid defaults (mutated, distorted, extra limbs, blurry)…"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                disabled={generating}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-[var(--muted)]">Steps</label>
                {isFastModel && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Distilled (6 steps optimal)
                  </span>
                )}
              </div>
              <Input
                type="number"
                min={1}
                max={50}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value) || 20)}
                disabled={generating}
              />
              {isFastModel && (
                <div className="mt-2 flex gap-1.5">
                  {[4, 6, 8].map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={generating}
                      onClick={() => setSteps(s)}
                      className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${steps === s
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]'
                        }`}
                    >
                      {s === 4 ? '4 (fast)' : s === 6 ? '6 (sharp)' : '8 (finest)'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--muted)]">Guidance / CFG scale</label>
              <Input
                type="text"
                placeholder={isFastModel ? '1.8 (recommended for LCM)' : '7.0 (standard)'}
                value={cfgScaleInput}
                onChange={(e) => setCfgScaleInput(e.target.value)}
                disabled={generating}
              />
              <span className="mt-1 block text-[10px] text-[var(--muted)]">
                {isFastModel ? 'LCM requires 1.5–2.0 for clean anatomy' : 'Standard models use 7.0'}
              </span>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--muted)]">Seed (blank = random)</label>
              <Input
                type="text"
                placeholder="Random"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                disabled={generating}
              />
            </div>
          </div>
        )}
      </div>

      {generating && (
        <div className="mb-6">
          <ImageGenerationHud />
        </div>
      )}

      {!generating && viewing && (
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <img
            src={viewing.dataUrl}
            alt={viewing.image.prompt}
            className="mx-auto max-h-[480px] rounded-xl border border-[var(--border)] object-contain"
          />
          <p className="mt-3 text-sm text-[var(--muted)]">{viewing.image.prompt}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleRegenerate} disabled={generating}>
              <RefreshCcw size={15} />
              Regenerate
            </Button>
            <Button variant="secondary" onClick={() => handleCopyPrompt(viewing.image)}>
              <Copy size={15} />
              Copy prompt
            </Button>
            <Button variant="secondary" onClick={() => handleToggleFavorite(viewing.image)}>
              <Star size={15} fill={viewing.image.is_favorite ? 'currentColor' : 'none'} />
              {viewing.image.is_favorite ? 'Favorited' : 'Favorite'}
            </Button>
            <Button variant="secondary" onClick={() => revealItemInDir(viewing.image.file_path)}>
              <Download size={15} />
              Reveal in folder
            </Button>
            <Button variant="secondary" onClick={() => handleDelete(viewing.image)}>
              <Trash2 size={15} />
              Delete
            </Button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">Recent</h2>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {history.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => openHistoryItem(image)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] transition-transform duration-150 hover:-translate-y-0.5"
              >
                {historyThumbs[image.id] ? (
                  <img
                    src={historyThumbs[image.id]}
                    alt={image.prompt}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {image.is_favorite === 1 && (
                  <span className="absolute right-1 top-1">
                    <IconButton label="Favorited" className="pointer-events-none h-6 w-6 bg-black/40 text-amber-400">
                      <Star size={12} fill="currentColor" />
                    </IconButton>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
