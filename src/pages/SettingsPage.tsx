import { useEffect, useState } from 'react'
import {
  Brain,
  Check,
  CloudSun,
  Code2,
  Cpu,
  Eye,
  EyeOff,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Info,
  KeyRound,
  Layers,
  LayoutGrid,
  Palette,
  Plus,
  Power,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Dialog } from '../components/ui/Dialog'
import {
  getDb,
  getSetting,
  setSetting,
  listModels,
  setDefaultModel,
  type ModelRecord,
} from '../lib/db'
import { textEngineStatus, stopTextEngine, type EngineStatus } from '../lib/textEngine'
import { imageEngineStatus, stopImageEngine, type ImageEngineStatus } from '../lib/imageEngine'
import { getSystemSpecs, type SystemSpecs } from '../lib/systemInfo'
import {
  addMemoryFact,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_POLICY_WEIGHTS,
  deleteMemoryFact,
  executeTmdbQuery,
  executeWebSearch,
  getAgentRankTitle,
  loadAgentConfig,
  loadAgentPolicy,
  loadMemories,
  saveAgentConfig,
  type AgentConfig,
  type AgentPolicyWeights,
  type MemoryFact,
} from '../lib/agentSkills'
import { useToast } from '../lib/toast'

function BentoCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  className = '',
  accentGlow = false,
  children,
}: {
  title: string
  subtitle?: string
  icon?: typeof Sparkles
  badge?: React.ReactNode
  className?: string
  accentGlow?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 shadow-[var(--shadow-sm)] backdrop-blur-xl transition-all duration-200 hover:border-[var(--accent)]/35 ${
        accentGlow
          ? 'bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--accent)]/[0.04]'
          : ''
      } ${className}`}
    >
      <div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/12 text-[var(--accent)] shadow-2xs">
                <Icon size={17} />
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[var(--text)]">{title}</h2>
              {subtitle && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">{subtitle}</p>
              )}
            </div>
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {children}
      </div>
    </section>
  )
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ${
        checked
          ? 'border-[var(--accent)] bg-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--surface-elevated)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
          checked ? 'translate-x-5.5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

type DbStatus = 'checking' | 'connected' | 'error'
type SettingsCategory = 'all' | 'ai_image' | 'canvas' | 'knowledge' | 'system'

const STEP_PRESETS = [4, 5, 6, 7, 8, 10, 12, 16, 20] as const
const RESOLUTION_PRESETS = [
  { value: '384', label: '384 × 384', badge: 'Fastest', desc: 'Rapid Canvas ideation (~5s)' },
  { value: '512', label: '512 × 512', badge: 'Balanced', desc: 'Crisp standard studio detail' },
  { value: '768', label: '768 × 768', badge: 'Ultra HD', desc: 'High-res artwork (slower)' },
] as const
const CFG_PRESETS = [
  { value: '1.0', label: '1.0', desc: 'LCM / Turbo Instant' },
  { value: '1.8', label: '1.8', desc: 'LCM Crisp Contrast' },
  { value: '5.0', label: '5.0', desc: 'Balanced Guidance' },
  { value: '7.0', label: '7.0', desc: 'Strict Prompt Adherence' },
] as const
const SAMPLER_PRESETS = [
  { value: 'lcm', label: 'LCM (Latent Consistency)', badge: '4–8 Steps' },
  { value: 'euler_a', label: 'Euler Ancestral (euler_a)', badge: '6–16 Steps' },
  { value: 'dpm++2m', label: 'DPM++ 2M Karras', badge: '12–20 Steps' },
] as const

const MASCOT_OPTIONS = [
  {
    id: 'cap',
    name: 'Ash / Red Cap',
    badge: 'Interactive Sprite',
    desc: 'Animated 8-way eye tracking and joyful click reactions',
    avatar: '/mascots/cap-directions.webp',
    type: 'sprite',
  },
  {
    id: 'mochi',
    name: 'Mochi Blob',
    badge: 'Soft & Calm',
    desc: 'Original squishy pastel mascot with cute emotes',
    avatar: '/mochiboard/stamps/mochi-happy.png',
    type: 'image',
  },
  {
    id: 'bot',
    name: 'Cyber Bot',
    badge: 'Neon AI',
    desc: 'Futuristic synthetic assistant with glowing cyan optics',
    icon: '🤖',
    type: 'emoji',
  },
  {
    id: 'fox',
    name: 'Kitsune Fox',
    badge: 'Clever Spirit',
    desc: 'Sharp, creative spirit companion with fiery eyes',
    icon: '🦊',
    type: 'emoji',
  },
  {
    id: 'cat',
    name: 'Cosmo Neko',
    badge: 'Starlight Cat',
    desc: 'Playful cosmic cat that purrs while you design',
    icon: '🐱',
    type: 'emoji',
  },
] as const

export function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('all')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [userName, setUserName] = useState('Jerry')
  const [botName, setBotName] = useState('Second Brain')
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking')
  const [textModels, setTextModels] = useState<ModelRecord[]>([])
  const [imageModels, setImageModels] = useState<ModelRecord[]>([])
  const [specs, setSpecs] = useState<SystemSpecs | null>(null)
  const [textStatus, setTextStatus] = useState<EngineStatus | null>(null)
  const [imgStatus, setImgStatus] = useState<ImageEngineStatus | null>(null)

  // Image Generation & Rendering Engine Settings
  const [imgSteps, setImgSteps] = useState<number>(6)
  const [imgResolution, setImgResolution] = useState<string>('384')
  const [imgCfg, setImgCfg] = useState<string>('1.0')
  const [imgSampler, setImgSampler] = useState<string>('lcm')
  const [imgNegGuard, setImgNegGuard] = useState<boolean>(true)
  const [imgFlashAttn, setImgFlashAttn] = useState<boolean>(true)

  // Canvas & Mascot Co-Pilot Preferences (synced with mochiboard:settings)
  const [mascotChoice, setMascotChoice] = useState<string>(() => {
    return localStorage.getItem('second-brain-mascot-choice') || 'cap'
  })
  const [mascotCalm, setMascotCalm] = useState<'lively' | 'calm' | 'calmest'>('lively')
  const [mascotChatStyle, setMascotChatStyle] = useState<'quiet' | 'normal' | 'chatty'>('normal')
  const [canvasSnap, setCanvasSnap] = useState<boolean>(false)
  const [canvasTilt, setCanvasTilt] = useState<boolean>(true)
  const [canvasGrid, setCanvasGrid] = useState<boolean>(true)
  const [fancyCursor, setFancyCursor] = useState<boolean>(true)

  // Agent Capabilities, API Keys, Policy & Memory State
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [policy, setPolicy] = useState<AgentPolicyWeights>(DEFAULT_POLICY_WEIGHTS)
  const [memories, setMemories] = useState<MemoryFact[]>([])
  const [newMemoryInput, setNewMemoryInput] = useState('')
  const [showTmdbKey, setShowTmdbKey] = useState(false)
  const [showGoogleKey, setShowGoogleKey] = useState(false)
  const [testingTmdb, setTestingTmdb] = useState(false)
  const [testingGoogle, setTestingGoogle] = useState(false)

  const { showToast } = useToast()

  async function refreshRuntimeStatuses() {
    textEngineStatus().then(setTextStatus).catch(() => {})
    imageEngineStatus().then(setImgStatus).catch(() => {})
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        await getDb()
        const [
          storedUserName,
          storedBotName,
          storedSteps,
          storedRes,
          storedCfg,
          storedSampler,
          storedNegGuard,
          storedFlashAttn,
          importedText,
          importedImage,
          sysSpecs,
          loadedCfg,
          loadedPolicy,
          loadedMemories,
        ] = await Promise.all([
          getSetting('user_name'),
          getSetting('bot_name'),
          getSetting('image_gen_steps'),
          getSetting('image_gen_resolution'),
          getSetting('image_gen_cfg'),
          getSetting('image_gen_sampler'),
          getSetting('image_gen_neg_guard'),
          getSetting('image_gen_flash_attn'),
          listModels('text'),
          listModels('image'),
          getSystemSpecs(),
          loadAgentConfig(),
          loadAgentPolicy(),
          loadMemories(),
        ])
        if (cancelled) return
        if (storedUserName) setUserName(storedUserName)
        if (storedBotName) setBotName(storedBotName)
        if (storedSteps && !isNaN(Number(storedSteps))) {
          setImgSteps(Math.max(2, Math.min(30, Number(storedSteps))))
        }
        if (storedRes) setImgResolution(storedRes)
        if (storedCfg) setImgCfg(storedCfg)
        if (storedSampler) setImgSampler(storedSampler)
        if (storedNegGuard !== null) setImgNegGuard(storedNegGuard !== 'false')
        if (storedFlashAttn !== null) setImgFlashAttn(storedFlashAttn !== 'false')

        // Sync Canvas localStorage preferences
        try {
          const rawCanvas = localStorage.getItem('mochiboard:settings')
          if (rawCanvas) {
            const parsed = JSON.parse(rawCanvas)
            if (parsed.mascotChoice) setMascotChoice(parsed.mascotChoice)
            if (parsed.mochiCalm) setMascotCalm(parsed.mochiCalm)
            if (parsed.chat) setMascotChatStyle(parsed.chat)
            if (typeof parsed.snap === 'boolean') setCanvasSnap(parsed.snap)
            if (typeof parsed.tilt === 'boolean') setCanvasTilt(parsed.tilt)
            if (typeof parsed.grid === 'boolean') setCanvasGrid(parsed.grid)
            if (typeof parsed.fancyCursor === 'boolean') setFancyCursor(parsed.fancyCursor)
          }
        } catch {
          // ignore
        }

        setTextModels(importedText)
        setImageModels(importedImage)
        setSpecs(sysSpecs)
        setAgentConfig(loadedCfg)
        setPolicy(loadedPolicy)
        setMemories(loadedMemories)
        setDbStatus('connected')
        await refreshRuntimeStatuses()
      } catch {
        if (!cancelled) setDbStatus('error')
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  function syncCanvasLocalStorage(patch: Record<string, unknown>) {
    try {
      const current = JSON.parse(localStorage.getItem('mochiboard:settings') || '{}')
      const updated = { ...current, ...patch, wLearn: false, wColors: false, wDressup: false }
      localStorage.setItem('mochiboard:settings', JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  async function handleUpdateImgSteps(nextSteps: number) {
    const clamped = Math.max(2, Math.min(30, Math.round(nextSteps)))
    setImgSteps(clamped)
    await setSetting('image_gen_steps', String(clamped))
    syncCanvasLocalStorage({ imgSteps: String(clamped) })
    showToast(`Image rendering steps set to ${clamped}`, 'success')
  }

  async function handleUpdateImgResolution(res: string) {
    setImgResolution(res)
    await setSetting('image_gen_resolution', res)
    syncCanvasLocalStorage({ imgRes: res })
    showToast(`Default render resolution set to ${res}×${res}`, 'success')
  }

  async function handleUpdateImgCfg(cfg: string) {
    setImgCfg(cfg)
    await setSetting('image_gen_cfg', cfg)
    showToast(`Guidance scale (CFG) set to ${cfg}`, 'success')
  }

  async function handleUpdateImgSampler(sampler: string) {
    setImgSampler(sampler)
    await setSetting('image_gen_sampler', sampler)
    showToast(`Sampling scheduler set to ${sampler.toUpperCase()}`, 'success')
  }

  async function handleToggleNegGuard(next: boolean) {
    setImgNegGuard(next)
    await setSetting('image_gen_neg_guard', String(next))
    showToast(next ? 'Smart Negative Prompt Guard enabled' : 'Negative Prompt Guard disabled', 'info')
  }

  async function handleToggleFlashAttn(next: boolean) {
    setImgFlashAttn(next)
    await setSetting('image_gen_flash_attn', String(next))
    showToast(next ? 'Metal Flash Attention enabled' : 'Flash Attention disabled', 'info')
  }

  async function updateAgentField<K extends keyof AgentConfig>(
    key: K,
    value: AgentConfig[K],
    toastMsg?: string,
  ) {
    const next = { ...agentConfig, [key]: value }
    setAgentConfig(next)
    await saveAgentConfig(next)
    if (toastMsg) showToast(toastMsg, 'success')
  }

  async function handleTestTmdb() {
    setTestingTmdb(true)
    try {
      await saveAgentConfig(agentConfig)
      const res = await executeTmdbQuery('Inception', { ...agentConfig, tmdbEnabled: true })
      if (res.items.length > 0) {
        showToast(
          `Connected! Fetched "${res.items[0].title}" (${res.items[0].releaseYear}) via ${res.sourceLabel}`,
          'success',
        )
      } else {
        showToast('Could not fetch movies — check your TMDB API key', 'warning')
      }
    } catch (err) {
      showToast(`TMDB test failed: ${String(err)}`, 'warning')
    } finally {
      setTestingTmdb(false)
    }
  }

  async function handleTestWebSearch() {
    setTestingGoogle(true)
    try {
      await saveAgentConfig(agentConfig)
      const res = await executeWebSearch('Apple Silicon M4 architecture', agentConfig)
      if (res.length > 0) {
        showToast(
          `Search verified! Retrieved ${res.length} live results (${res[0].source})`,
          'success',
        )
      } else {
        showToast('No results returned — check internet or API credentials', 'warning')
      }
    } catch (err) {
      showToast(`Search test failed: ${String(err)}`, 'warning')
    } finally {
      setTestingGoogle(false)
    }
  }

  async function handleAddMemory() {
    if (!newMemoryInput.trim()) return
    const updated = await addMemoryFact(newMemoryInput.trim(), 'preference')
    setMemories(updated)
    setNewMemoryInput('')
    showToast('Added fact to Agent Memory Vault', 'success')
  }

  async function handleRemoveMemory(id: string) {
    const updated = await deleteMemoryFact(id)
    setMemories(updated)
    showToast('Memory removed', 'info')
  }

  async function handleDefaultTextModelChange(id: string) {
    if (!id) return
    await setDefaultModel(id)
    setTextModels(await listModels('text'))
    showToast('Default text model updated', 'success')
  }

  async function handleDefaultImageModelChange(id: string) {
    if (!id) return
    await setDefaultModel(id)
    setImageModels(await listModels('image'))
    showToast('Default image model updated', 'success')
  }

  async function handleFreeAllRam() {
    await Promise.all([
      stopTextEngine().catch(() => {}),
      stopImageEngine().catch(() => {}),
    ])
    await refreshRuntimeStatuses()
    showToast('All AI engines stopped and RAM freed', 'success')
  }

  async function saveUserName(value: string) {
    setUserName(value)
    await setSetting('user_name', value)
    syncCanvasLocalStorage({ name: value })
    showToast('Name saved', 'success')
  }

  async function saveBotName(value: string) {
    setBotName(value)
    await setSetting('bot_name', value)
    syncCanvasLocalStorage({ mochiName: value })
    showToast('Assistant name saved', 'success')
  }

  const nextLevelXp = policy.level * 100
  const levelProgressPct = Math.min(100, Math.round(((policy.totalXp % 100) / 100) * 100))

  const showSection = (cat: SettingsCategory) =>
    activeCategory === 'all' || activeCategory === cat

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-1 pb-12 sm:px-2">
      {/* Header + Quick Filter Pills */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Control Center & Settings"
          description="Sleek Bento workspace for Image Rendering steps, AI models, Canvas co-pilot, live web APIs, and Apple Silicon hardware."
          actions={
            <Button variant="secondary" onClick={() => setAboutOpen(true)}>
              <Info size={15} />
              About
            </Button>
          }
        />
      </div>

      {/* Responsive Category Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-1.5 backdrop-blur-md">
        {(
          [
            { id: 'all', label: 'All Bento Cards', icon: LayoutGrid },
            { id: 'ai_image', label: 'Image Rendering & Models', icon: ImageIcon },
            { id: 'canvas', label: 'Canvas & Mascot', icon: Palette },
            { id: 'knowledge', label: 'Knowledge & Web APIs', icon: Globe },
            { id: 'system', label: 'Memory, RLHF & Hardware', icon: Cpu },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon
          const active = activeCategory === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                active
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ===================================================================== */}
      {/* RESPONSIVE 12-COLUMN BENTO GRID                                       */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        {/* ----------------------------------------------------------------- */}
        {/* BENTO 1: IMAGE GENERATION & DIFFUSION RENDERING ENGINE (7 cols)   */}
        {/* ----------------------------------------------------------------- */}
        {showSection('ai_image') && (
          <BentoCard
            className="md:col-span-6 lg:col-span-7"
            accentGlow
            title="Image Generation & Diffusion Rendering"
            subtitle="Control denoising steps (6, 7, 8, etc.), resolution, guidance scale, and sampling for Canvas & Create Studio."
            icon={ImageIcon}
            badge={
              <Badge tone="accent">
                {imgSteps} Steps • {imgResolution}px • {imgSampler.toUpperCase()}
              </Badge>
            }
          >
            <div className="space-y-4">
              {/* Rendering Steps (4, 5, 6, 7, 8, 10, 12, 16, 20) */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text)]">
                        Denoising Rendering Steps
                      </span>
                      <span className="rounded-md bg-[var(--accent)]/15 px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--accent)]">
                        {imgSteps} steps
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Use <strong>6, 7, or 8 steps</strong> for fast, crisp LCM/Turbo renders; 10–20 steps for standard checkpoints.
                    </p>
                  </div>
                </div>

                {/* Step Quick-Pick Pills */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {STEP_PRESETS.map((s) => {
                    const active = imgSteps === s
                    const isRecommended = s === 6 || s === 7 || s === 8
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleUpdateImgSteps(s)}
                        className={`relative flex h-9 min-w-[44px] flex-1 items-center justify-center rounded-xl border px-2.5 font-mono text-xs font-bold transition-all ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-xs'
                            : isRecommended
                            ? 'border-[var(--accent)]/35 bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]'
                            : 'border-[var(--border)] bg-[var(--surface)]/70 text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]'
                        }`}
                      >
                        {s}
                        {isRecommended && !active && (
                          <span
                            className="absolute -top-1 right-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                            title="Recommended sweet spot (6–8 steps)"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Fine-Tune Slider */}
                <div className="mt-3 flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[var(--muted)]">2</span>
                  <input
                    type="range"
                    min={2}
                    max={30}
                    step={1}
                    value={imgSteps}
                    onChange={(e) => setImgSteps(Number(e.target.value))}
                    onMouseUp={(e) =>
                      handleUpdateImgSteps(Number((e.target as HTMLInputElement).value))
                    }
                    onTouchEnd={(e) =>
                      handleUpdateImgSteps(Number((e.target as HTMLInputElement).value))
                    }
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-[var(--border)] accent-[var(--accent)]"
                  />
                  <span className="font-mono text-[10px] text-[var(--muted)]">30</span>
                </div>
              </div>

              {/* Resolution & CFG Scale 2-Column Sub-Bento */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Resolution Selector */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-3.5">
                  <div className="mb-2 text-xs font-semibold text-[var(--text)]">
                    Default Render Resolution
                  </div>
                  <div className="space-y-1.5">
                    {RESOLUTION_PRESETS.map((r) => {
                      const active = imgResolution === r.value
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => handleUpdateImgResolution(r.value)}
                          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent)]/12'
                              : 'border-[var(--border)] bg-[var(--surface)]/60 hover:border-[var(--accent)]/40'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-[var(--text)]">{r.label}</div>
                            <div className="text-[10px] text-[var(--muted)]">{r.desc}</div>
                          </div>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              active
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--surface-elevated)] text-[var(--muted)]'
                            }`}
                          >
                            {r.badge}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* CFG Scale & Sampler */}
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-3.5">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text)]">
                        CFG Guidance Scale
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[var(--accent)]">
                        CFG {imgCfg}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CFG_PRESETS.map((c) => {
                        const active = imgCfg === c.value
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => handleUpdateImgCfg(c.value)}
                            className={`rounded-xl border px-2.5 py-1.5 text-left transition-all ${
                              active
                                ? 'border-[var(--accent)] bg-[var(--accent)]/12'
                                : 'border-[var(--border)] bg-[var(--surface)]/60 hover:border-[var(--accent)]/40'
                            }`}
                          >
                            <div className="font-mono text-xs font-bold text-[var(--text)]">
                              {c.label}
                            </div>
                            <div className="truncate text-[10px] text-[var(--muted)]">{c.desc}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-[var(--text)]">
                      Sampling Scheduler
                    </div>
                    <Select
                      value={imgSampler}
                      onChange={(e) => handleUpdateImgSampler(e.target.value)}
                    >
                      {SAMPLER_PRESETS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label} ({s.badge})
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Acceleration & Quality Guard Toggles */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">
                      Smart Negative Prompt Guard
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Filters out blurry, deformed, or noisy artifacts automatically.
                    </p>
                  </div>
                  <ToggleSwitch checked={imgNegGuard} onChange={handleToggleNegGuard} />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">
                      Metal Flash Attention
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Uses Apple Silicon GPU Flash Attention for faster diffusion steps.
                    </p>
                  </div>
                  <ToggleSwitch checked={imgFlashAttn} onChange={handleToggleFlashAttn} />
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* BENTO 2: PROFILE, APPEARANCE & DEFAULT LOCAL MODELS (5 cols)      */}
        {/* ----------------------------------------------------------------- */}
        {showSection('ai_image') && (
          <BentoCard
            className="md:col-span-6 lg:col-span-5"
            title="Identity, Theme & Local Models"
            subtitle="Personalize your workspace theme, cursor identity, and active GGUF / Diffusion models."
            icon={Zap}
            badge={<Badge tone="success">Local-First</Badge>}
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 px-3.5 py-2.5">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">Interface Theme</div>
                  <div className="text-[11px] text-[var(--muted)]">Light, Dark, or macOS Auto</div>
                </div>
                <ThemeToggle />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-[var(--text)]">
                  <span className="font-medium text-[var(--muted)]">Your Name (Cursor & Chat)</span>
                  <Input
                    value={userName}
                    placeholder="Your name"
                    onChange={(event) => setUserName(event.target.value)}
                    onBlur={(event) => saveUserName(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text)]">
                  <span className="font-medium text-[var(--muted)]">Assistant Name</span>
                  <Input
                    value={botName}
                    placeholder="Second Brain"
                    onChange={(event) => setBotName(event.target.value)}
                    onBlur={(event) => saveBotName(event.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-3.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text)]">
                      Default Local LLM (Chat & Canvas AI)
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {textModels.length} installed
                    </span>
                  </div>
                  <Select
                    value={textModels.find((m) => m.is_default === 1)?.id ?? ''}
                    onChange={(event) => handleDefaultTextModelChange(event.target.value)}
                    disabled={textModels.length === 0}
                  >
                    {textModels.length === 0 && <option value="">No text models imported</option>}
                    {textModels.length > 0 && (
                      <option value="" disabled>
                        Select a text model
                      </option>
                    )}
                    {textModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text)]">
                      Default Diffusion Model (Image Gen)
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {imageModels.length} installed
                    </span>
                  </div>
                  <Select
                    value={imageModels.find((m) => m.is_default === 1)?.id ?? ''}
                    onChange={(event) => handleDefaultImageModelChange(event.target.value)}
                    disabled={imageModels.length === 0}
                  >
                    {imageModels.length === 0 && <option value="">No image models imported</option>}
                    {imageModels.length > 0 && (
                      <option value="" disabled>
                        Select an image model
                      </option>
                    )}
                    {imageModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* BENTO 3: CANVAS & MASCOT CO-PILOT PREFERENCES (5 cols)            */}
        {/* ----------------------------------------------------------------- */}
        {showSection('canvas') && (
          <BentoCard
            className={activeCategory === 'canvas' ? 'col-span-12' : 'col-span-12 lg:col-span-5'}
            title="Infinite Canvas & Mascot Co-Pilot"
            subtitle="Customize the bottom-right Second Brain mascot, infinite board physics, and cursor feel."
            icon={Layers}
            badge={<Badge tone="accent">Bottom-Right Pinned</Badge>}
          >
            <div className="space-y-3">
              {/* Mascot Character Avatar Selection */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--text)]">
                      Choose Mascot Co-Pilot
                    </span>
                    <Badge tone="accent">Active Avatar</Badge>
                  </div>
                  <span className="text-[10px] text-[var(--muted)]">Canvas & Sidebar</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {MASCOT_OPTIONS.map((m) => {
                    const isSelected = mascotChoice === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMascotChoice(m.id)
                          localStorage.setItem('second-brain-mascot-choice', m.id)
                          syncCanvasLocalStorage({ mascotChoice: m.id })
                          window.dispatchEvent(
                            new CustomEvent('second-brain-mascot-change', { detail: m.id }),
                          )
                          showToast(`Mascot set to ${m.name}`, 'success')
                        }}
                        className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]'
                            : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]">
                          {m.type === 'sprite' ? (
                            <img
                              src="/mascots/cap-directions.webp"
                              alt={m.name}
                              className="h-7 w-7 object-contain"
                            />
                          ) : m.type === 'image' ? (
                            <img
                              src={m.avatar}
                              alt={m.name}
                              className="h-7 w-7 object-contain"
                            />
                          ) : (
                            <span className="text-lg">{m.icon}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`truncate text-xs font-bold ${
                                isSelected ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                              }`}
                            >
                              {m.name}
                            </span>
                            <span className="shrink-0 rounded px-1 text-[8.5px] font-semibold bg-[var(--surface-elevated)] text-[var(--muted)]">
                              {m.badge}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                            {m.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mascot Motion */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    Mascot Eye-Tracking & Motion
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">Bottom-right corner</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'lively', label: 'Lively' },
                      { id: 'calm', label: 'Calm' },
                      { id: 'calmest', label: 'Still' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMascotCalm(m.id)
                        syncCanvasLocalStorage({ mochiCalm: m.id })
                        showToast(`Mascot motion set to ${m.label}`, 'success')
                      }}
                      className={`rounded-xl border py-1.5 text-xs font-semibold transition-all ${
                        mascotCalm === m.id
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assistant Proactivity */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    Co-Pilot Chat Style
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">Bubble & suggestions</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'quiet', label: 'Quiet' },
                      { id: 'normal', label: 'Balanced' },
                      { id: 'chatty', label: 'Proactive' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setMascotChatStyle(c.id)
                        syncCanvasLocalStorage({ chat: c.id })
                        showToast(`Co-Pilot style set to ${c.label}`, 'success')
                      }}
                      className={`rounded-xl border py-1.5 text-xs font-semibold transition-all ${
                        mascotChatStyle === c.id
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Board Physics Toggles */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <span className="text-xs font-medium text-[var(--text)]">Snap to Grid</span>
                  <ToggleSwitch
                    checked={canvasSnap}
                    onChange={(v) => {
                      setCanvasSnap(v)
                      syncCanvasLocalStorage({ snap: v })
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <span className="text-xs font-medium text-[var(--text)]">Tilted Cards</span>
                  <ToggleSwitch
                    checked={canvasTilt}
                    onChange={(v) => {
                      setCanvasTilt(v)
                      syncCanvasLocalStorage({ tilt: v })
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <span className="text-xs font-medium text-[var(--text)]">Dot Grid</span>
                  <ToggleSwitch
                    checked={canvasGrid}
                    onChange={(v) => {
                      setCanvasGrid(v)
                      syncCanvasLocalStorage({ grid: v })
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <span className="text-xs font-medium text-[var(--text)]">Cute Cursor</span>
                  <ToggleSwitch
                    checked={fancyCursor}
                    onChange={(v) => {
                      setFancyCursor(v)
                      syncCanvasLocalStorage({ fancyCursor: v })
                    }}
                  />
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* BENTO 4: AUTONOMOUS DECISION & REWARD POLICY (RLHF) (7 cols)      */}
        {/* ----------------------------------------------------------------- */}
        {showSection('system') && (
          <BentoCard
            className={activeCategory === 'system' ? 'col-span-12' : 'col-span-12 lg:col-span-7'}
            title="Autonomous Decision & Reward Policy (RLHF)"
            subtitle="Second Brain learns from your rewards (+10 XP) and implicit actions to adapt how it selects tools and structures answers."
            icon={Trophy}
            badge={
              <Badge tone="success">
                Lv.{policy.level} • {getAgentRankTitle(policy.level)}
              </Badge>
            }
          >
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3">
                  <div className="text-[11px] text-[var(--muted)]">Total Agent XP</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-[var(--accent)]">
                    {policy.totalXp} XP
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${levelProgressPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">
                    {policy.totalXp} / {nextLevelXp} XP
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3">
                  <div className="text-[11px] text-[var(--muted)]">Explicit Rewards</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-emerald-500">
                    +{policy.positiveRewards}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">User 👍 (+10 XP)</div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3">
                  <div className="text-[11px] text-[var(--muted)]">Implicit Rewards</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-sky-400">
                    +{policy.autoRewards}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">Canvas & copies</div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3">
                  <div className="text-[11px] text-[var(--muted)]">Reward Learning</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text)]">
                      {agentConfig.rewardLearningEnabled ? 'Active' : 'Paused'}
                    </span>
                    <ToggleSwitch
                      checked={agentConfig.rewardLearningEnabled}
                      onChange={(v) =>
                        updateAgentField(
                          'rewardLearningEnabled',
                          v,
                          v ? 'Reward learning enabled' : 'Reward learning paused',
                        )
                      }
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">Adapts weights</div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/35 p-3.5">
                <div className="mb-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text)]">
                    Learned Decision Policy Weights
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    Auto-tuned via Chat & Canvas feedback
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  {[
                    { label: 'Table & Chart', val: policy.tablePreference },
                    { label: 'Visual / Canvas', val: policy.visualRichness },
                    { label: 'Proactive Search', val: policy.proactiveSearch },
                    { label: 'Structured Lists', val: policy.stepByStepDepth },
                    { label: 'Concise Signal', val: policy.conciseness },
                  ].map((item) => {
                    const pct = Math.round(item.val * 100)
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="truncate text-[var(--muted)]">{item.label}</span>
                          <span className="font-mono font-semibold text-[var(--text)]">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* BENTO 5: AUTONOMOUS KNOWLEDGE ROUTER & HYBRID FUSION (6 cols)     */}
        {/* ----------------------------------------------------------------- */}
        {showSection('knowledge') && (
          <BentoCard
            className="md:col-span-6 lg:col-span-6"
            title="Knowledge Router & Hybrid Fusion"
            subtitle="Decides when to use pure local model weights, live internet search, or fuse both together."
            icon={Sliders}
            badge={
              <Badge tone="accent">
                {agentConfig.knowledgeRoutingMode === 'smart_hybrid'
                  ? 'Smart Hybrid'
                  : agentConfig.knowledgeRoutingMode === 'always_hybrid'
                  ? 'Always Combine'
                  : agentConfig.knowledgeRoutingMode === 'live_only'
                  ? 'Live Triggers'
                  : 'Offline Only'}
              </Badge>
            }
          >
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: 'smart_hybrid',
                      title: 'Smart Hybrid Router',
                      badge: 'Recommended',
                      desc: 'Local model for coding/math, live web for breaking facts & comparisons.',
                    },
                    {
                      id: 'always_hybrid',
                      title: 'Always Combine',
                      badge: 'Max Depth',
                      desc: 'Enriches every non-trivial prompt with Wikipedia, DuckDuckGo & HN.',
                    },
                    {
                      id: 'live_only',
                      title: 'Strict Live Triggers',
                      badge: 'Fast Local',
                      desc: 'Queries web only when you ask for current 2025/2026 news or /web.',
                    },
                    {
                      id: 'offline_only',
                      title: '100% Air-Gapped Local',
                      badge: 'Offline',
                      desc: 'Never connects to external APIs. Pure local weights & sandbox.',
                    },
                  ] as const
                ).map((opt) => {
                  const active = agentConfig.knowledgeRoutingMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateAgentField(
                          'knowledgeRoutingMode',
                          opt.id,
                          `Knowledge router set to: ${opt.title}`,
                        )
                      }
                      className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition-all ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-2xs'
                          : 'border-[var(--border)] bg-[var(--surface-elevated)]/40 hover:border-[var(--accent)]/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-[var(--text)]">
                            {opt.title}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              active
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--surface)] text-[var(--muted)]'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">Hybrid Fusion</div>
                    <p className="text-[10px] text-[var(--muted)]">Web facts + LLM reasoning</p>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.hybridFusionEnabled}
                    onChange={(v) =>
                      updateAgentField(
                        'hybridFusionEnabled',
                        v,
                        v ? 'Hybrid Knowledge Fusion enabled' : 'Hybrid Fusion disabled',
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">Wikipedia Grounding</div>
                    <p className="text-[10px] text-[var(--muted)]">Verified encyclopedic context</p>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.wikipediaDeepContext}
                    onChange={(v) =>
                      updateAgentField(
                        'wikipediaDeepContext',
                        v,
                        v ? 'Wikipedia grounding enabled' : 'Wikipedia grounding disabled',
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">Hacker News Pulse</div>
                    <p className="text-[10px] text-[var(--muted)]">Live developer discussions</p>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.hackerNewsTechPulse}
                    onChange={(v) =>
                      updateAgentField(
                        'hackerNewsTechPulse',
                        v,
                        v ? 'Hacker News tech pulse enabled' : 'Hacker News pulse disabled',
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-2.5">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">Fact-Check Guard</div>
                    <p className="text-[10px] text-[var(--muted)]">Cross-verify claims vs web</p>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.autoFactCheck}
                    onChange={(v) =>
                      updateAgentField(
                        'autoFactCheck',
                        v,
                        v ? 'Auto fact-verification enabled' : 'Auto fact-verification disabled',
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* BENTO 6: INTERNET ACCESS & EXTERNAL API CONNECTORS (6 cols)       */}
        {/* ----------------------------------------------------------------- */}
        {showSection('knowledge') && (
          <BentoCard
            className="md:col-span-6 lg:col-span-6"
            title="Internet & External API Connectors"
            subtitle="Zero-key web search & weather, plus optional TMDB and Google Custom Search API keys."
            icon={Globe}
          >
            <div className="space-y-3">
              {/* Live Web Search */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <Globe size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text)]">
                        Live Internet Intelligence
                      </span>
                      <Badge tone="success">Zero-Key</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Wikipedia, DuckDuckGo & Hacker News search (or type <code>/web</code>).
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={agentConfig.webSearchEnabled}
                  onChange={(v) =>
                    updateAgentField(
                      'webSearchEnabled',
                      v,
                      v ? 'Live internet search enabled' : 'Live internet search disabled',
                    )
                  }
                />
              </div>

              {/* TMDB API */}
              <div className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                      <Film size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--text)]">
                          TMDB Movies & TV API
                        </span>
                        {agentConfig.tmdbApiKey.trim() ? (
                          <Badge tone="success">Configured</Badge>
                        ) : (
                          <Badge>Optional Key</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        Ratings, release dates & poster cards via <code>/tmdb</code>.
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.tmdbEnabled}
                    onChange={(v) =>
                      updateAgentField(
                        'tmdbEnabled',
                        v,
                        v ? 'TMDB Movie Agent skill enabled' : 'TMDB Movie skill disabled',
                      )
                    }
                  />
                </div>

                {agentConfig.tmdbEnabled && (
                  <div className="flex flex-col gap-2 border-t border-[var(--border)]/70 pt-2.5 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <KeyRound
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                      />
                      <input
                        type={showTmdbKey ? 'text' : 'password'}
                        value={agentConfig.tmdbApiKey}
                        onChange={(e) =>
                          setAgentConfig((prev) => ({ ...prev, tmdbApiKey: e.target.value }))
                        }
                        onBlur={() =>
                          saveAgentConfig(agentConfig).then(() =>
                            showToast('TMDB API key saved', 'success'),
                          )
                        }
                        placeholder="TMDB API Key (v3) or Read Token (v4)…"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-8 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTmdbKey((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                      >
                        {showTmdbKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <Button
                      variant="secondary"
                      className="h-8 shrink-0 px-3 text-xs"
                      onClick={handleTestTmdb}
                      disabled={testingTmdb}
                    >
                      <Check size={13} />
                      <span>{testingTmdb ? 'Testing…' : 'Test TMDB'}</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Google Search API */}
              <div className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                      <Search size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--text)]">
                          Google Custom Search API
                        </span>
                        {agentConfig.googleApiKey.trim() && agentConfig.googleCx.trim() ? (
                          <Badge tone="success">Connected</Badge>
                        ) : (
                          <Badge>Custom Key</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        Full Google index search with your API Key & CX ID.
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.googleSearchEnabled}
                    onChange={(v) =>
                      updateAgentField(
                        'googleSearchEnabled',
                        v,
                        v ? 'Google Search API enabled' : 'Google Search API disabled',
                      )
                    }
                  />
                </div>

                {agentConfig.googleSearchEnabled && (
                  <div className="grid grid-cols-1 gap-2 border-t border-[var(--border)]/70 pt-2.5 sm:grid-cols-12">
                    <div className="relative sm:col-span-5">
                      <KeyRound
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                      />
                      <input
                        type={showGoogleKey ? 'text' : 'password'}
                        value={agentConfig.googleApiKey}
                        onChange={(e) =>
                          setAgentConfig((prev) => ({ ...prev, googleApiKey: e.target.value }))
                        }
                        onBlur={() => saveAgentConfig(agentConfig)}
                        placeholder="API Key (AIzaSy…)"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-8 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogleKey((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                      >
                        {showGoogleKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={agentConfig.googleCx}
                        onChange={(e) =>
                          setAgentConfig((prev) => ({ ...prev, googleCx: e.target.value }))
                        }
                        onBlur={() => saveAgentConfig(agentConfig)}
                        placeholder="Search Engine CX"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Button
                        variant="secondary"
                        className="h-8 w-full justify-center text-xs"
                        onClick={handleTestWebSearch}
                        disabled={testingGoogle}
                      >
                        <Check size={13} />
                        <span>{testingGoogle ? '…' : 'Test'}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Weather Telemetry */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                    <CloudSun size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text)]">
                        Live Weather & Geo-Telemetry
                      </span>
                      <Badge tone="success">Zero-Key</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Real-time temperature, wind & conditions worldwide via Open-Meteo.
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={agentConfig.weatherEnabled}
                  onChange={(v) =>
                    updateAgentField(
                      'weatherEnabled',
                      v,
                      v ? 'Live weather telemetry enabled' : 'Live weather disabled',
                    )
                  }
                />
              </div>
            </div>
          </BentoCard>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* BENTO 7: EPISODIC MEMORY VAULT & SANDBOX SUPERPOWERS (7 cols)     */}
        {/* ----------------------------------------------------------------- */}
        {showSection('system') && (
          <BentoCard
            className="md:col-span-6 lg:col-span-7"
            title="Episodic Memory Vault & Local Superpowers"
            subtitle="Persistent facts your agent remembers across sessions, deterministic math sandbox, and note writer."
            icon={Brain}
            badge={<Badge tone="accent">{memories.length} Stored Memories</Badge>}
          >
            <div className="space-y-3">
              {/* Memory Vault */}
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">
                      Episodic Long-Term Memory Vault
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Remembers your preferences, stack, and ongoing projects (+5 XP per learned fact).
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.memoryVaultEnabled}
                    onChange={(v) =>
                      updateAgentField(
                        'memoryVaultEnabled',
                        v,
                        v ? 'Episodic Memory Vault enabled' : 'Memory Vault paused',
                      )
                    }
                  />
                </div>

                {agentConfig.memoryVaultEnabled && (
                  <div className="space-y-2.5 border-t border-[var(--border)]/70 pt-2.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMemoryInput}
                        onChange={(e) => setNewMemoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddMemory()
                        }}
                        placeholder="Teach your agent a permanent fact (e.g., 'I build dark-mode React & Rust apps')…"
                        className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <Button className="h-8 px-3 text-xs" onClick={handleAddMemory}>
                        <Plus size={13} />
                        <span>Add Fact</span>
                      </Button>
                    </div>

                    {memories.length > 0 && (
                      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                        {memories.map((mem) => (
                          <div
                            key={mem.id}
                            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text)]"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                            <span>{mem.fact}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMemory(mem.id)}
                              className="ml-1 text-[var(--muted)] hover:text-red-500"
                              title="Forget this fact"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Math Sandbox & Workspace Writer */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                      <Code2 size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--text)]">
                        Deterministic Math Sandbox
                      </div>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        Exact numerical & expression evaluation.
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.codeSandboxEnabled}
                    onChange={(v) =>
                      updateAgentField(
                        'codeSandboxEnabled',
                        v,
                        v ? 'Deterministic Sandbox enabled' : 'Sandbox disabled',
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                      <FileText size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--text)]">
                        Autonomous Note Writer
                      </div>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        Saves Markdown reports via <code>/save</code>.
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={agentConfig.workspaceNotesEnabled}
                    onChange={(v) =>
                      updateAgentField(
                        'workspaceNotesEnabled',
                        v,
                        v ? 'Workspace Note Writer enabled' : 'Workspace Note Writer disabled',
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* BENTO 8: HARDWARE & RUNTIME DIAGNOSTICS (5 cols)                  */}
        {/* ----------------------------------------------------------------- */}
        {showSection('system') && (
          <BentoCard
            className="md:col-span-6 lg:col-span-5"
            title="Hardware & Runtime Telemetry"
            subtitle="Real-time Apple Silicon / GPU acceleration, SQLite status, and memory management."
            icon={Cpu}
          >
            <div className="space-y-3 text-xs">
              {specs && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 px-3.5 py-2.5">
                    <span className="text-[11px] text-[var(--muted)]">Silicon / CPU</span>
                    <span className="font-semibold text-[var(--text)]">
                      {specs.cpu_brand} ({specs.cpu_cores} cores)
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 px-3.5 py-2.5">
                    <span className="text-[11px] text-[var(--muted)]">System Memory</span>
                    <span className="font-semibold text-[var(--text)]">
                      {specs.total_ram_gb} GB {specs.is_apple_silicon ? 'Unified RAM' : 'RAM'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 px-3.5 py-2.5">
                    <span className="text-[11px] text-[var(--muted)]">GPU Backend</span>
                    <span className="font-semibold text-emerald-500">{specs.acceleration}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/35 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">SQLite Knowledge DB</span>
                  {dbStatus === 'checking' && <Badge>Checking…</Badge>}
                  {dbStatus === 'connected' && <Badge tone="success">Connected</Badge>}
                  {dbStatus === 'error' && <Badge tone="warning">Unavailable</Badge>}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">LLM Text Engine</span>
                  {textStatus?.running ? (
                    <Badge tone="success">Warm in RAM</Badge>
                  ) : (
                    <Badge>Idle (0 MB)</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Diffusion Image Engine</span>
                  {imgStatus?.warm_model ? (
                    <Badge tone="success">Warm in RAM</Badge>
                  ) : imgStatus?.available ? (
                    <Badge>Idle (0 MB)</Badge>
                  ) : (
                    <Badge tone="warning">Binary Not Found</Badge>
                  )}
                </div>

                {(textStatus?.running || imgStatus?.warm_model) && (
                  <Button
                    variant="secondary"
                    onClick={handleFreeAllRam}
                    className="mt-2 h-8 w-full justify-center text-xs"
                  >
                    <Power size={13} />
                    <span>Free All Engine RAM Now</span>
                  </Button>
                )}
              </div>
            </div>
          </BentoCard>
        )}
      </div>

      <Dialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="Second Brain AI Studio"
        description="An autonomous, reward-learning, local-first AI workspace & infinite canvas for macOS Apple Silicon."
      >
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Version 0.4.0 — Features Infinite Canvas with bottom-right Mascot Co-Pilot, configurable local Stable Diffusion rendering (4–20 steps), Reinforcement Reward Learning (RLHF), Episodic Memory Vault, Live Internet & Google Search, TMDB intelligence, and zero-copy local GGUF inference.
        </p>
      </Dialog>
    </div>
  )
}
