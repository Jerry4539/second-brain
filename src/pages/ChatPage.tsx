import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Cpu,
  Download,
  Edit3,
  FileText,
  Film,
  Flame,
  Globe,
  ImagePlus,
  Layers,
  MessagesSquare,
  PanelLeft,
  Paperclip,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Table as TableIcon,
  Terminal,
  Trash2,
  Trophy,
  Wand2,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Textarea'
import { IconButton } from '../components/ui/IconButton'
import { Dialog } from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import { type ArtifactPayload } from '../components/chat/MarkdownContent'
import { ChatImageCard } from '../components/chat/ChatImageCard'
import { ClaudeResponseView } from '../components/chat/ClaudeResponseView'
import { ArtifactSidePanel } from '../components/chat/ArtifactSidePanel'
import {
  decodeMessageMeta,
  encodeMessageWithMeta,
  planAgentTurn,
  type AgentStep,
  type AgentTurnMeta,
  type ResponseFormatMode,
} from '../lib/agentOrchestrator'
import {
  DEFAULT_POLICY_WEIGHTS,
  loadAgentPolicy,
  recordAgentReward,
  type AgentPolicyWeights,
} from '../lib/agentSkills'
import {
  addMessage,
  clearConversationMessages,
  createConversation,
  deleteConversation,
  deleteLastMessage,
  deleteMessage,
  deleteMessagesByIds,
  getSetting,
  insertImage,
  listConversations,
  listFavoriteConversationIds,
  listMessages,
  listModels,
  renameConversation,
  setSetting,
  toggleFavoriteConversation,
  touchConversation,
  updateConversationSettings,
  type ConversationRecord,
  type MessageRecord,
  type ModelRecord,
} from '../lib/db'
import {
  generateText,
  startTextEngine,
  stopTextEngine,
  textEngineStatus,
} from '../lib/textEngine'
import {
  generateImage,
  readImageDataUrl,
} from '../lib/imageEngine'
import { synthesizeImagePrompt } from '../lib/imagePromptSynthesizer'
import {
  collapseRepetition,
  isStreamLooping,
  sanitizeAssistantHistory,
} from '../lib/agentBrain'
import { getSystemSpecs, type SystemSpecs } from '../lib/systemInfo'
import { formatBytes } from '../lib/gguf'
import { useToast } from '../lib/toast'

type EngineState = 'idle' | 'starting' | 'running' | 'stopping'

interface Persona {
  id: string
  name: string
  badge: string
  icon: typeof Sparkles
  systemPrompt: string
}

const PERSONAS: Persona[] = [
  {
    id: 'companion',
    name: 'Chill Companion',
    badge: 'Friendly & Smart',
    icon: Sparkles,
    systemPrompt:
      'You are Second Brain — a sharp, warm, genuinely helpful AI agent and thinking partner. You talk like a smart friend: natural, direct, and honest.',
  },
  {
    id: 'coder',
    name: 'Code Architect',
    badge: 'Clean Code & Debug',
    icon: Code2,
    systemPrompt:
      'You are Second Brain in Code Architect mode — a principal software engineer. Provide clean, idiomatic, production-ready code inside fenced ```<language> blocks with concise explanations, bold section headings (`### Title`), and `> ⚠️ **Important:** ...` callouts for edge cases or performance tips.',
  },
  {
    id: 'writer',
    name: 'Creative Writer',
    badge: 'Stories & Poetry',
    icon: BookOpen,
    systemPrompt:
      'You are Second Brain in Creative Studio mode — an imaginative storyteller, prompt engineer, poet, and world-builder. Use vivid sensory details, bold section headings (`### Title`), and wrap any copyable creative prompts, scripts, or templates inside a fenced ```text block.',
  },
  {
    id: 'thinker',
    name: 'Deep Thinker',
    badge: 'First-Principles Logic',
    icon: Brain,
    systemPrompt:
      'You are Second Brain in Deep Thinker mode. Break down complex problems from first principles, lay out clear step-by-step reasoning with bold headings (`### Title`), wrap formulas/templates in ```text blocks, and synthesize sharp conclusions.',
  },
  {
    id: 'concise',
    name: 'Speed Summarizer',
    badge: 'Ultra-Crisp TL;DR',
    icon: Zap,
    systemPrompt:
      'You are Second Brain in Speed Summarizer mode. Give ultra-concise, high-signal answers using structured bullet points, tables, fenced ```text / ```code blocks, and bold key terms. Zero fluff, maximum clarity.',
  },
  {
    id: 'custom',
    name: 'Custom Tone',
    badge: 'Your Own Prompt',
    icon: SlidersHorizontal,
    systemPrompt: '',
  },
]

interface SlashCommandItem {
  cmd: string
  label: string
  description: string
  icon: typeof Sparkles
  template: string
  immediate?: 'summarize' | 'clear' | 'hardware'
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    cmd: '/web',
    label: 'web_search()',
    description: 'Search live internet (Wikipedia, DuckDuckGo, HN & Google API)',
    icon: Globe,
    template: '/web ',
  },
  {
    cmd: '/tmdb',
    label: 'query_tmdb()',
    description: 'Fetch live movies, TV series, ratings & posters via TMDB API',
    icon: Film,
    template: '/tmdb ',
  },
  {
    cmd: '/image',
    label: 'generate_image()',
    description: 'Synthesize & render local artwork in chat',
    icon: ImagePlus,
    template: 'Create an image of ',
  },
  {
    cmd: '/table',
    label: 'render_table()',
    description: 'Compare items in a sortable table & visual chart',
    icon: TableIcon,
    template: 'Compare the following in a structured Markdown table with metrics: ',
  },
  {
    cmd: '/widget',
    label: 'create_artifact()',
    description: 'Build an interactive HTML/SVG widget in the side Canvas',
    icon: Layers,
    template: 'Build a clean interactive HTML widget for: ',
  },
  {
    cmd: '/save',
    label: 'save_workspace_note()',
    description: 'Save a Markdown note or report directly to your local workspace',
    icon: FileText,
    template: '/save ',
  },
  {
    cmd: '/specs',
    label: 'inspect_hardware()',
    description: 'Run live hardware, GPU & model diagnostics',
    icon: Cpu,
    template: 'Inspect my system hardware specs and active AI models.',
    immediate: 'hardware',
  },
  {
    cmd: '/code',
    label: '/code <task>',
    description: 'Write clean, production-ready code',
    icon: Terminal,
    template: 'Write clean, well-commented code for: ',
  },
  {
    cmd: '/brainstorm',
    label: '/brainstorm <topic>',
    description: 'Generate 5 creative ideas',
    icon: Flame,
    template: 'Brainstorm 5 creative, practical, and original ideas for: ',
  },
  {
    cmd: '/summarize',
    label: '/summarize',
    description: 'Summarize our conversation into bullet points',
    icon: FileText,
    template: 'Summarize our conversation so far into crisp, actionable bullet points.',
    immediate: 'summarize',
  },
  {
    cmd: '/clear',
    label: '/clear',
    description: 'Clear messages in this conversation',
    icon: Trash2,
    template: '',
    immediate: 'clear',
  },
]

const BENTO_STARTERS = [
  {
    icon: TableIcon,
    tag: 'Data Table & Chart',
    title: 'Compare with Visual Data',
    desc: 'Interactive sortable table + instant bar chart',
    prompt:
      'Compare Qwen 2.5 1.5B, DeepSeek R1 1.5B, and Llama 3.2 3B in a Markdown table with columns for Model, Size (GB), Speed (tok/s), and Best Use Case.',
  },
  {
    icon: Layers,
    tag: 'Interactive Artifact',
    title: 'Build a Live HTML Widget',
    desc: 'Renders live in the split-screen Artifact Canvas',
    prompt:
      'Build a sleek interactive Pomodoro timer widget in a single self-contained HTML code block with dark mode styling and start/reset buttons.',
  },
  {
    icon: ImagePlus,
    tag: 'Visual Studio Tool',
    title: 'Autonomous Image Generation',
    desc: 'AI synthesizes & renders local Stable Diffusion art',
    prompt:
      'Create an image of a futuristic glass library floating above misty mountains at golden hour',
  },
  {
    icon: Cpu,
    tag: 'System Diagnostics',
    title: 'Inspect My Hardware & RAM',
    desc: 'Calls inspect_hardware() to display live telemetry',
    prompt: 'Check my system specs, Apple Metal GPU status, and installed AI models.',
  },
]

interface GenerationMetrics {
  tokensPerSec: number
  tokenCount: number
  elapsedSec: number
  ttftMs: number | null
}

