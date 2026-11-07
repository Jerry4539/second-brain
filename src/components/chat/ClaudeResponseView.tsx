import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CloudSun,
  Copy,
  Cpu,
  Droplets,
  ExternalLink,
  FileCheck2,
  Film,
  Globe,
  HardDrive,
  ImagePlus,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react'
import {
  decodeMessageMeta,
  type AgentStep,
} from '../../lib/agentOrchestrator'
import { sanitizeAssistantHistory } from '../../lib/agentBrain'
import { MarkdownContent, type ArtifactPayload } from './MarkdownContent'
import { ChatImageCard } from './ChatImageCard'

interface ClaudeResponseViewProps {
  messageId: string
  rawContent: string
  isLast: boolean
  streaming: boolean
  liveSteps?: AgentStep[]
  tokensPerSec?: number
  isCopied: boolean
  isSpeaking: boolean
  imageDataUrl?: string
  rewardState?: 'up' | 'down' | null
  onCopy: (id: string, cleanText: string) => void
  onSpeak: (id: string, cleanText: string) => void
  onRetry: () => void
  onDelete: (id: string) => void
  onOpenArtifact: (artifact: ArtifactPayload) => void
  onReward?: (id: string, vote: 'up' | 'down', toolUsed: string) => void
  onClarificationSubmit?: (refinedPrompt: string) => void
}

const TOOL_LABELS: Record<string, string> = {
  generate_image: 'Visual Synthesis',
  render_table: 'Comparison Table',
  create_artifact: 'Live Canvas Widget',
  inspect_hardware: 'Hardware Telemetry',
  compute_math: 'Math Sandbox',
  web_search: 'Live Web Search',
  query_tmdb: 'TMDB Media API',
  live_weather: 'Live Weather',
  save_workspace_note: 'Workspace Note',
  ask_clarification: 'Interactive Clarification',
}

