import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CloudRain,
  Eraser,
  ExternalLink,
  Maximize2,
  Paintbrush,
  PenTool,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wand2,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ImageGenerationHud } from '../components/create/ImageGenerationHud'
import { Dialog } from '../components/ui/Dialog'
import {
  generateImage,
  readImageDataUrl,
} from '../lib/imageEngine'
import {
  insertImage,
  listModels,
  type ModelRecord,
} from '../lib/db'
import {
  playAmbientSound,
  setAmbientVolume,
  stopAmbientSound,
  type AmbientSoundType,
} from '../lib/ambientSound'
import { useToast } from '../lib/toast'

const COLOR_PALETTE = [
  { name: 'Pure Light', value: '#f5f3ee' },
  { name: 'Warm Terracotta', value: '#d97757' },
  { name: 'Sky Cyan', value: '#38bdf8' },
  { name: 'Emerald', value: '#34d399' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Coral Rose', value: '#f43f5e' },
  { name: 'Violet', value: '#c084fc' },
  { name: 'Charcoal', value: '#27272a' },
]

type BrushStyle = 'smooth' | 'neon' | 'heavy' | 'eraser'

export function CanvasPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushColor, setBrushColor] = useState('#d97757')
  const [brushSize, setBrushSize] = useState(6)
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('smooth')
  const [undoHistory, setUndoHistory] = useState<ImageData[]>([])

  // AI Drawer — ALWAYS CLOSED BY DEFAULT for wide, unobstructed drawing
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [mindsetText, setMindsetText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [imageModels, setImageModels] = useState<ModelRecord[]>([])
  const [generatedArt, setGeneratedArt] = useState<{
    dataUrl: string
    filePath: string
    prompt: string
  } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Ambient Soundscape State
  const [activeSound, setActiveSound] = useState<AmbientSoundType>('none')
  const [soundVolume, setSoundVolume] = useState(0.3)

  const cancelRef = useRef<(() => void) | null>(null)
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    listModels('image').then(setImageModels).catch(() => [])

    return () => {
      stopAmbientSound()
    }
  }, [])

  // Auto-resize canvas to fill 100% of container width & height dynamically with zero scroll
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function handleResize() {
      if (!container || !canvas) return
      const rect = container.getBoundingClientRect()
      const newWidth = Math.floor(rect.width)
      const newHeight = Math.floor(rect.height)

      if (newWidth <= 0 || newHeight <= 0) return

      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        // Save current canvas content to temporary offscreen canvas
        const temp = document.createElement('canvas')
        temp.width = canvas.width
        temp.height = canvas.height
        const tempCtx = temp.getContext('2d')
        if (tempCtx && canvas.width > 0 && canvas.height > 0) {
          tempCtx.drawImage(canvas, 0, 0)
        }

        canvas.width = newWidth
        canvas.height = newHeight

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#141416'
          ctx.fillRect(0, 0, newWidth, newHeight)
          if (temp.width > 0 && temp.height > 0) {
            ctx.drawImage(temp, 0, 0)
          }
        }
      }
    }

    const observer = new ResizeObserver(() => {
      handleResize()
    })
    observer.observe(container)

    handleResize()
    return () => observer.disconnect()
  }, [aiPanelOpen])

  function handleSoundToggle(sound: AmbientSoundType) {
    if (activeSound === sound) {
      stopAmbientSound()
      setActiveSound('none')
    } else {
      playAmbientSound(sound, soundVolume)
      setActiveSound(sound)
    }
  }

  function handleVolumeChange(vol: number) {
    setSoundVolume(vol)
    setAmbientVolume(vol)
  }

  function pushUndo() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setUndoHistory((prev) => [...prev.slice(-14), imgData])
  }

  function handleUndo() {
    if (undoHistory.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const nextHistory = [...undoHistory]
    const previous = nextHistory.pop()
    if (previous) {
      ctx.putImageData(previous, 0, 0)
      setUndoHistory(nextHistory)
    }
  }

  function handleClearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    pushUndo()
    ctx.fillStyle = '#141416'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    pushUndo()
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    applyBrushStyles(ctx)
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCanvasCoords(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }
    const ctx = canvas?.getContext('2d')
    if (ctx) {
      ctx.closePath()
    }
  }

  function applyBrushStyles(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brushSize

    if (brushStyle === 'eraser') {
      ctx.strokeStyle = '#141416'
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    } else if (brushStyle === 'neon') {
      ctx.strokeStyle = brushColor
      ctx.shadowColor = brushColor
      ctx.shadowBlur = brushSize * 2.2
      ctx.globalAlpha = 1
    } else if (brushStyle === 'heavy') {
      ctx.strokeStyle = brushColor
      ctx.shadowBlur = 1
      ctx.globalAlpha = 0.85
    } else {
      ctx.strokeStyle = brushColor
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }
  }

  async function handleTransformToArt() {
    if (imageModels.length === 0) {
      showToast('No image models found. Add one in Models first.', 'warning')
      return
    }

    const defaultModel = imageModels.find((m) => m.is_default === 1) ?? imageModels[0]
    const isLcm = Boolean(
      defaultModel.architecture === 'LCM' ||
        defaultModel.name.toLowerCase().includes('lcm') ||
        defaultModel.path.toLowerCase().includes('lcm'),
    )

    const baseIdea = mindsetText.trim() || 'A peaceful cathartic dreamscape with luminous atmospheric reflections'
    const fullPrompt = `${baseIdea}, expressive concept art, masterwork, dramatic atmospheric lighting, high fidelity, 8k resolution`

    setGenerating(true)
    const { result, cancel } = generateImage({
      modelPath: defaultModel.path,
      prompt: fullPrompt,
      negativePrompt:
        'deformed, distorted, disfigured, poorly drawn, bad anatomy, mutated, extra limbs, blurry, out of focus, duplicate, low quality',
      width: 512,
      height: 512,
      steps: isLcm ? 6 : 20,
      cfgScale: isLcm ? 1.8 : 7.0,
      samplingMethod: isLcm ? 'lcm' : undefined,
    })
    cancelRef.current = cancel

    try {
      const filePath = await result
      const id = crypto.randomUUID()
      await insertImage({
        id,
        prompt: fullPrompt,
        negativePrompt: null,
        filePath,
        seed: null,
        steps: isLcm ? 6 : 20,
        modelId: defaultModel.id,
        width: 512,
        height: 512,
      })

      const dataUrl = await readImageDataUrl(filePath)
      setGeneratedArt({ dataUrl, filePath, prompt: fullPrompt })
      showToast('Artwork synthesized', 'success')
    } catch (err) {
      const msg = String(err)
      if (!msg.includes('cancelled')) {
        showToast(`Generation failed: ${msg}`, 'warning')
      }
    } finally {
      setGenerating(false)
      cancelRef.current = null
    }
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden select-none gap-2">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 shadow-[var(--shadow-sm)] shrink-0">
        {/* Left: Tools, Brushes, Palette */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Brushes */}
          <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
            <button
              type="button"
              onClick={() => setBrushStyle('smooth')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                brushStyle === 'smooth'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              <PenTool size={12} />
              <span>Flow</span>
            </button>
            <button
              type="button"
              onClick={() => setBrushStyle('neon')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                brushStyle === 'neon'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              <Sparkles size={12} />
              <span>Glow</span>
            </button>
            <button
              type="button"
              onClick={() => setBrushStyle('heavy')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                brushStyle === 'heavy'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              <Paintbrush size={12} />
              <span>Heavy</span>
            </button>
            <button
              type="button"
              onClick={() => setBrushStyle('eraser')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                brushStyle === 'eraser'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              <Eraser size={12} />
              <span>Erase</span>
            </button>
          </div>

          <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

          {/* Color Palette */}
          {brushStyle !== 'eraser' && (
            <div className="flex items-center gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setBrushColor(c.value)}
                  className={`h-4.5 w-4.5 rounded-full transition-transform ${
                    brushColor === c.value
                      ? 'scale-125 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]'
                      : 'hover:scale-110 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          {/* Brush Size */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className="text-[11px]">Size:</span>
            <input
              type="range"
              min="2"
              max="32"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              className="w-16 accent-[var(--accent)] cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoHistory.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:pointer-events-none"
            title="Undo"
          >
            <RotateCcw size={12} />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={handleClearCanvas}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--muted)] hover:text-red-500 transition-colors"
            title="Clear canvas"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>

        {/* Right: Ambient Soundscapes & AI Transform Trigger */}
        <div className="flex items-center gap-2">
          {/* Ambient Soundscapes */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSoundToggle('rain')}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium transition-all ${
                activeSound === 'rain'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  : 'bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              title="Rain sound"
            >
              <CloudRain size={12} />
              <span>Rain</span>
            </button>

            <button
              type="button"
              onClick={() => handleSoundToggle('wind')}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium transition-all ${
                activeSound === 'wind'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              title="Wind sound"
            >
              <Wind size={12} />
              <span>Wind</span>
            </button>

            <button
              type="button"
              onClick={() => handleSoundToggle('zen')}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium transition-all ${
                activeSound === 'zen'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              title="Zen tone"
            >
              <Zap size={12} />
              <span>Zen</span>
            </button>

            {activeSound !== 'none' && (
              <div className="flex items-center gap-1 ml-1 pl-1 border-l border-[var(--border)]">
                <Volume2 size={12} className="text-[var(--muted)]" />
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-14 accent-[var(--accent)] cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    stopAmbientSound()
                    setActiveSound('none')
                  }}
                  className="text-[var(--muted)] hover:text-[var(--text)] p-0.5"
                >
                  <VolumeX size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* AI Transform Button — Only opens side panel on demand */}
          <Button
            variant={aiPanelOpen ? 'primary' : 'secondary'}
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
            className="text-xs h-7.5 px-3"
          >
            <Sparkles size={13} className="mr-1.5" />
            <span>AI Transform</span>
          </Button>
        </div>
      </div>

      {/* Main Canvas Viewport & On-Demand AI Panel */}
      <div className="flex-1 flex gap-2.5 min-h-0 w-full overflow-hidden relative">
        {/* Full-size Canvas Surface: Takes 100% of available space */}
        <div
          ref={containerRef}
          className="flex-1 h-full min-h-0 w-full rounded-2xl border border-[var(--border)] bg-[#141416] overflow-hidden relative shadow-inner flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            className="w-full h-full block cursor-crosshair touch-none"
          />
        </div>

        {/* Collapsible AI Panel — ONLY opens when user clicks "AI Transform" */}
        {aiPanelOpen && (
          <div className="w-80 sm:w-88 h-full flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg shrink-0 overflow-y-auto gap-3 animate-in slide-in-from-right-3 duration-150">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                  <Wand2 size={13} className="text-[var(--accent)]" />
                  <span>AI Transform</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiPanelOpen(false)}
                  className="text-[var(--muted)] hover:text-[var(--text)] p-1 rounded-lg"
                  title="Close AI panel"
                >
                  <X size={15} />
                </button>
              </div>

              <p className="mt-2 text-xs text-[var(--muted)]">
                Add an optional description to turn your sketch into an image.
              </p>

              <textarea
                rows={2}
                value={mindsetText}
                onChange={(e) => setMindsetText(e.target.value)}
                placeholder="What are you imagining? (optional)..."
                disabled={generating}
                className="mt-2.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-2.5 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />

              <Button
                onClick={handleTransformToArt}
                disabled={generating}
                className="mt-2.5 w-full justify-center py-2 text-xs font-medium shadow-sm"
              >
                <Sparkles size={13} className="mr-1.5" />
                {generating ? 'Generating…' : 'Generate Artwork'}
              </Button>
            </div>

            {/* AI Result or Developing HUD */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] rounded-xl border border-[var(--border)]/60 bg-[var(--surface-muted)]/30 p-2 overflow-hidden">
              {generating && <ImageGenerationHud isInline />}

              {!generating && generatedArt && (
                <div className="flex flex-col items-center justify-between h-full w-full gap-2">
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-[var(--border)] group shadow-md bg-black">
                    <img
                      src={generatedArt.dataUrl}
                      alt={generatedArt.prompt}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all"
                        title="Fullscreen"
                      >
                        <Maximize2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/create', { state: { initialPrompt: generatedArt.prompt } })}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all"
                        title="Studio"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-[var(--muted)] text-center line-clamp-2 px-1">
                    &quot;{generatedArt.prompt}&quot;
                  </p>

                  <div className="flex items-center gap-2 w-full">
                    <Button
                      variant="secondary"
                      className="flex-1 text-xs h-7 py-0"
                      onClick={() => navigate('/create', { state: { initialPrompt: generatedArt.prompt } })}
                    >
                      Open in Studio
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1 text-xs h-7 py-0"
                      onClick={handleTransformToArt}
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}

              {!generating && !generatedArt && (
                <div className="text-center p-3 text-[var(--muted)]">
                  <p className="text-xs">Sketch on canvas and press Generate to create art here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Preview Dialog */}
      {previewOpen && generatedArt && (
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Artwork Preview"
        >
          <div className="space-y-3">
            <div className="max-h-[68vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center">
              <img
                src={generatedArt.dataUrl}
                alt={generatedArt.prompt}
                className="max-h-[66vh] w-auto object-contain rounded-xl"
              />
            </div>
            <p className="rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)] leading-relaxed">
              {generatedArt.prompt}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setPreviewOpen(false)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