interface AttachedFile {
  name: string
  content: string
  sizeBytes: number
  truncated: boolean
}

function cleanModelLabel(raw: string | undefined): string {
  if (!raw) return 'Second Brain'
  return (
    raw
      .replace(
        /\b(8k|16k|32k|128k|lc100k|mix\d+|ep\d+|instruct|gguf|q4_k_m|q4_0|q8_0|iq4_nl)\b/gi,
        '',
      )
      .replace(/[-_]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim() || raw
  )
}

function relativeTime(iso: string): string {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(diffSec) || diffSec < 45) return 'just now'
  const mins = Math.floor(diffSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function toTitleCaseWord(word: string): string {
  if (!word) return ''
  if (/^(ai|cpu|gpu|ram|gguf|lcm|html|svg|css|js|ts|sql|api|ui|ux|m4|m3|m2|m1)$/i.test(word)) {
    return word.toUpperCase()
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * AI-driven semantic title synthesizer:
 * Inspects the user's message, any invoked tool, and the AI's response (headings, bold terms, key concepts)
 * to decide a clean, human-friendly 2–5 word conversation title.
 */
function synthesizeAiChatTitle(
  userText: string,
  assistantReply = '',
  toolUsed?: string,
): string {
  const cleanUser = userText
    .replace(/^\/(image|table|widget|specs|code|brainstorm|summarize)\s*/i, '')
    .replace(/### Attached File:[\s\S]*?```[\s\S]*?```/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (toolUsed === 'inspect_hardware' || /hardware|specs|metal gpu/i.test(cleanUser)) {
    return 'System & GPU Diagnostics'
  }
  if (toolUsed === 'compute_math') {
    return 'Math & Expression Solver'
  }
  if (toolUsed === 'generate_image' || /^\/image\b/i.test(userText)) {
    const subj = cleanUser
      .replace(/^(create|generate|draw|paint|render|make)\s+(an?\s+)?(image|picture|photo|art|illustration)\s+(of\s+)?/i, '')
      .replace(/^based on our chat\s*(create an image)?/i, '')
      .trim()
    if (subj.length > 3) {
      const words = subj
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .split(/\s+/)
        .filter((w) => !/^(the|a|an|of|in|on|with|and|for|to|at)$/i.test(w))
        .slice(0, 4)
        .map(toTitleCaseWord)
      if (words.length > 0) return `${words.join(' ')} Art`
    }
    return 'AI Visual Concept Art'
  }

  // 1. Check if the AI response starts with or contains a crisp Markdown heading (# or ##)
  const cleanAssistant = decodeMessageMeta(assistantReply).cleanText
  const headingMatch = cleanAssistant.match(/^#{1,3}\s+([^\n#*`]{4,42})/m)
  if (headingMatch) {
    const h = headingMatch[1].trim().replace(/[:.]+$/, '')
    if (h.split(/\s+/).length <= 6) {
      return h
    }
  }

  // 2. Check if the user only said a greeting ("hello", "hi", "hey")
  if (/^(hi|hello|hey|yo|hola|sup|good\s+(morning|afternoon|evening))[!.?\s]*$/i.test(cleanUser)) {
    return 'Friendly Companion Chat'
  }

  // 3. Extract high-signal topic words from user prompt + assistant bold terms
  const combinedSource =
    cleanUser.length >= 8 ? cleanUser : `${cleanUser} ${cleanAssistant.slice(0, 160)}`
  const stripped = combinedSource
    .replace(
      /^(can you|could you|please|help me|tell me about|explain|what is|what are|how to|how do i|write|create|build|make|compare)\s+/i,
      '',
    )
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out',
    'against', 'during', 'without', 'before', 'under', 'around', 'among', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'this', 'that', 'these', 'those',
    'my', 'your', 'our', 'their', 'me', 'you', 'us', 'them', 'it', 'its', 'some', 'any',
  ])

  const keywords = stripped
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()))
    .slice(0, 4)
    .map(toTitleCaseWord)

  if (keywords.length >= 2) {
    return keywords.join(' ')
  }
  if (keywords.length === 1) {
    return `${keywords[0]} Discussion`
  }

  return cleanUser.slice(0, 32) || 'New AI Session'
}

function buildConversationTitle(text: string): string {
  return synthesizeAiChatTitle(text)
}

export function ChatPage() {
  const [models, setModels] = useState<ModelRecord[] | null>(null)
  const [imageModels, setImageModels] = useState<ModelRecord[]>([])
  const [specs, setSpecs] = useState<SystemSpecs | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [engineState, setEngineState] = useState<EngineState>('idle')

  // Chat History Drawer is toggled OFF by default for maximum workspace area
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Claude-Style Split-Screen Artifact Canvas
  const [activeArtifact, setActiveArtifact] = useState<ArtifactPayload | null>(null)

  // Live Agentic Steps, Reward Policy & Accessible Response Format Mode
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([])
  const [planningLabel, setPlanningLabel] = useState<string | null>(null)
  const [responseFormat, setResponseFormat] = useState<ResponseFormatMode>('auto')
  const [agentPolicy, setAgentPolicy] = useState<AgentPolicyWeights>(DEFAULT_POLICY_WEIGHTS)
  const [rewardVotes, setRewardVotes] = useState<Record<string, 'up' | 'down'>>({})
  const [toolsPopoverOpen, setToolsPopoverOpen] = useState(false)

  // Custom Bento Popovers in Top App Bar
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [toneMenuOpen, setToneMenuOpen] = useState(false)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const toneMenuRef = useRef<HTMLDivElement>(null)
  const toolsPopoverRef = useRef<HTMLDivElement>(null)

  // Persona / Tone & Custom System Prompt
  const [personaId, setPersonaId] = useState<string>('companion')
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>('')

  // Inline Conversation Rename (Top Bar + Sidebar + Manual Lock)
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [renamingSidebarId, setRenamingSidebarId] = useState<string | null>(null)
  const [sidebarTitleDraft, setSidebarTitleDraft] = useState('')
  const [manuallyNamedIds, setManuallyNamedIds] = useState<string[]>([])

  // In-conversation Message Search
  const [messageSearchOpen, setMessageSearchOpen] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')

  // Inline User Message Editing & Long-Prompt Collapse
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [expandedUserMsgIds, setExpandedUserMsgIds] = useState<Record<string, boolean>>({})
  const [editingMsgText, setEditingMsgText] = useState('')

  // File Attachments
  const [attachments, setAttachments] = useState<AttachedFile[]>([])

  // Live Streaming Telemetry
  const [liveMetrics, setLiveMetrics] = useState<GenerationMetrics | null>(null)
  const [messageMetrics, setMessageMetrics] = useState<Record<string, GenerationMetrics>>({})

  // Text-to-Speech (TTS)
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  // Inline Image Generation inside Chat
  const [activeImageGen, setActiveImageGen] = useState<{
    prompt: string
    cancel: () => void
  } | null>(null)
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})

  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [temperature, setTemperature] = useState('')
  const [topP, setTopP] = useState('')
  const [maxTokens, setMaxTokens] = useState('')

  const cancelRef = useRef<(() => void) | null>(null)
  const streamingContentRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false)
      }
      if (toneMenuRef.current && !toneMenuRef.current.contains(e.target as Node)) {
        setToneMenuOpen(false)
      }
      if (toolsPopoverRef.current && !toolsPopoverRef.current.contains(e.target as Node)) {
        setToolsPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    Promise.all([
      listModels('text').catch(() => []),
      textEngineStatus().catch(() => null),
      getSystemSpecs().catch(() => null),
      listFavoriteConversationIds().catch(() => []),
      getSetting('chat_persona_id').catch(() => null),
      getSetting('chat_custom_system_prompt').catch(() => null),
    ]).then(([list, status, sysSpecs, favs, savedPersona, savedCustomPrompt]) => {
      setModels(list)
      if (sysSpecs) setSpecs(sysSpecs)
      setFavoriteIds(favs)
      if (savedPersona && PERSONAS.some((p) => p.id === savedPersona)) {
        setPersonaId(savedPersona)
      }
      if (savedCustomPrompt) {
        setCustomSystemPrompt(savedCustomPrompt)
      }
      if (status?.running && status.model_path) {
        setEngineState('running')
        const runningModel = list.find((m) => m.path === status.model_path)
        if (runningModel) {
          setSelectedModelId(runningModel.id)
          return
        }
      }
      const defaultModel = list.find((m) => m.is_default === 1) ?? list[0]
      if (defaultModel) setSelectedModelId(defaultModel.id)
    })
    listModels('image').then(setImageModels).catch(() => setImageModels([]))
    listConversations().then(setConversations).catch(() => setConversations([]))
    loadAgentPolicy().then(setAgentPolicy).catch(() => {})

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    if (!showScrollBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, streaming, activeImageGen, showScrollBottom])

  function handleScrollStream() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBottom(distanceFromBottom > 140)
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setShowScrollBottom(false)
  }

  useEffect(() => {
    messages.forEach((m) => {
      const match = m.content.match(/\[generated_image:\s*([^|]+)\|\s*([^\]]+)\]/i)
      if (match) {
        const filePath = match[2].trim()
        if (filePath && !imageDataUrls[m.id]) {
          readImageDataUrl(filePath)
            .then((url) => {
              setImageDataUrls((prev) => ({ ...prev, [m.id]: url }))
            })
            .catch(() => {})
        }
      }
    })
  }, [messages, imageDataUrls])

  const selectedModel = models?.find((m) => m.id === selectedModelId) ?? null
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null
  const activePersona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]

  function getEffectiveSystemPrompt(extraAddition = ''): string {
    const base =
      personaId === 'custom' && customSystemPrompt.trim()
        ? customSystemPrompt.trim()
        : activePersona.systemPrompt || PERSONAS[0].systemPrompt
    return extraAddition ? `${base}\n\n${extraAddition}` : base
  }

  async function handleSelectPersona(id: string) {
    setPersonaId(id)
    await setSetting('chat_persona_id', id).catch(() => {})
    if (id !== 'custom') {
      setToneMenuOpen(false)
    }
  }

  async function handleSaveCustomPrompt() {
    await setSetting('chat_custom_system_prompt', customSystemPrompt).catch(() => {})
    setToneMenuOpen(false)
    showToast('Custom tone saved', 'success')
  }

  async function openConversation(conversation: ConversationRecord) {
    setActiveId(conversation.id)
    setTemperature(conversation.temperature != null ? String(conversation.temperature) : '')
    setTopP(conversation.top_p != null ? String(conversation.top_p) : '')
    setMaxTokens(conversation.max_tokens != null ? String(conversation.max_tokens) : '')
    setMessages(await listMessages(conversation.id))
    setEditingMsgId(null)
    setRenamingTitle(false)
  }

  function openNewChat() {
    if (streaming) cancelRef.current?.()
    setActiveId(null)
    setMessages([])
    setTemperature('')
    setTopP('')
    setMaxTokens('')
    setEditingMsgId(null)
    setRenamingTitle(false)
    setActiveArtifact(null)
  }

  async function handleDeleteConversation(id: string) {
    if (streaming && id === activeId) cancelRef.current?.()
    await deleteConversation(id)
    const updated = await listConversations()
    setConversations(updated)
    if (id === activeId) openNewChat()
    showToast('Conversation deleted', 'info')
  }

  async function handleTogglePinConversation(id: string) {
    const isFav = favoriteIds.includes(id)
    await toggleFavoriteConversation(id, !isFav)
    setFavoriteIds(await listFavoriteConversationIds())
  }

  async function handleCommitRename() {
    if (!activeId || !titleDraft.trim()) {
      setRenamingTitle(false)
      return
    }
    const clean = titleDraft.trim()
    await renameConversation(activeId, clean)
    setManuallyNamedIds((prev) => (prev.includes(activeId) ? prev : [...prev, activeId]))
    setConversations(await listConversations())
    setRenamingTitle(false)
    showToast('Chat renamed', 'success')
  }

  async function handleCommitSidebarRename(id: string) {
    if (!sidebarTitleDraft.trim()) {
      setRenamingSidebarId(null)
      return
    }
    const clean = sidebarTitleDraft.trim()
    await renameConversation(id, clean)
    setManuallyNamedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setConversations(await listConversations())
    setRenamingSidebarId(null)
    showToast('Chat renamed', 'success')
  }

  async function handleAiSmartTitle() {
    if (!activeId) return
    const nonGreetingUser =
      [...messages]
        .reverse()
        .find(
          (m) =>
            m.role === 'user' &&
            !/^(hi|hello|hey|yo|sup)[!.?\s]*$/i.test(m.content.trim()),
        ) ?? messages.find((m) => m.role === 'user')
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    const smartTitle = synthesizeAiChatTitle(
      nonGreetingUser?.content || activeConversation?.title || '',
      lastAssistant?.content || '',
    )
    await renameConversation(activeId, smartTitle)
    setConversations(await listConversations())
    showToast(`AI named chat: "${smartTitle}"`, 'info')
  }

  async function handleSaveSettings() {
    if (activeId) {
      const parsedTemp = temperature.trim() === '' ? null : Number(temperature)
      const parsedTopP = topP.trim() === '' ? null : Number(topP)
      const parsedMax = maxTokens.trim() === '' ? null : Math.round(Number(maxTokens))
      if (
        (parsedTemp != null && Number.isNaN(parsedTemp)) ||
        (parsedTopP != null && Number.isNaN(parsedTopP)) ||
        (parsedMax != null && (Number.isNaN(parsedMax) || parsedMax <= 0))
      ) {
        showToast('Enter valid numbers for parameters', 'warning')
        return
      }
      await updateConversationSettings(activeId, {
        temperature: parsedTemp,
        topP: parsedTopP,
        maxTokens: parsedMax,
      })
      setConversations(await listConversations())
    }
    setSettingsOpen(false)
    showToast('Parameters updated', 'success')
  }

  async function handleStart(modelToStart = selectedModel): Promise<boolean> {
    if (!modelToStart) return false
    if (engineState === 'running') return true
    setEngineState('starting')
    try {
      await startTextEngine(modelToStart.path)
      setEngineState('running')
      return true
    } catch (error) {
      console.error(error)
      setEngineState('idle')
      showToast(`Failed to start model: ${String(error)}`, 'warning')
      return false
    }
  }

  async function handleStop() {
    if (streaming) cancelRef.current?.()
    setEngineState('stopping')
    try {
      await stopTextEngine()
    } finally {
      setEngineState('idle')
    }
  }

  async function handleModelSelectChange(newModelId: string) {
    setSelectedModelId(newModelId)
    setModelMenuOpen(false)
    const nextModel = models?.find((m) => m.id === newModelId)
    if (!nextModel) return
    if (streaming) cancelRef.current?.()
    setEngineState('starting')
    try {
      if (engineState === 'running') {
        await stopTextEngine()
      }
      await startTextEngine(nextModel.path)
      setEngineState('running')
      showToast(`Loaded ${cleanModelLabel(nextModel.name)} — Warm & Ready`, 'success')
    } catch (err) {
      setEngineState('idle')
      showToast(`Failed to load model: ${String(err)}`, 'warning')
    }
  }

  async function ensureConversation(firstMessage: string): Promise<string> {
    if (activeId) return activeId
    const id = crypto.randomUUID()
    const title = buildConversationTitle(firstMessage)
    await createConversation(id, title, selectedModelId || null)
    const parsedTemp = temperature.trim() === '' ? null : Number(temperature)
    const parsedTopP = topP.trim() === '' ? null : Number(topP)
    const parsedMax = maxTokens.trim() === '' ? null : Math.round(Number(maxTokens))
    if (parsedTemp != null || parsedTopP != null || parsedMax != null) {
      await updateConversationSettings(id, {
        temperature: parsedTemp,
        topP: parsedTopP,
        maxTokens: parsedMax,
      })
    }
    setActiveId(id)
    setConversations(await listConversations())
    return id
  }

  async function triggerInlineImageGen(
    conversationId: string,
    rawPrompt: string,
    initialSteps: AgentStep[],
  ) {
    let imgModel = imageModels.find((m) => m.is_default === 1) ?? imageModels[0]
    if (!imgModel) {
      const refreshed = await listModels('image').catch(() => [])
      setImageModels(refreshed)
      imgModel = refreshed.find((m) => m.is_default === 1) ?? refreshed[0]
    }

    if (!imgModel) {
      const assistantMsgId = crypto.randomUUID()
      const meta: AgentTurnMeta = {
        toolUsed: 'generate_image',
        steps: [
          ...initialSteps.map((s) => ({ ...s, status: 'done' as const })),
          {
            id: 's3',
            type: 'tool_result',
            title: 'No local image model found in database',
            detail: 'Prompting user to install a compact GGUF image model',
            status: 'done',
          },
        ],
      }
      const msgContent = encodeMessageWithMeta('[missing_image_model]', meta)
      await addMessage(assistantMsgId, conversationId, 'assistant', msgContent)
      setMessages(await listMessages(conversationId))
      return
    }

    const isLcm = Boolean(
      imgModel.architecture === 'LCM' ||
        imgModel.name.toLowerCase().includes('lcm') ||
        imgModel.path.toLowerCase().includes('lcm'),
    )
    const isTurbo = Boolean(
      imgModel.name.toLowerCase().includes('turbo') ||
        imgModel.path.toLowerCase().includes('turbo'),
    )
    const isFast = isLcm || isTurbo
    const synthesized = await synthesizeImagePrompt({
      rawPrompt,
      history: messages.map((m) => ({
        role: m.role,
        content: decodeMessageMeta(m.content).cleanText,
      })),
      isTextEngineRunning: engineState === 'running',
    })

    const standardNegative =
      'ugly, deformed, noisy, blurry, low contrast, oversaturated, grainy, pixelated, bad anatomy, mutated, extra limbs, artifacts'
    const targetSteps = isFast ? 10 : 28
    const targetCfg = isLcm ? 1.8 : isTurbo ? 1.8 : 7.5

    const { result, cancel } = generateImage({
      modelPath: imgModel.path,
      prompt: synthesized.visualPrompt,
      negativePrompt: standardNegative,
      width: 512,
      height: 512,
      steps: targetSteps,
      cfgScale: targetCfg,
      samplingMethod: isLcm ? 'lcm' : 'euler_a',
    })

    setActiveImageGen({ prompt: synthesized.aiConcept || rawPrompt, cancel })

    try {
      const filePath = await result
      const imageId = crypto.randomUUID()
      await insertImage({
        id: imageId,
        prompt: synthesized.visualPrompt,
        negativePrompt: standardNegative,
        filePath,
        seed: null,
        steps: targetSteps,
        modelId: imgModel.id,
        width: 512,
        height: 512,
      })

      const dataUrl = await readImageDataUrl(filePath)
      const assistantMsgId = crypto.randomUUID()
      const meta: AgentTurnMeta = {
        toolUsed: 'generate_image',
        imagePrompt: synthesized.visualPrompt,
        steps: [
          ...initialSteps.map((s) => ({ ...s, status: 'done' as const })),
          {
            id: 's3',
            type: 'tool_result',
            title: `Synthesized visual prompt (${synthesized.usedLLM ? 'LLM Context' : 'Smart Heuristic'})`,
            detail: synthesized.visualPrompt,
            status: 'done',
          },
          {
            id: 's4',
            type: 'tool_result',
            title: `Rendered 512×512 PNG with ${imgModel.name}`,
            status: 'done',
          },
        ],
      }
      const msgContent = encodeMessageWithMeta(
        `[generated_image: ${synthesized.aiConcept || rawPrompt} | ${filePath}]`,
        meta,
      )

      setImageDataUrls((prev) => ({ ...prev, [assistantMsgId]: dataUrl }))
      await addMessage(assistantMsgId, conversationId, 'assistant', msgContent)
      await touchConversation(conversationId)

      if (!manuallyNamedIds.includes(conversationId)) {
        const existingConv = conversations.find((c) => c.id === conversationId)
        const isGeneric =
          !existingConv ||
          /^(New Chat|New AI Session|Friendly Companion Chat|AI Visual Concept Art|Hello|Hi|Hey)$/i.test(
            existingConv.title.trim(),
          )
        if (isGeneric) {
          const aiTitle = synthesizeAiChatTitle(
            synthesized.aiConcept || rawPrompt,
            '',
            'generate_image',
          )
          await renameConversation(conversationId, aiTitle)
        }
      }

      setMessages(await listMessages(conversationId))
      setConversations(await listConversations())
    } catch (error) {
      const errText = String(error)
      if (!errText.includes('cancelled')) {
        showToast(`Image generation failed: ${errText}`, 'warning')
      }
    } finally {
      setActiveImageGen(null)
    }
  }

  /**
   * Unified Agentic Turn Executor:
   * 1. Runs `planAgentTurn()` to think & decide which tool/operation to invoke
   * 2. Executes tool (e.g. `generate_image`, `inspect_hardware`, `compute_math`, `render_table`, `create_artifact`)
   * 3. Streams response with embedded AgentTurnMeta and auto-opens artifacts when created
   */
  async function executeAgenticTurn(
    conversationId: string,
    userPrompt: string,
    historyMessages: MessageRecord[],
  ) {
    const cleanFullHistory = historyMessages
      .map((m) => {
        const text = decodeMessageMeta(m.content).cleanText
        return {
          role: m.role,
          content: m.role === 'assistant' ? sanitizeAssistantHistory(text) : text,
        }
      })
      .filter(
        (m) =>
          m.content.trim().length > 0 &&
          !m.content.includes('[generated_image:') &&
          !m.content.includes('[missing_image_model]'),
      )

    // Make sure the local model is up first — the agent brain uses it to think about the request
    const wantsImageOnly = responseFormat === 'image' || /^\/(image|imagine|draw)\b/i.test(userPrompt)
    let engineReady = engineState === 'running'
    if (!wantsImageOnly && !engineReady) {
      const started = await handleStart()
      if (!started) return
      engineReady = true
    }

    setPlanningLabel('Understanding what you need…')
    let plan: Awaited<ReturnType<typeof planAgentTurn>>
    try {
      plan = await planAgentTurn(
        userPrompt,
        cleanModelLabel(selectedModel?.name),
        responseFormat,
        cleanFullHistory,
      )
    } finally {
      setPlanningLabel(null)
    }
    if (
      responseFormat === 'image' ||
      responseFormat === 'widget' ||
      responseFormat === 'web' ||
      responseFormat === 'tmdb'
    ) {
      setResponseFormat('auto')
    }

    // Route to Image Generation Tool if decided
    if (plan.tool === 'generate_image' && plan.imageSubject) {
      await triggerInlineImageGen(conversationId, plan.imageSubject, plan.steps)
      return
    }

    if (!engineReady) {
      const started = await handleStart()
      if (!started) return
    }

    const turnMeta: AgentTurnMeta = {
      toolUsed: plan.tool,
      steps: plan.steps,
      decisionConfidence: plan.decisionConfidence,
      knowledgeDecision: plan.knowledgeDecision,
      clarificationWidget: plan.clarificationWidget,
      recalledMemories: plan.recalledMemories,
      newMemorySaved: plan.newMemorySaved,
      systemWidget: plan.systemWidget,
      mathWidget: plan.mathWidget,
      tmdbWidget: plan.tmdbWidget,
      webSearchWidget: plan.webSearchWidget,
      weatherWidget: plan.weatherWidget,
      workspaceNoteWidget: plan.workspaceNoteWidget,
    }
    if (plan.newMemorySaved) {
      loadAgentPolicy().then(setAgentPolicy).catch(() => {})
    }

    const assistantMsgId = crypto.randomUUID()
    streamingContentRef.current = ''
    setLiveSteps(plan.steps)
    setStreaming(true)
    setLiveMetrics({ tokensPerSec: 0, tokenCount: 0, elapsedSec: 0, ttftMs: null })

    const startTime = performance.now()
    let firstTokenTime: number | null = null
    let chunkCount = 0
    let loopStopped = false

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        conversation_id: conversationId,
        role: 'assistant',
        content: encodeMessageWithMeta('', turnMeta),
        created_at: new Date().toISOString(),
      },
    ])

    const finalize = async () => {
      const rawStreamed = collapseRepetition(streamingContentRef.current).text
      const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000)
      const finalMetrics: GenerationMetrics = {
        tokensPerSec: Number((chunkCount / elapsedSec).toFixed(1)),
        tokenCount: chunkCount,
        elapsedSec: Number(elapsedSec.toFixed(1)),
        ttftMs: firstTokenTime ? Math.round(firstTokenTime - startTime) : null,
      }
      setMessageMetrics((prev) => ({ ...prev, [assistantMsgId]: finalMetrics }))
      setLiveMetrics(null)
      setLiveSteps([])
      setStreaming(false)
      cancelRef.current = null

      if (rawStreamed.trim() || turnMeta.systemWidget || turnMeta.mathWidget) {
        const persistedContent = encodeMessageWithMeta(rawStreamed, turnMeta)
        await addMessage(assistantMsgId, conversationId, 'assistant', persistedContent)
        await touchConversation(conversationId)

        // Let AI decide/refine the conversation title on initial turns or after a greeting
        if (!manuallyNamedIds.includes(conversationId)) {
          const existingConv = conversations.find((c) => c.id === conversationId)
          const isGenericTitle =
            !existingConv ||
            /^(New Chat|New AI Session|Friendly Companion Chat|Hello|Hi|Hey)$/i.test(
              existingConv.title.trim(),
            ) ||
            historyMessages.length <= 2
          if (isGenericTitle) {
            const aiDecidedTitle = synthesizeAiChatTitle(userPrompt, rawStreamed, plan.tool)
            if (aiDecidedTitle && aiDecidedTitle !== existingConv?.title) {
              await renameConversation(conversationId, aiDecidedTitle)
            }
          }
        }

        setConversations(await listConversations())

        // Auto-open in Split-Screen Artifact Canvas if an HTML or SVG block was generated!
        const htmlOrSvgMatch = rawStreamed.match(/```(html|svg)\n([\s\S]*?)```/i)
        if (htmlOrSvgMatch) {
          const lang = htmlOrSvgMatch[1].toLowerCase() as 'html' | 'svg'
          const code = htmlOrSvgMatch[2].trim()
          setActiveArtifact({
            id: `auto-artifact-${assistantMsgId}`,
            title: `Interactive ${lang.toUpperCase()} Widget`,
            kind: lang,
            language: lang,
            content: code,
          })
        }
      }
    }

    const parsedTemp =
      temperature.trim() === '' ? plan.recommendedTemperature : Number(temperature)
    const parsedTopP = topP.trim() === '' ? undefined : Number(topP)
    // Sensible default cap so a small model can never ramble forever
    const parsedMax = maxTokens.trim() === '' ? 1800 : Math.round(Number(maxTokens))

    const windowedHistory = cleanFullHistory.slice(-28)
    const recentHistory = windowedHistory.map((m, idx) => {
      const isOlderAssistantTurn =
        m.role === 'assistant' && idx < windowedHistory.length - 6 && m.content.length > 420
      return {
        role: m.role,
        content: isOlderAssistantTurn ? `${m.content.slice(0, 380)}…` : m.content,
      }
    })

    // Recency-anchor recalled user memories on multi-turn chats so small local models never suffer attention decay
    const effectiveAugmentedPrompt =
      plan.recalledMemories.length > 0 &&
      cleanFullHistory.length >= 4 &&
      !plan.augmentedPrompt.includes('VERIFIED USER MEMORY VAULT')
        ? `${plan.augmentedPrompt}\n\n[Remembered User Facts: ${plan.recalledMemories.slice(0, 5).join(' | ')}]`
        : plan.augmentedPrompt

    const { cancel } = await generateText({
      prompt: effectiveAugmentedPrompt,
      settings: {
        temperature: parsedTemp,
        top_p: parsedTopP,
        max_tokens: parsedMax,
        messages: recentHistory,
        system_prompt: getEffectiveSystemPrompt(plan.systemAddition),
      },
      onToken: (token) => {
        if (firstTokenTime === null) {
          firstTokenTime = performance.now()
        }
        chunkCount += 1
        const now = performance.now()
        const elapsed = Math.max(0.05, (now - startTime) / 1000)
        setLiveMetrics({
          tokensPerSec: Number((chunkCount / elapsed).toFixed(1)),
          tokenCount: chunkCount,
          elapsedSec: Number(elapsed.toFixed(1)),
          ttftMs: Math.round(firstTokenTime - startTime),
        })

        if (loopStopped) return
        streamingContentRef.current += token
        // Repetition guard: if the model starts looping, stop it and keep the clean part
        if (chunkCount % 24 === 0 && isStreamLooping(streamingContentRef.current)) {
          loopStopped = true
          streamingContentRef.current = collapseRepetition(streamingContentRef.current).text
          cancelRef.current?.()
        }
        const wrappedCurrent = encodeMessageWithMeta(streamingContentRef.current, turnMeta)
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: wrappedCurrent } : m)),
        )
      },
      onDone: () => {
        void finalize()
      },
      onError: (message) => {
        showToast(`Generation error: ${message}`, 'warning')
        void finalize()
      },
    })
    cancelRef.current = cancel
  }

  async function handleSend(overridePrompt?: string) {
    const rawInput = (overridePrompt !== undefined ? overridePrompt : input).trim()
    if ((!rawInput && attachments.length === 0) || streaming) return

    if (rawInput.toLowerCase() === '/clear') {
      setInput('')
      if (activeId) {
        await clearConversationMessages(activeId)
        setMessages([])
        showToast('Conversation cleared', 'info')
      }
      return
    }

    let fullPrompt = rawInput
    if (attachments.length > 0) {
      const attachmentBlocks = attachments
        .map(
          (a) =>
            `### Attached File: \`${a.name}\`${a.truncated ? ' (truncated)' : ''}\n\`\`\`\n${a.content}\n\`\`\``,
        )
        .join('\n\n')
      fullPrompt = fullPrompt
        ? `${attachmentBlocks}\n\n${fullPrompt}`
        : `Please analyze the attached file(s):\n\n${attachmentBlocks}`
      setAttachments([])
    }

    if (overridePrompt === undefined) setInput('')
    const conversationId = await ensureConversation(rawInput || 'File Analysis')

    const userMsgId = crypto.randomUUID()
    const userMsg: MessageRecord = {
      id: userMsgId,
      conversation_id: conversationId,
      role: 'user',
      content: fullPrompt,
      created_at: new Date().toISOString(),
    }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    await addMessage(userMsgId, conversationId, 'user', fullPrompt)
    await touchConversation(conversationId)
    setConversations(await listConversations())

    await executeAgenticTurn(conversationId, fullPrompt, updatedHistory)
  }

  async function handleRegenerate() {
    if (!activeId || streaming) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return

    await deleteLastMessage(activeId)
    const remainingHistory = messages.slice(0, -1)
    setMessages(remainingHistory)
    await executeAgenticTurn(activeId, lastUser.content, remainingHistory)
  }

  async function handleSaveEditedMessage(msg: MessageRecord) {
    if (!activeId || streaming || !editingMsgText.trim()) return
    const idx = messages.findIndex((m) => m.id === msg.id)
    if (idx === -1) return

    const idsToDelete = messages.slice(idx).map((m) => m.id)
    await deleteMessagesByIds(idsToDelete)

    const newText = editingMsgText.trim()
    setEditingMsgId(null)
    const newUserMsgId = crypto.randomUUID()
    const newUserMsg: MessageRecord = {
      id: newUserMsgId,
      conversation_id: activeId,
      role: 'user',
      content: newText,
      created_at: new Date().toISOString(),
    }

    const updatedHistory = [...messages.slice(0, idx), newUserMsg]
    setMessages(updatedHistory)
    await addMessage(newUserMsgId, activeId, 'user', newText)
    await touchConversation(activeId)
    setConversations(await listConversations())

    await executeAgenticTurn(activeId, newText, updatedHistory)
  }

  async function handleDeleteSingleMessage(msgId: string) {
    if (!activeId || streaming) return
    await deleteMessage(msgId)
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
  }

  async function handleAttachFile() {
    try {
      const selected = await open({
        multiple: false,
        title: 'Attach a text or code file',
        filters: [
          {
            name: 'Text & Code Files',
            extensions: [
              'txt', 'md', 'json', 'csv', 'ts', 'tsx', 'js', 'jsx',
              'py', 'rs', 'go', 'html', 'css', 'sql', 'yaml', 'yml', 'toml', 'sh', 'log',
            ],
          },
        ],
      })
      if (!selected) return
      const path = Array.isArray(selected) ? selected[0] : selected
      if (!path) return
      const info = await invoke<{
        name: string
        content: string
        size_bytes: number
        truncated: boolean
      }>('read_text_attachment', { path })
      setAttachments((prev) => [
        ...prev.filter((a) => a.name !== info.name),
        {
          name: info.name,
          content: info.content,
          sizeBytes: info.size_bytes,
          truncated: info.truncated,
        },
      ])
      showToast(`Attached ${info.name}`, 'success')
    } catch (error) {
      showToast(`Could not read file: ${String(error)}`, 'warning')
    }
  }

  function handleExportConversation(format: 'md' | 'json') {
    if (messages.length === 0) return
    const title = activeConversation?.title || 'Second Brain Chat'

    if (format === 'json') {
      const payload = JSON.stringify(
        {
          title,
          exportedAt: new Date().toISOString(),
          model: selectedModel?.name ?? null,
          persona: activePersona.name,
          messages: messages.map((m) => ({
            ...m,
            content: decodeMessageMeta(m.content).cleanText,
          })),
        },
        null,
        2,
      )
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Exported as JSON', 'success')
      return
    }

    const mdLines = [
      `# ${title}`,
      `*Exported from Second Brain • Model: ${selectedModel?.name ?? 'Local GGUF'} • Tone: ${activePersona.name}*`,
      '',
      ...messages.map(
        (m) =>
          `### ${m.role === 'user' ? 'You' : 'Second Brain'}\n\n${
            decodeMessageMeta(m.content).cleanText
          }\n`,
      ),
    ]
    const mdText = mdLines.join('\n')
    const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Exported as Markdown', 'success')
  }

  function handleToggleSpeak(msgId: string, text: string) {
    if (!('speechSynthesis' in window)) {
      showToast('Speech synthesis is not supported on this system', 'warning')
      return
    }
    if (speakingId === msgId) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      return
    }
    window.speechSynthesis.cancel()
    const cleanSpeech = text
      .replace(/```[\s\S]*?```/g, ' Code block. ')
      .replace(/[*#_`~>-]/g, '')
    const utterance = new SpeechSynthesisUtterance(cleanSpeech)
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(msgId)
    window.speechSynthesis.speak(utterance)
  }

  function handleCopy(id: string, content: string) {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    showToast('Copied to clipboard (+5 Agent XP)', 'success')
    recordAgentReward(5, 'copy_output', 'User copied agent output', true)
      .then(setAgentPolicy)
      .catch(() => {})
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleRewardResponse(
    msgId: string,
    vote: 'up' | 'down',
    toolUsed: string,
  ) {
    if (rewardVotes[msgId]) return
    setRewardVotes((prev) => ({ ...prev, [msgId]: vote }))
    const delta = vote === 'up' ? 10 : -5
    const updatedPolicy = await recordAgentReward(
      delta,
      toolUsed,
      vote === 'up' ? 'User rewarded decision (+10 XP)' : 'User penalized decision (-5 XP)',
      false,
    )
    setAgentPolicy(updatedPolicy)
    showToast(
      vote === 'up'
        ? `🏆 +10 XP! Agent reinforced ${toolUsed}() policy (Total: ${updatedPolicy.totalXp} XP)`
        : `Adjusted ${toolUsed}() policy weight (-5 XP)`,
      vote === 'up' ? 'success' : 'info',
    )
  }

  const matchingSlashCommands = useMemo(() => {
    const trimmed = input.trimStart()
    if (!trimmed.startsWith('/') || trimmed.includes(' ')) return []
    const q = trimmed.toLowerCase()
    return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q))
  }, [input])

  function applySlashCommand(item: SlashCommandItem) {
    setToolsPopoverOpen(false)
    if (item.immediate === 'clear') {
      handleSend('/clear')
      return
    }
    if (item.immediate === 'summarize' || item.immediate === 'hardware') {
      handleSend(item.template)
      return
    }
    setInput(item.template)
    textareaRef.current?.focus()
  }

  const filteredConversations = useMemo(() => {
    const list = conversations.filter((c) => {
      if (showFavoritesOnly && !favoriteIds.includes(c.id)) return false
      return c.title.toLowerCase().includes(chatSearch.toLowerCase())
    })
    return list.sort((a, b) => {
      const aFav = favoriteIds.includes(a.id) ? 1 : 0
      const bFav = favoriteIds.includes(b.id) ? 1 : 0
      if (aFav !== bFav) return bFav - aFav
      return 0
    })
  }, [conversations, favoriteIds, showFavoritesOnly, chatSearch])

  const visibleMessages = useMemo(() => {
    if (!messageSearch.trim()) return messages
    const q = messageSearch.toLowerCase()
    return messages.filter((m) => m.content.toLowerCase().includes(q))
  }, [messages, messageSearch])

  if (models === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <LoadingState label="Loading local models…" />
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState
          icon={MessagesSquare}
          title="No text models installed"
          description="Go to the Models page to 1-click download a featherweight 101 MB model or import your own .gguf file."
          action={
            <Link to="/models">
              <Button>Explore Models</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const ActivePersonaIcon = activePersona.icon

  return (
    <div className="flex h-full min-h-0 w-full select-none gap-3 overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. COLLAPSIBLE BENTO HISTORY DRAWER (Default Toggled OFF for Max Space)   */}
      {/* ========================================================================= */}
      {historyOpen && (
        <aside className="flex h-full w-68 shrink-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-[var(--text)]">
                Chats
              </span>
              <span className="rounded-full bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                {filteredConversations.length}
              </span>
              <button
                type="button"
                onClick={() => setShowFavoritesOnly((v) => !v)}
                className={`ml-0.5 flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  showFavoritesOnly
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]'
                }`}
                title="Show pinned only"
              >
                <Star size={10} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                <span>Pinned</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openNewChat}
                className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
              <IconButton
                label="Hide chats"
                onClick={() => setHistoryOpen(false)}
                className="h-6 w-6"
              >
                <X size={13} />
              </IconButton>
            </div>
          </div>

          {conversations.length > 2 && (
            <div className="relative mb-2.5">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                type="text"
                placeholder="Search chats…"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 py-1.5 pl-7 pr-7 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              {chatSearch && (
                <button
                  type="button"
                  onClick={() => setChatSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
            {filteredConversations.length === 0 && (
              <div className="py-10 text-center text-xs text-[var(--muted)]">
                {chatSearch || showFavoritesOnly ? 'No matching chats' : 'No saved chats yet'}
              </div>
            )}
            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeId
              const isPinned = favoriteIds.includes(conversation.id)
              const isRenamingThis = renamingSidebarId === conversation.id
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2 transition-all ${
                    isActive
                      ? 'bg-[var(--surface-elevated)] text-[var(--text)] ring-1 ring-[var(--accent)]/40'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)]/60 hover:text-[var(--text)]'
                  }`}
                >
                  {isRenamingThis ? (
                    <input
                      type="text"
                      value={sidebarTitleDraft}
                      onChange={(e) => setSidebarTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitSidebarRename(conversation.id)
                        if (e.key === 'Escape') setRenamingSidebarId(null)
                      }}
                      onBlur={() => handleCommitSidebarRename(conversation.id)}
                      autoFocus
                      className="w-full rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text)] focus:outline-none"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openConversation(conversation)}
                        className="flex min-w-0 flex-1 flex-col text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          {isPinned && (
                            <Star
                              size={10}
                              className="shrink-0 text-amber-500"
                              fill="currentColor"
                            />
                          )}
                          <span className="truncate text-xs font-medium text-[var(--text)]">
                            {conversation.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--muted)]">
                          {relativeTime(conversation.updated_at)}
                        </span>
                      </button>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <IconButton
                          label="Rename"
                          className="h-6 w-6 hover:text-[var(--accent)]"
                          onClick={() => {
                            setRenamingSidebarId(conversation.id)
                            setSidebarTitleDraft(conversation.title)
                          }}
                        >
                          <Edit3 size={11} />
                        </IconButton>
                        <IconButton
                          label={isPinned ? 'Unpin' : 'Pin'}
                          className={`h-6 w-6 ${isPinned ? 'text-amber-500' : 'hover:text-amber-500'}`}
                          onClick={() => handleTogglePinConversation(conversation.id)}
                        >
                          <Star size={11} fill={isPinned ? 'currentColor' : 'none'} />
                        </IconButton>
                        <IconButton
                          label="Delete"
                          className="h-6 w-6 hover:text-red-500"
                          onClick={() => handleDeleteConversation(conversation.id)}
                        >
                          <Trash2 size={11} />
                        </IconButton>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN BENTO CHAT COLUMN                                                 */}
      {/* ========================================================================= */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        {/* TOP BENTO BAR */}
        <header className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 shadow-[var(--shadow-sm)]">
          {/* Left: History Toggle + New Chat + Active Title */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-all ${
                historyOpen
                  ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface-elevated)]/60 text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              title="Toggle chat history"
            >
              <PanelLeft size={14} />
              <span className="hidden sm:inline">Chats</span>
              {conversations.length > 0 && (
                <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.2 text-[10px] font-semibold">
                  {conversations.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={openNewChat}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
              title="New chat"
            >
              <Plus size={15} />
            </button>

            <div className="mx-0.5 h-4 w-[1px] bg-[var(--border)]" />

            {renamingTitle && activeConversation ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename()
                    if (e.key === 'Escape') setRenamingTitle(false)
                  }}
                  onBlur={handleCommitRename}
                  autoFocus
                  className="w-44 rounded-lg border border-[var(--accent)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text)] focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (activeConversation) {
                      setTitleDraft(activeConversation.title)
                      setRenamingTitle(true)
                    }
                  }}
                  title={activeConversation ? 'Click to rename chat' : undefined}
                  className="group flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  <span className="max-w-[140px] truncate text-xs font-semibold text-[var(--text)] md:max-w-[240px]">
                    {activeConversation?.title || 'New Chat'}
                  </span>
                  {activeConversation && (
                    <Edit3
                      size={11}
                      className="shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]"
                    />
                  )}
                </button>
                {activeConversation && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAiSmartTitle}
                    title="Let AI decide a smart title for this chat"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--accent)]"
                  >
                    <Wand2 size={12} />
                  </button>
                )}
              </div>
            )}

            {streaming && liveMetrics && (
              <span className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-500 sm:inline-flex">
                <Zap size={10} />
                {liveMetrics.tokensPerSec} tok/s
              </span>
            )}
          </div>

          {/* Right: Custom Bento Model Popover, Tone Popover, Tuning & Theme */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Custom Bento Model Picker Popover */}
            <div ref={modelMenuRef} className="relative">
              <div className="flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 px-2.5 text-xs transition-colors hover:border-[var(--accent)]/40">
                <button
                  type="button"
                  onClick={() => {
                    setModelMenuOpen((v) => !v)
                    setToneMenuOpen(false)
                  }}
                  disabled={engineState === 'starting' || engineState === 'stopping'}
                  className="flex items-center gap-1.5 focus:outline-none"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      engineState === 'running'
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                        : engineState === 'starting'
                        ? 'animate-ping bg-amber-500'
                        : 'bg-zinc-400'
                    }`}
                  />
                  <span className="max-w-[130px] truncate font-medium text-[var(--text)] sm:max-w-[165px]">
                    {cleanModelLabel(selectedModel?.name)}
                  </span>
                  <ChevronDown size={12} className="text-[var(--muted)]" />
                </button>

                {engineState === 'running' ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="ml-0.5 rounded p-0.5 text-[var(--muted)] transition-colors hover:text-red-500"
                    title="Stop model & free RAM"
                  >
                    <Square size={10} fill="currentColor" />
                  </button>
                ) : engineState === 'idle' && selectedModel ? (
                  <button
                    type="button"
                    onClick={() => handleStart(selectedModel)}
                    className="ml-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/25"
                    title="Load model into RAM"
                  >
                    Load
                  </button>
                ) : null}
              </div>

              {modelMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl">
                  <div className="mb-1.5 flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Local Model
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {engineState === 'running' ? '● Warm in RAM' : '○ Auto-start'}
                    </span>
                  </div>
                  <div className="max-h-60 space-y-1 overflow-y-auto">
                    {models.map((m) => {
                      const active = m.id === selectedModelId
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleModelSelectChange(m.id)}
                          className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                            active
                              ? 'bg-[var(--accent)]/12 font-semibold text-[var(--accent)]'
                              : 'text-[var(--text)] hover:bg-[var(--surface-elevated)]'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="truncate">{cleanModelLabel(m.name)}</div>
                            <div className="text-[10px] font-normal text-[var(--muted)]">
                              {formatBytes(m.size_bytes ?? 0)}
                              {m.quantization ? ` • ${m.quantization}` : ''}
                            </div>
                          </div>
                          {active && <Check size={13} className="shrink-0 text-[var(--accent)]" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Bento Tone Picker Popover */}
            <div ref={toneMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setToneMenuOpen((v) => !v)
                  setModelMenuOpen(false)
                }}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 px-2.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]/40"
                title="Switch AI Tone"
              >
                <ActivePersonaIcon size={13} className="shrink-0 text-[var(--accent)]" />
                <span className="hidden sm:inline">{activePersona.name}</span>
                <ChevronDown size={12} className="text-[var(--muted)]" />
              </button>

              {toneMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl">
                  <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Conversation Tone
                  </div>
                  <div className="space-y-1">
                    {PERSONAS.map((p) => {
                      const Icon = p.icon
                      const active = p.id === personaId
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPersona(p.id)}
                          className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                            active
                              ? 'bg-[var(--accent)]/12 text-[var(--accent)]'
                              : 'text-[var(--text)] hover:bg-[var(--surface-elevated)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                active
                                  ? 'bg-[var(--accent)] text-white'
                                  : 'bg-[var(--surface-elevated)] text-[var(--muted)]'
                              }`}
                            >
                              <Icon size={13} />
                            </div>
                            <div>
                              <div className="font-semibold">{p.name}</div>
                              <div className="text-[10px] text-[var(--muted)]">{p.badge}</div>
                            </div>
                          </div>
                          {active && <Check size={13} className="shrink-0 text-[var(--accent)]" />}
                        </button>
                      )
                    })}
                  </div>

                  {personaId === 'custom' && (
                    <div className="mt-2 border-t border-[var(--border)] pt-2">
                      <Textarea
                        rows={3}
                        value={customSystemPrompt}
                        onChange={(e) => setCustomSystemPrompt(e.target.value)}
                        placeholder="Write custom instructions for how Second Brain should respond…"
                        className="mb-2 text-xs"
                      />
                      <Button className="h-7 w-full text-xs" onClick={handleSaveCustomPrompt}>
                        Save Custom Tone
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              to="/settings"
              title="Open Agent Control Center & Reward Policy Settings"
              className="hidden items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-500 transition-colors hover:bg-amber-500/20 md:inline-flex"
            >
              <Trophy size={12} />
              <span>Lv.{agentPolicy.level}</span>
              <span className="font-mono text-[10px] opacity-85">{agentPolicy.totalXp} XP</span>
            </Link>

            {messages.length > 2 && (
              <IconButton
                label="Search messages"
                onClick={() => {
                  setMessageSearchOpen((v) => !v)
                  if (messageSearchOpen) setMessageSearch('')
                }}
                className={`h-8 w-8 ${messageSearchOpen ? 'text-[var(--accent)]' : ''}`}
              >
                <Search size={14} />
              </IconButton>
            )}

            <IconButton
              label="Parameters & Export"
              onClick={() => setSettingsOpen(true)}
              className="h-8 w-8"
            >
              <SlidersHorizontal size={14} />
            </IconButton>

            <ThemeToggle />
          </div>
        </header>

        {messageSearchOpen && (
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5">
            <Search size={13} className="text-[var(--muted)]" />
            <input
              type="text"
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
              placeholder="Filter messages in this conversation…"
              autoFocus
              className="flex-1 bg-transparent text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none"
            />
            <span className="text-[10px] text-[var(--muted)]">
              {visibleMessages.length} / {messages.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setMessageSearch('')
                setMessageSearchOpen(false)
              }}
              className="text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MAIN BENTO WORKSPACE CARD (Claude-Style Editorial Stream + Composer)  */}
        {/* ===================================================================== */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          {/* Scrollable Stream */}
          <div
            ref={scrollRef}
            onScroll={handleScrollStream}
            className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8"
          >
            {messages.length === 0 ? (
              /* SLEEK BENTO EMPTY STATE */
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-4">
                {specs && (
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)]/60 px-3 py-1 text-[11px] font-medium text-[var(--muted)]">
                    <Cpu size={12} className="text-[var(--accent)]" />
                    <span>
                      {specs.is_apple_silicon
                        ? `${specs.cpu_brand} • Metal GPU`
                        : specs.acceleration}
                    </span>
                  </div>
                )}

                <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)]">
                  What would you like to build, visualize, or explore?
                </h2>
                <p className="mt-1 text-center text-xs text-[var(--muted)]">
                  Autonomous tool calling • Interactive tables & charts • Live Artifact Canvas
                </p>

                {/* 2x2 Bento Starter Cards */}
                <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  {BENTO_STARTERS.map((card) => {
                    const Icon = card.icon
                    return (
                      <button
                        key={card.title}
                        type="button"
                        onClick={() => handleSend(card.prompt)}
                        className="group flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/45 p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-elevated)] hover:shadow-[var(--shadow-sm)]"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="rounded-lg bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                            {card.tag}
                          </span>
                          <Icon
                            size={15}
                            className="text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[var(--text)]">
                            {card.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {card.desc}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* CHATGPT / CLAUDE OPEN EDITORIAL CONVERSATION STREAM */
              <div className="mx-auto w-full max-w-3xl space-y-7 py-2">
                {visibleMessages.map((message, index) => {
                  const isUser = message.role === 'user'
                  const fullIndex = messages.findIndex((m) => m.id === message.id)
                  const isLast = fullIndex === messages.length - 1
                  const isCopied = copiedId === message.id
                  const isSpeaking = speakingId === message.id
                  const isEditing = editingMsgId === message.id
                  const metrics = messageMetrics[message.id]

                  if (isUser) {
                    return (
                      <div key={message.id || `msg-${index}`} className="group flex justify-end">
                        <div className="flex max-w-[78%] flex-col items-end gap-1.5">
                          {isEditing ? (
                            <div className="w-full min-w-[280px] rounded-2xl border border-[var(--accent)] bg-[var(--surface-elevated)] p-3 sm:min-w-[400px]">
                              <Textarea
                                rows={3}
                                value={editingMsgText}
                                onChange={(e) => setEditingMsgText(e.target.value)}
                                className="mb-2 text-xs"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => setEditingMsgId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  className="h-7 px-3 text-xs"
                                  onClick={() => handleSaveEditedMessage(message)}
                                >
                                  Save & Run
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-3xl rounded-tr-md bg-[var(--accent)] px-4.5 py-3 text-[15px] leading-relaxed text-white shadow-xs">
                              {message.content.length > 160 ||
                              message.content.split('\n').length > 3 ? (
                                <div>
                                  <p
                                    className={`whitespace-pre-wrap ${
                                      expandedUserMsgIds[message.id] ? '' : 'line-clamp-2'
                                    }`}
                                  >
                                    {message.content}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedUserMsgIds((prev) => ({
                                        ...prev,
                                        [message.id]: !prev[message.id],
                                      }))
                                    }
                                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-white/85 transition-colors hover:text-white"
                                  >
                                    <span>
                                      {expandedUserMsgIds[message.id] ? 'Show less' : 'Show more'}
                                    </span>
                                    <ChevronDown
                                      size={13}
                                      className={`transition-transform ${
                                        expandedUserMsgIds[message.id] ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{message.content}</p>
                              )}
                            </div>
                          )}

                          {!isEditing && !streaming && (
                            <div className="flex items-center gap-1 px-1 text-[11px] text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleCopy(message.id, message.content)}
                                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                              >
                                {isCopied ? (
                                  <Check size={11} className="text-emerald-500" />
                                ) : (
                                  <Copy size={11} />
                                )}
                                <span>{isCopied ? 'Copied' : 'Copy'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsgId(message.id)
                                  setEditingMsgText(message.content)
                                }}
                                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                              >
                                <Edit3 size={11} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSingleMessage(message.id)}
                                className="rounded-md px-1 py-0.5 hover:bg-[var(--surface-elevated)] hover:text-red-500"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <ClaudeResponseView
                      key={message.id || `msg-${index}`}
                      messageId={message.id}
                      rawContent={message.content}
                      isLast={isLast}
                      streaming={streaming}
                      liveSteps={liveSteps}
                      tokensPerSec={metrics?.tokensPerSec}
                      isCopied={isCopied}
                      isSpeaking={isSpeaking}
                      imageDataUrl={imageDataUrls[message.id]}
                      rewardState={rewardVotes[message.id] ?? null}
                      onCopy={handleCopy}
                      onSpeak={handleToggleSpeak}
                      onRetry={handleRegenerate}
                      onDelete={handleDeleteSingleMessage}
                      onOpenArtifact={(artifact) => {
                        setActiveArtifact(artifact)
                        recordAgentReward(5, 'create_artifact', 'Opened Artifact Canvas', true)
                          .then(setAgentPolicy)
                          .catch(() => {})
                      }}
                      onReward={handleRewardResponse}
                      onClarificationSubmit={(refinedPrompt) => handleSend(refinedPrompt)}
                    />
                  )
                })}

                {planningLabel && (
                  <div className="flex justify-start gap-4 py-1.5">
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Sparkles size={14} className="animate-pulse" />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[13px] text-[var(--muted)]">
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
                      </span>
                      <span>{planningLabel}</span>
                    </div>
                  </div>
                )}

                {activeImageGen && (
                  <div className="flex justify-start gap-4 py-1.5">
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Sparkles size={14} className="animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <ChatImageCard prompt={activeImageGen.prompt} generating={true} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {showScrollBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--text)] shadow-md"
              >
                <ArrowDown size={12} className="text-[var(--accent)]" />
                <span>Latest</span>
              </button>
            )}
          </div>

          {/* ================================================================= */}
          {/* SLEEK UNIFIED BENTO COMPOSER BAR WITH AI TOOLS MENU               */}
          {/* ================================================================= */}
          <div className="shrink-0 border-t border-[var(--border)]/60 bg-[var(--surface)] px-4 py-3 md:px-8">
            <div className="relative mx-auto max-w-3xl">
              {/* Slash Command or Tools Menu Popup */}
              {(matchingSlashCommands.length > 0 || toolsPopoverOpen) && (
                <div
                  ref={toolsPopoverRef}
                  className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
                >
                  <div className="mb-1 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    AI Functions & Actions
                  </div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {(matchingSlashCommands.length > 0
                      ? matchingSlashCommands
                      : SLASH_COMMANDS
                    ).map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.cmd}
                          type="button"
                          onClick={() => applySlashCommand(item)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--surface-elevated)]"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent)]">
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-xs font-semibold text-[var(--text)]">
                              {item.label}
                            </div>
                            <div className="truncate text-[10px] text-[var(--muted)]">
                              {item.description}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Attached File Chips */}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {attachments.map((att) => (
                    <div
                      key={att.name}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-1 text-xs text-[var(--text)]"
                    >
                      <FileText size={12} className="text-[var(--accent)]" />
                      <span className="max-w-[160px] truncate font-medium">{att.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((a) => a.name !== att.name))
                        }
                        className="text-[var(--muted)] hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Clean Single-Row Bento Composer Input Bar */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 px-2.5 py-2 shadow-xs transition-colors focus-within:border-[var(--accent)]/60 focus-within:bg-[var(--surface-elevated)]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAttachFile}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                    title="Attach file"
                  >
                    <Paperclip size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setToolsPopoverOpen((v) => !v)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      toolsPopoverOpen
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                    }`}
                    title="Slash commands & AI actions (/)"
                  >
                    <Wrench size={14} />
                  </button>

                  {responseFormat !== 'auto' && (
                    <button
                      type="button"
                      onClick={() => setResponseFormat('auto')}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--accent)]/15 px-2 py-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/25"
                      title="Click to reset to Auto Agent mode"
                    >
                      <span className="capitalize">{responseFormat}</span>
                      <X size={11} />
                    </button>
                  )}

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    placeholder="Ask anything…"
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    className="max-h-32 min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none"
                  />

                  {streaming ? (
                    <button
                      type="button"
                      onClick={() => cancelRef.current?.()}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-500 transition-colors hover:bg-red-500/25"
                      title="Stop generating"
                    >
                      <Square size={13} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSend()}
                      disabled={!input.trim() && attachments.length === 0}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-xs transition-all hover:opacity-90 disabled:opacity-35"
                      title="Send message (Enter)"
                    >
                      <ArrowUp size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CLAUDE-STYLE SPLIT-SCREEN ARTIFACT CANVAS (Right Side Panel)           */}
      {/* ========================================================================= */}
      {activeArtifact && (
        <ArtifactSidePanel
          artifact={activeArtifact}
          onClose={() => setActiveArtifact(null)}
        />
      )}

      {/* ===================================================================== */}
      {/* GENERATION PARAMETERS & EXPORT DIALOG                                 */}
      {/* ===================================================================== */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Sampling Parameters & Export"
        description="Fine-tune generation creativity, token limits, or export this conversation."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3 text-xs text-[var(--text)]">
              <span className="font-semibold">Temperature</span>
              <span className="text-[10px] text-[var(--muted)]">Creativity (0.1–1.5)</span>
              <Input
                value={temperature}
                placeholder="0.7"
                onChange={(e) => setTemperature(e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3 text-xs text-[var(--text)]">
              <span className="font-semibold">Top P</span>
              <span className="text-[10px] text-[var(--muted)]">Nucleus (0.1–1.0)</span>
              <Input
                value={topP}
                placeholder="0.9"
                onChange={(e) => setTopP(e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3 text-xs text-[var(--text)]">
              <span className="font-semibold">Max Tokens</span>
              <span className="text-[10px] text-[var(--muted)]">Reply length limit</span>
              <Input
                value={maxTokens}
                placeholder="1024"
                onChange={(e) => setMaxTokens(e.target.value)}
                className="mt-1"
              />
            </label>
          </div>

          {messages.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
              <div>
                <div className="text-xs font-semibold text-[var(--text)]">Export Transcript</div>
                <div className="text-[10px] text-[var(--muted)]">
                  Save {messages.length} messages to disk
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  onClick={() => handleExportConversation('md')}
                >
                  <Download size={12} className="mr-1.5" />
                  Markdown
                </Button>
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  onClick={() => handleExportConversation('json')}
                >
                  <Code2 size={12} className="mr-1.5" />
                  JSON
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save Parameters</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