export function ClaudeResponseView({
  messageId,
  rawContent,
  isLast,
  streaming,
  liveSteps,
  tokensPerSec,
  isCopied,
  isSpeaking,
  imageDataUrl,
  rewardState,
  onCopy,
  onSpeak,
  onRetry,
  onDelete,
  onOpenArtifact,
  onReward,
  onClarificationSubmit,
}: ClaudeResponseViewProps) {
  const [thinkOpen, setThinkOpen] = useState(false)
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [customClarification, setCustomClarification] = useState('')
  const [submittedClarification, setSubmittedClarification] = useState(false)

  const { meta, cleanText, extractedThink } = decodeMessageMeta(rawContent)

  const generatedImgMatch = cleanText.match(
    /\[generated_image:\s*([^|]+)\|\s*([^\]]+)\]/i,
  )
  const missingImgModelMatch = cleanText.includes('[missing_image_model]')

  const displayMarkdown = sanitizeAssistantHistory(
    cleanText
      .replace(/\[generated_image:[^\]]+\]/i, '')
      .replace(/\[missing_image_model\]/i, '')
      .replace(
        /\n*(?:Note:\s*The information is based on general knowledge[^\n]*|This answer maintains an? [^\n]*)/gi,
        '',
      )
      .trim(),
  )

  const stepsToRender: AgentStep[] =
    streaming && isLast && liveSteps && liveSteps.length > 0
      ? liveSteps
      : meta?.steps ?? []

  const effectiveTool = meta?.toolUsed ?? 'direct_reasoning'
  const isRealExternalTool =
    effectiveTool !== 'direct_reasoning' &&
    effectiveTool !== 'structured_list' &&
    effectiveTool !== 'render_table' &&
    effectiveTool !== 'generate_image'
  const showTraceBar =
    !generatedImgMatch &&
    ((streaming && isLast) ||
      isRealExternalTool ||
      Boolean(extractedThink) ||
      Boolean(meta?.newMemorySaved) ||
      meta?.knowledgeDecision?.mode === 'live_internet' ||
      meta?.knowledgeDecision?.mode === 'hybrid_fusion')
  const currentVote = rewardState ?? meta?.rewardGiven ?? null

  function handleOpenFullResponseArtifact() {
    onOpenArtifact({
      id: `doc-${messageId}`,
      title: 'Response Document',
      kind: 'markdown',
      content: displayMarkdown,
    })
  }

  function handleRunClarification(overrideSingle?: { qText: string; answer: string }) {
    if (!meta?.clarificationWidget || !onClarificationSubmit) return
    const cw = meta.clarificationWidget
    const summaryParts: string[] = []

    if (overrideSingle) {
      summaryParts.push(`${overrideSingle.qText}: ${overrideSingle.answer}`)
    } else {
      for (const q of cw.questions) {
        const picked = selectedAnswers[q.id]
        if (picked) {
          summaryParts.push(`${q.question} -> ${picked}`)
        }
      }
      if (customClarification.trim()) {
        summaryParts.push(`Additional details: ${customClarification.trim()}`)
      }
    }

    if (summaryParts.length === 0) return
    setSubmittedClarification(true)
    const refinedPrompt = `${cw.originalGoal}\n[Clarified Preferences: ${summaryParts.join(' | ')}]`
    onClarificationSubmit(refinedPrompt)
  }

  return (
    <div className="group flex w-full gap-4 py-1.5">
      {/* Subtle Assistant Emblem */}
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
        <Sparkles size={14} />
      </div>

      {/* Open Editorial Canvas */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* ================================================================= */}
        {/* 1. CLEAN, MINIMAL AGENT DECISION TRACE (Only when relevant)       */}
        {/* ================================================================= */}
        {showTraceBar && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]/70 bg-[var(--surface-elevated)]/40">
            <button
              type="button"
              onClick={() => setThinkOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {streaming && isLast ? (
                  <Loader2 size={12} className="shrink-0 animate-spin text-[var(--accent)]" />
                ) : isRealExternalTool ? (
                  <Wrench size={12} className="shrink-0 text-[var(--accent)]" />
                ) : (
                  <Brain size={12} className="shrink-0 text-[var(--muted)]" />
                )}

                <span className="truncate font-medium text-[var(--muted)]">
                  {streaming && isLast
                    ? stepsToRender[stepsToRender.length - 1]?.title || 'Agent thinking…'
                    : TOOL_LABELS[effectiveTool] || 'Agent reasoning'}
                </span>

                {meta?.knowledgeDecision && (
                  <span
                    title={meta.knowledgeDecision.reason}
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-semibold ${
                      meta.knowledgeDecision.mode === 'hybrid_fusion'
                        ? 'bg-sky-500/15 text-sky-400'
                        : meta.knowledgeDecision.mode === 'live_internet'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-zinc-500/15 text-zinc-400'
                    }`}
                  >
                    {meta.knowledgeDecision.mode === 'hybrid_fusion'
                      ? '⚡ Hybrid: Live Web + Model'
                      : meta.knowledgeDecision.mode === 'live_internet'
                      ? '🌐 Live Internet'
                      : '🔒 Local Brain'}
                  </span>
                )}

                {meta?.newMemorySaved && (
                  <span className="rounded-md bg-purple-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-purple-400">
                    🧠 Memory Saved
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--muted)]">
                <span>Details</span>
                {thinkOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </div>
            </button>

            {thinkOpen && (
              <div className="space-y-2 border-t border-[var(--border)]/60 bg-[var(--surface)]/60 px-3.5 py-2.5 text-xs">
                {stepsToRender.map((step) => (
                  <div key={step.id} className="flex items-start gap-2">
                    <CheckCircle2
                      size={13}
                      className="mt-0.5 shrink-0 text-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--text)]">{step.title}</div>
                      {step.detail && (
                        <div className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {meta?.newMemorySaved && (
                  <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-[11px] text-purple-300">
                    <Brain size={12} className="shrink-0 text-purple-400" />
                    <span>Stored in Episodic Memory Vault: &ldquo;{meta.newMemorySaved}&rdquo;</span>
                  </div>
                )}

                {extractedThink && (
                  <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-2.5 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                    {extractedThink}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. RICH AGENT TOOL WIDGETS (TMDB, Web Search, Weather, Hardware)  */}
        {/* ================================================================= */}

        {/* A. TMDB Movies & TV Bento Cards */}
        {meta?.tmdbWidget && meta.tmdbWidget.items.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/35 p-3">
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
                <Film size={13} className="text-[var(--accent)]" />
                <span>{meta.tmdbWidget.sourceLabel}</span>
              </div>
              <span className="text-[10px] text-[var(--muted)]">
                {meta.tmdbWidget.items.length} titles fetched
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {meta.tmdbWidget.items.map((movie) => (
                <div
                  key={`${movie.mediaType}-${movie.id}`}
                  className="flex gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-2xs"
                >
                  {movie.posterUrl ? (
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="h-20 w-14 shrink-0 rounded-lg object-cover bg-[var(--surface-elevated)]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--muted)]">
                      <Film size={18} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-[var(--text)]">
                      {movie.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                      <span>{movie.releaseYear}</span>
                      <span>•</span>
                      <span className="uppercase">{movie.mediaType}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-0.5 font-semibold text-amber-500">
                        <Star size={9} fill="currentColor" />
                        {movie.rating}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[var(--muted)]">
                      {movie.overview}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* B. Sleek, Minimal ChatGPT/Perplexity-style Live Web Sources Strip */}
        {meta?.webSearchWidget && meta.webSearchWidget.results.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-elevated)]/30 p-2.5 transition-all">
            {/* Compact Header & Source Counter */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                  <Globe size={13} className="animate-pulse" />
                </div>
                <span className="text-xs font-semibold text-[var(--text)]">
                  Sources
                </span>
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                  {meta.webSearchWidget.results.length} verified
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSourcesExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                <span>{sourcesExpanded ? 'Hide snippets' : 'Show snippets'}</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${
                    sourcesExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Horizontal Compact Source Pills (Perplexity / ChatGPT style) */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {meta.webSearchWidget.results.map((item, idx) => (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`${item.title} — ${item.snippet}`}
                  className="group/pill inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text)] transition-all hover:border-sky-500/40 hover:bg-[var(--surface-elevated)]"
                >
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[9px] font-bold text-sky-400">
                    {idx + 1}
                  </span>
                  <span className="truncate font-medium">{item.title}</span>
                  <ExternalLink
                    size={10}
                    className="shrink-0 text-[var(--muted)] opacity-50 group-hover/pill:text-sky-400 group-hover/pill:opacity-100"
                  />
                </a>
              ))}
            </div>

            {/* Expandable Snippets Grid (Only when user explicitly clicks "Show snippets") */}
            {sourcesExpanded && (
              <div className="mt-2.5 grid grid-cols-1 gap-2 border-t border-[var(--border)]/50 pt-2.5 sm:grid-cols-2">
                {meta.webSearchWidget.results.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group/card flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition-colors hover:border-sky-500/40"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[9px] font-semibold text-sky-400">
                          {item.source}
                        </span>
                        <ExternalLink
                          size={10}
                          className="text-[var(--muted)] opacity-60 group-hover/card:text-sky-400 group-hover/card:opacity-100"
                        />
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-[var(--text)] group-hover/card:text-sky-400">
                        {item.title}
                      </div>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[var(--muted)]">
                      {item.snippet}
                    </p>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* C. Live Weather Telemetry Widget */}
        {meta?.weatherWidget && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/8 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                <CloudSun size={20} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--text)]">
                  {meta.weatherWidget.location}
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  {meta.weatherWidget.condition} • Feels like {meta.weatherWidget.feelsLikeC}°C
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-[var(--text)]">
                  {meta.weatherWidget.temperatureC}°C
                </div>
              </div>
              <div className="flex flex-col gap-0.5 border-l border-[var(--border)] pl-3 text-[10px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <Wind size={10} className="text-sky-400" />
                  {meta.weatherWidget.windKph} km/h
                </span>
                <span className="inline-flex items-center gap-1">
                  <Droplets size={10} className="text-sky-400" />
                  {meta.weatherWidget.humidity}% humidity
                </span>
              </div>
            </div>
          </div>
        )}

        {/* D. Workspace Note Saved Widget */}
        {meta?.workspaceNoteWidget && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              <FileCheck2 size={16} className="text-emerald-400" />
              <div>
                <div className="font-semibold text-[var(--text)]">
                  Saved Note to Workspace: {meta.workspaceNoteWidget.filename}
                </div>
                <div className="font-mono text-[10px] text-[var(--muted)]">
                  {meta.workspaceNoteWidget.savedPath}
                </div>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Persisted
            </span>
          </div>
        )}

        {/* E. System Hardware Bento Widget */}
        {meta?.systemWidget && (
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
                <Cpu size={11} className="text-[var(--accent)]" />
                <span>Processor</span>
              </div>
              <div className="mt-1 truncate text-xs font-semibold text-[var(--text)]">
                {meta.systemWidget.cpuBrand}
              </div>
              <div className="text-[10px] text-[var(--muted)]">
                {meta.systemWidget.cores} Cores
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
                <Zap size={11} className="text-emerald-500" />
                <span>Acceleration</span>
              </div>
              <div className="mt-1 truncate text-xs font-semibold text-emerald-500">
                {meta.systemWidget.acceleration}
              </div>
              <div className="text-[10px] text-[var(--muted)]">
                {meta.systemWidget.optimalThreads} Active Threads
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
                <HardDrive size={11} className="text-[var(--accent)]" />
                <span>Unified RAM</span>
              </div>
              <div className="mt-1 text-xs font-semibold text-[var(--text)]">
                {meta.systemWidget.totalRamGb} GB
              </div>
              <div className="text-[10px] text-[var(--muted)]">
                {meta.systemWidget.osArch}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
                <Layers size={11} className="text-[var(--accent)]" />
                <span>Local Models</span>
              </div>
              <div className="mt-1 text-xs font-semibold text-[var(--text)]">
                {meta.systemWidget.textModelCount} Text · {meta.systemWidget.imageModelCount} Image
              </div>
              <div className="truncate text-[10px] text-[var(--muted)]">
                Active: {meta.systemWidget.activeModelName}
              </div>
            </div>
          </div>
        )}

        {/* F. Deterministic Math Widget */}
        {meta?.mathWidget && (
          <div className="flex items-center justify-between rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Calculator size={15} />
              </div>
              <div>
                <div className="font-mono text-xs text-[var(--muted)]">
                  {meta.mathWidget.expression} =
                </div>
                <div className="font-mono text-base font-bold text-[var(--text)]">
                  {meta.mathWidget.result}
                </div>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-500">
              Verified Exact
            </span>
          </div>
        )}

        {/* Missing Image Model Action Card */}
        {missingImgModelMatch && (
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface-elevated)]/70 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <ImagePlus size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--text)]">
                  Image Generation Model Needed
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                  Download a compact GGUF image model (like <strong>DreamShaper 8 LCM 1.46 GB</strong> or{' '}
                  <strong>SD-Turbo</strong>) in 1 click to render images right in chat.
                </div>
              </div>
            </div>
            <Link
              to="/models"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
            >
              <ImagePlus size={13} />
              <span>Get Image Model</span>
            </Link>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. OPEN EDITORIAL RESPONSE STREAM (Tables, Charts, Code, Prose)   */}
        {/* ================================================================= */}
        {displayMarkdown && (
          <div className="text-[var(--text)]">
            <MarkdownContent content={displayMarkdown} onOpenArtifact={onOpenArtifact} />
            {streaming && isLast && (
              <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            )}
          </div>
        )}

        {/* Generated Image Studio Card */}
        {generatedImgMatch && (
          <ChatImageCard
            prompt={generatedImgMatch[1].trim()}
            filePath={generatedImgMatch[2].trim()}
            dataUrl={imageDataUrl}
          />
        )}

        {/* ================================================================= */}
        {/* 3.5 INTERACTIVE AGENT CLARIFICATION & NEXT-STEP DECISION CARD     */}
        {/* ================================================================= */}
        {!streaming && meta?.clarificationWidget && !submittedClarification && (
          <div className="overflow-hidden rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface-elevated)]/65 p-3.5 shadow-xs">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
                <Sparkles size={13} className="text-[var(--accent)]" />
                <span>
                  {meta.clarificationWidget.mode === 'ask_first'
                    ? 'Agent Clarification — Help Me Tailor Your Output'
                    : 'Agent Next-Step Actions'}
                </span>
              </div>
              <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                Interactive Decision
              </span>
            </div>

            <div className="space-y-3">
              {meta.clarificationWidget.questions.map((q) => {
                const isSingleQuestion = meta.clarificationWidget!.questions.length === 1
                const currentPicked = selectedAnswers[q.id]
                return (
                  <div key={q.id} className="space-y-1.5">
                    <div className="text-xs font-medium text-[var(--text)]">{q.question}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((opt) => {
                        const active = currentPicked === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt }))
                              if (isSingleQuestion && meta.clarificationWidget?.mode === 'refine_output') {
                                handleRunClarification({ qText: q.question, answer: opt })
                              }
                            }}
                            className={`rounded-xl border px-3 py-1.5 text-left text-xs font-medium transition-all ${
                              active
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-xs'
                                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]/50'
                            }`}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {meta.clarificationWidget.mode === 'ask_first' && (
                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={customClarification}
                    onChange={(e) => setCustomClarification(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRunClarification()
                    }}
                    placeholder="Or type any specific detail / constraint…"
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRunClarification()}
                    disabled={
                      Object.keys(selectedAnswers).length === 0 && !customClarification.trim()
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Zap size={12} />
                    <span>Execute Tailored Plan</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. UTILITY FOOTER + AGENT REWARD REINFORCEMENT FEEDBACK           */}
        {/* ================================================================= */}
        {!streaming && (displayMarkdown || generatedImgMatch) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Left: Standard Message Utilities */}
            <div
              className={`flex items-center gap-1 text-[11px] text-[var(--muted)] transition-opacity ${
                isLast ? 'opacity-90 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {tokensPerSec !== undefined && tokensPerSec > 0 && (
                <span className="mr-1.5 font-mono text-[10px] text-[var(--muted)]/80">
                  {tokensPerSec} tok/s
                </span>
              )}

              <button
                type="button"
                onClick={() => onCopy(messageId, displayMarkdown)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
              >
                {isCopied ? (
                  <Check size={11} className="text-emerald-500" />
                ) : (
                  <Copy size={11} />
                )}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>

              {displayMarkdown && (
                <button
                  type="button"
                  onClick={() => onSpeak(messageId, displayMarkdown)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--surface-elevated)] ${
                    isSpeaking ? 'text-[var(--accent)]' : 'hover:text-[var(--text)]'
                  }`}
                >
                  {isSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  <span>{isSpeaking ? 'Stop' : 'Speak'}</span>
                </button>
              )}

              {displayMarkdown.length > 180 && (
                <button
                  type="button"
                  onClick={handleOpenFullResponseArtifact}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                  title="Open response in side-by-side Canvas"
                >
                  <Layers size={11} />
                  <span>Canvas</span>
                </button>
              )}

              {isLast && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                >
                  <RefreshCw size={11} />
                  <span>Retry</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onDelete(messageId)}
                className="rounded-lg px-1.5 py-1 hover:bg-[var(--surface-elevated)] hover:text-red-500"
                title="Delete turn"
              >
                <Trash2 size={11} />
              </button>
            </div>

            {/* Right: Agent Reinforcement Reward Feedback (+10 XP / -5 XP) */}
            {onReward && (
              <div
                className={`flex items-center gap-1 text-[11px] transition-opacity ${
                  isLast || currentVote
                    ? 'opacity-95 group-hover:opacity-100'
                    : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onReward(messageId, 'up', effectiveTool)}
                  disabled={currentVote !== null}
                  title="Reward this decision (+10 XP to Agent Policy)"
                  className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 font-medium transition-all ${
                    currentVote === 'up'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500'
                      : 'border-[var(--border)] bg-[var(--surface-elevated)]/50 text-[var(--muted)] hover:border-emerald-500/40 hover:text-emerald-500 disabled:opacity-40'
                  }`}
                >
                  <ThumbsUp size={11} />
                  <span>{currentVote === 'up' ? '+10 XP Rewarded' : 'Reward +10 XP'}</span>
                </button>

                {currentVote !== 'up' && (
                  <button
                    type="button"
                    onClick={() => onReward(messageId, 'down', effectiveTool)}
                    disabled={currentVote !== null}
                    title="Penalize this decision (-5 XP & adjust Agent Policy)"
                    className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 transition-all ${
                      currentVote === 'down'
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-500'
                        : 'border-[var(--border)] bg-[var(--surface-elevated)]/50 text-[var(--muted)] hover:border-amber-500/40 hover:text-amber-500 disabled:opacity-40'
                    }`}
                  >
                    <ThumbsDown size={11} />
                    {currentVote === 'down' && <span>Adjusted (-5 XP)</span>}
                  </button>
                )}

                {currentVote === 'up' && (
                  <Trophy size={12} className="ml-0.5 text-amber-500" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
