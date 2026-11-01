import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  Check,
  Copy,
  Cpu,
  ImagePlus,
  Lightbulb,
  BookOpen,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  User,
  Wand2,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { IconButton } from '../components/ui/IconButton'
import { Dialog } from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import { MarkdownContent } from '../components/chat/MarkdownContent'
import { ChatImageCard } from '../components/chat/ChatImageCard'
import {
  addMessage,
  createConversation,
  deleteConversation,
  deleteLastMessage,
  getSetting,
  insertImage,
  listConversations,
  listMessages,
  listModels,
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
} from '../lib/textEngine'
import {
  generateImage,
  readImageDataUrl,
} from '../lib/imageEngine'
import { synthesizeImagePrompt } from '../lib/imagePromptSynthesizer'
import { useToast } from '../lib/toast'

type EngineState = 'idle' | 'starting' | 'running' | 'stopping'

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const STARTER_PROMPTS = [
  {
    icon: Sparkles,
    title: 'Poetic & Playful',
    prompt: 'Can you write a poetic, witty, and playful message for me? Make it charming and fun.',
  },
  {
    icon: Lightbulb,
    title: 'Explain Simply',
    prompt: 'Explain how local AI models work inside an offline desktop app like I am five years old.',
  },
  {
    icon: BookOpen,
    title: 'Creative Short Story',
    prompt: 'Write an intriguing 3-paragraph short story that begins on a rainy evening in an old bookshop.',
  },
  {
    icon: ImagePlus,
    title: 'Generate Artwork',
    prompt: '/image A serene Japanese Zen garden in autumn with vibrant red maple leaves and stone lanterns',
  },
]

export function ChatPage() {
  const [models, setModels] = useState<ModelRecord[] | null>(null)
  const [imageModels, setImageModels] = useState<ModelRecord[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [engineState, setEngineState] = useState<EngineState>('idle')

  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [chatSearch, setChatSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // In-chat image generation state: maps messageId or 'pending-image' to generation state
  const [activeImageGen, setActiveImageGen] = useState<{
    prompt: string
    cancel?: () => void
  } | null>(null)
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [imageModeDialog, setImageModeDialog] = useState(false)
  const [customImagePrompt, setCustomImagePrompt] = useState('')
  const [temperature, setTemperature] = useState('')
  const [topP, setTopP] = useState('')
  const [maxTokens, setMaxTokens] = useState('')

  const cancelRef = useRef<(() => void) | null>(null)
  const streamingContentRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    listModels('text').then((list) => {
      setModels(list)
      const defaultModel = list.find((m) => m.is_default === 1) ?? list[0]
      if (defaultModel) setSelectedModelId(defaultModel.id)
    })
    listModels('image').then(setImageModels).catch(() => [])
    listConversations().then(setConversations)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming, activeImageGen])

  // Resolve image data URLs for any saved [generated_image: ... | filePath] in messages
  useEffect(() => {
    messages.forEach(async (m) => {
      const match = m.content.match(/\[generated_image:\s*([^|]+)\|\s*([^\]]+)\]/i)
      if (match) {
        const filePath = match[2].trim()
        if (!imageDataUrls[m.id]) {
          try {
            const dataUrl = await readImageDataUrl(filePath)
            setImageDataUrls((prev) => ({ ...prev, [m.id]: dataUrl }))
          } catch {
            // File might have been moved or removed
          }
        }
      }
    })
  }, [messages])

  const selectedModel = models?.find((m) => m.id === selectedModelId) ?? null
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null

  useEffect(() => {
    setTemperature(activeConversation?.temperature?.toString() ?? '')
    setTopP(activeConversation?.top_p?.toString() ?? '')
    setMaxTokens(activeConversation?.max_tokens?.toString() ?? '')
  }, [activeConversation])

  async function handleStart() {
    if (!selectedModel) return
    setEngineState('starting')
    try {
      await startTextEngine(selectedModel.path)
      setEngineState('running')
      showToast(`${selectedModel.name} is ready`, 'success')
    } catch (error) {
      setEngineState('idle')
      showToast(String(error), 'warning')
    }
  }

  async function handleStop() {
    setEngineState('stopping')
    await stopTextEngine()
    setEngineState('idle')
  }

  function openNewChat() {
    setActiveId(null)
    setMessages([])
    textareaRef.current?.focus()
  }

  async function openConversation(conversation: ConversationRecord) {
    setActiveId(conversation.id)
    setMessages(await listMessages(conversation.id))
  }

  async function handleDeleteConversation(id: string) {
    if (!window.confirm('Delete this conversation?')) return
    await deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) openNewChat()
  }

  function currentSettings() {
    return {
      temperature: temperature ? Number(temperature) : undefined,
      top_p: topP ? Number(topP) : undefined,
      max_tokens: maxTokens ? Number(maxTokens) : undefined,
    }
  }

  async function handleSaveSettings() {
    if (activeId) {
      await updateConversationSettings(activeId, {
        temperature: temperature ? Number(temperature) : null,
        topP: topP ? Number(topP) : null,
        maxTokens: maxTokens ? Math.round(Number(maxTokens)) : null,
      })
      setConversations(await listConversations())
    }
    setSettingsOpen(false)
  }

  /**
   * Triggers the local image model to create an image, conceptualizing user intent from chat history.
   */
  async function triggerImageGeneration(
    conversationId: string,
    rawPrompt: string,
    historySnapshot?: MessageRecord[]
  ) {
    if (imageModels.length === 0) {
      const noticeId = crypto.randomUUID()
      const noticeMsg = `I would love to create an artwork for you, but no local image model is imported yet. Go to the [Models](/models) tab to import an SD1.5 or LCM model.`
      await addMessage(noticeId, conversationId, 'assistant', noticeMsg)
      setMessages((prev) => [
        ...prev,
        { id: noticeId, conversation_id: conversationId, role: 'assistant', content: noticeMsg, created_at: '' },
      ])
      return
    }

    const defaultImgModel = imageModels.find((m) => m.is_default === 1) ?? imageModels[0]
    const isLcm = Boolean(
      defaultImgModel.architecture === 'LCM' ||
        defaultImgModel.name.toLowerCase().includes('lcm') ||
        defaultImgModel.path.toLowerCase().includes('lcm')
    )
    const isTurbo = Boolean(
      defaultImgModel.name.toLowerCase().includes('turbo') ||
        defaultImgModel.path.toLowerCase().includes('turbo')
    )
    const steps = isLcm || isTurbo ? 6 : 20
    const cfgScale = isLcm ? 1.8 : isTurbo ? 1.5 : 7.0
    const defaultNegativePrompt =
      'deformed, distorted, disfigured, poorly drawn, bad anatomy, mutated, extra limbs, blurry, out of focus, duplicate, low quality, artifacts'

    // Add temporary assistant placeholder indicating thoughtful comprehension
    const pendingMsgId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      {
        id: pendingMsgId,
        conversation_id: conversationId,
        role: 'assistant',
        content: `Reflecting on our conversation and visualizing the concept...`,
        created_at: '',
      },
    ])

    try {
      const storedUserName = await getSetting('user_name')
      const storedBotName = await getSetting('bot_name')

      const historyMessages = (historySnapshot ?? messages)
        .filter((m) => m.id !== 'pending' && m.content.trim())
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))

      // Synthesize rich visual prompt using chat history and thoughts
      const { visualPrompt, aiConcept } = await synthesizeImagePrompt({
        rawPrompt,
        history: historyMessages,
        userName: storedUserName || 'User',
        botName: storedBotName || selectedModel?.name || 'Second Brain',
        isTextEngineRunning: engineState === 'running',
      })

      // Update placeholder with the synthesized visual concept
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsgId
            ? {
                ...m,
                content: `Generating artwork for: *${visualPrompt}*...\n\n💡 *AI Concept: ${aiConcept}*`,
              }
            : m
        )
      )

      setActiveImageGen({ prompt: visualPrompt })

      const { result, cancel } = generateImage({
        modelPath: defaultImgModel.path,
        prompt: visualPrompt,
        negativePrompt: defaultNegativePrompt,
        width: 512,
        height: 512,
        steps,
        cfgScale,
        samplingMethod: isLcm ? 'lcm' : undefined,
      })

      setActiveImageGen({ prompt: visualPrompt, cancel })

      const filePath = await result
      const imageId = crypto.randomUUID()

      // Save to database
      await insertImage({
        id: imageId,
        prompt: visualPrompt,
        negativePrompt: null,
        filePath,
        seed: null,
        steps,
        modelId: defaultImgModel.id,
        width: 512,
        height: 512,
      })

      const dataUrl = await readImageDataUrl(filePath)
      setImageDataUrls((prev) => ({ ...prev, [pendingMsgId]: dataUrl }))

      const persistedContent = `Here is your generated artwork:\n\n> 💡 **AI Visual Concept**: *${aiConcept}*\n> 🎨 **Rendered Prompt**: *"${visualPrompt}"*\n\n[generated_image: ${visualPrompt} | ${filePath}]`
      await addMessage(pendingMsgId, conversationId, 'assistant', persistedContent)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsgId ? { ...m, content: persistedContent } : m
        )
      )
      await touchConversation(conversationId)
      setConversations(await listConversations())
      showToast('Artwork created from your thoughts and chat context', 'success')
    } catch (err) {
      const errMsg = String(err)
      if (!errMsg.includes('cancelled')) {
        showToast(`Image generation failed: ${errMsg}`, 'warning')
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsgId
            ? { ...m, content: `Image generation was cancelled or encountered an error: ${errMsg}` }
            : m
        )
      )
    } finally {
      setActiveImageGen(null)
    }
  }

  async function runGeneration(
    conversationId: string,
    prompt: string,
    historySnapshot?: MessageRecord[],
  ) {
    // Check if the prompt is an image command (/image ...)
    const imageCmdMatch = prompt.match(/^\/image\s+(.+)/i)
    if (imageCmdMatch) {
      await triggerImageGeneration(conversationId, imageCmdMatch[1].trim(), historySnapshot)
      return
    }

    // Check if user specifically requested image creation via natural language
    const naturalImageMatch = prompt.match(/^(?:please\s+)?(?:generate|create|draw|paint|visualize)\s+(?:an?\s+)?(?:image|picture|artwork|illustration)\s+(?:of\s+)?(.+)/i)
    if (naturalImageMatch && imageModels.length > 0) {
      await triggerImageGeneration(conversationId, prompt, historySnapshot)
      return
    }

    const history = (historySnapshot ?? messages)
      .filter((m) => m.id !== 'pending' && m.content.trim())
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    history.push({ role: 'user', content: prompt })

    setMessages((prev) => [
      ...prev,
      { id: 'pending', conversation_id: conversationId, role: 'assistant', content: '', created_at: '' },
    ])
    setStreaming(true)
    streamingContentRef.current = ''

    async function persistAndFinish() {
      setStreaming(false)
      cancelRef.current = null
      const content = streamingContentRef.current

      // Check if the LLM output contained an [image: <prompt>] trigger
      const imageTriggerMatch = content.match(/\[image:\s*([^\]]+)\]/i)

      if (content.trim()) {
        const finalContent = content
        await addMessage(crypto.randomUUID(), conversationId, 'assistant', finalContent)
      }
      await touchConversation(conversationId)
      setConversations(await listConversations())

      // If the LLM called the image model
      if (imageTriggerMatch) {
        const imgPrompt = imageTriggerMatch[1].trim()
        await triggerImageGeneration(conversationId, imgPrompt, historySnapshot)
      }
    }

    const { cancel } = await generateText({
      prompt,
      settings: {
        ...currentSettings(),
        messages: history,
      },
      onToken: (token) => {
        streamingContentRef.current += token
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: streamingContentRef.current,
          }
          return next
        })
      },
      onDone: persistAndFinish,
      onError: (message) => {
        persistAndFinish()
        showToast(message, 'warning')
      },
    })
    cancelRef.current = cancel
  }

  async function handleSend(customText?: string) {
    const prompt = (customText ?? input).trim()
    if (!prompt) return

    // If it's an image command, we don't necessarily need the text engine running
    const isImageCmd = prompt.startsWith('/image ') || prompt.match(/^(?:please\s+)?(?:generate|create|draw|paint)\s+(?:an?\s+)?image/i)
    if (!isImageCmd && engineState !== 'running') {
      showToast('Start the text engine first to chat with AI', 'info')
      return
    }

    if (!customText) setInput('')

    let conversationId = activeId
    if (!conversationId) {
      conversationId = crypto.randomUUID()
      const title = prompt.length > 42 ? `${prompt.slice(0, 42)}…` : prompt
      await createConversation(conversationId, title, selectedModelId || null)
      setActiveId(conversationId)
      setConversations(await listConversations())
    }

    const userMessageId = crypto.randomUUID()
    await addMessage(userMessageId, conversationId, 'user', prompt)
    const userMessage: MessageRecord = {
      id: userMessageId,
      conversation_id: conversationId!,
      role: 'user',
      content: prompt,
      created_at: '',
    }
    const prior = [...messages]
    setMessages([...prior, userMessage])

    await runGeneration(conversationId, prompt, prior)
  }

  async function handleRegenerate() {
    if (!activeId || streaming) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    let trimmed = [...messages]
    if (trimmed[trimmed.length - 1]?.role === 'assistant') {
      await deleteLastMessage(activeId)
      trimmed = trimmed.slice(0, -1)
      setMessages(trimmed)
    }
    const prior = trimmed.filter((m) => m.id !== lastUser.id)
    await runGeneration(activeId, lastUser.content, prior)
  }

  function handleCopy(id: string, content: string) {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    showToast('Copied to clipboard', 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(chatSearch.toLowerCase())
  )

  if (models === null) {
    return (
      <div className="flex h-full flex-col justify-center items-center">
        <LoadingState label="Loading local models…" />
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={MessagesSquare}
          title="No text models installed"
          description="Go to the Models page to download a fast local model or import your own .gguf file."
          action={
            <Link to="/models">
              <Button>Explore Models</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full min-h-0 select-none overflow-hidden">
      {/* ========================================================================= */}
      {/* LEFT BENTO STACK: Model Hub & Conversation Navigator (col-span-4)         */}
      {/* ========================================================================= */}
      <div className="lg:col-span-4 flex flex-col gap-3 h-full min-h-0">
        {/* Bento Tile 1: Model & Engine Hub */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <Cpu size={15} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                Local Intelligence
              </span>
            </div>

            {/* Engine Status Badge */}
            {engineState === 'idle' && (
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                Idle
              </span>
            )}
            {engineState === 'starting' && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                Starting…
              </span>
            )}
            {engineState === 'running' && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready
              </span>
            )}
            {engineState === 'stopping' && (
              <span className="flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                Stopping…
              </span>
            )}
          </div>

          {/* Model Selector & Control Button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                disabled={engineState !== 'idle'}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </Select>
            </div>

            {engineState === 'idle' && (
              <Button
                onClick={handleStart}
                disabled={!selectedModel}
                className="shrink-0 px-3.5"
              >
                Start
              </Button>
            )}
            {engineState === 'running' && (
              <Button
                variant="secondary"
                onClick={handleStop}
                className="shrink-0 px-3 hover:border-red-500/40 hover:text-red-500"
              >
                Stop
              </Button>
            )}
          </div>

          {/* Quick Engine Meta & Image Model Pill */}
          <div className="flex items-center justify-between border-t border-[var(--border)]/60 pt-2.5 text-[11px] text-[var(--muted)]">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1 hover:text-[var(--text)] transition-colors"
            >
              <Settings2 size={12} />
              <span>Params: T {temperature || '0.7'} · P {topP || '0.9'}</span>
            </button>

            {/* Image Engine Status Indicator */}
            {imageModels.length > 0 ? (
              <span
                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"
                title={`${imageModels.length} local image model(s) available`}
              >
                <Sparkles size={11} />
                <span>Image Gen Ready</span>
              </span>
            ) : (
              <Link
                to="/models"
                className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                title="Click to import an SD image model"
              >
                <ImagePlus size={11} />
                <span>No SD Model</span>
              </Link>
            )}
          </div>
        </div>

        {/* Bento Tile 2: Conversations Navigator */}
        <div className="flex-1 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Chats
              </span>
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.2 text-[10px] font-semibold text-[var(--muted)]">
                {conversations.length}
              </span>
            </div>

            <Button
              onClick={openNewChat}
              className="h-7 text-xs px-2.5 py-0 shadow-xs"
            >
              <Plus size={13} className="mr-1" />
              New
            </Button>
          </div>

          {/* Search filter if conversations exist */}
          {conversations.length > 4 && (
            <div className="relative mb-2.5">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search chats…"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-1 pl-8 pr-2 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          {/* Conversations Scroll List */}
          <div className="flex-1 space-y-1 overflow-y-auto pr-1">
            {filteredConversations.length === 0 && (
              <div className="py-8 text-center text-xs text-[var(--muted)]">
                {chatSearch ? 'No chats found matching search.' : 'No conversations yet.'}
              </div>
            )}
            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeId
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-150 ${
                    isActive
                      ? 'bg-[var(--surface-elevated)] text-[var(--text)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--accent)]/40'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)]/60 hover:text-[var(--text)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openConversation(conversation)}
                    className="flex min-w-0 flex-1 flex-col text-left"
                  >
                    <span className="truncate text-xs font-medium text-[var(--text)]">
                      {conversation.title}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {relativeTime(conversation.updated_at)}
                    </span>
                  </button>
                  <IconButton
                    label="Delete conversation"
                    className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                    onClick={() => handleDeleteConversation(conversation.id)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT BENTO ARENA: Chat Stream, Inline Image Cards, Input Dock (col-span-8) */}
      {/* ========================================================================= */}
      <div className="lg:col-span-8 flex flex-col gap-3 h-full min-h-0">
        {/* Bento Tile 3: Active Session Header */}
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-[var(--shadow-sm)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-sm font-semibold text-[var(--text)] truncate max-w-sm">
              {activeConversation?.title || 'New Conversation'}
            </h2>
            <span className="hidden sm:inline-block text-[11px] text-[var(--muted)] truncate">
              {selectedModel ? `via ${selectedModel.name}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Image Tool Button */}
            <Button
              variant="secondary"
              className="text-xs h-7 px-2.5"
              onClick={() => setImageModeDialog(true)}
              title="Quickly generate an image in this chat"
            >
              <ImagePlus size={13} className="mr-1 text-[var(--accent)]" />
              <span>Imagine Image</span>
            </Button>

            <IconButton
              label="Generation parameters"
              onClick={() => setSettingsOpen(true)}
              className="h-7 w-7"
            >
              <Settings2 size={14} />
            </IconButton>
          </div>
        </div>

        {/* Bento Tile 4: Main Chat Stream */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-5 overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-inner min-h-0"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] shadow-[var(--shadow-sm)] mb-3">
                <Sparkles size={24} />
              </div>
              <h3 className="text-base font-semibold text-[var(--text)]">
                Second Brain Intelligence
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
                {engineState === 'running'
                  ? 'Your offline models are ready. Ask a question, brainstorm ideas, or type /image to generate artwork.'
                  : 'Click "Start" on the left to fire up your model, then begin chatting.'}
              </p>

              {/* Bento Starter Prompt Cards (NO EMOJIS) */}
              <div className="mt-6 grid max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2 text-left w-full">
                {STARTER_PROMPTS.map((sp) => {
                  const Icon = sp.icon
                  return (
                    <button
                      key={sp.title}
                      type="button"
                      onClick={() => {
                        handleSend(sp.prompt)
                      }}
                      className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3.5 text-left transition-all duration-150 hover:border-[var(--accent)] hover:shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--accent)] border border-[var(--border)]">
                          <Icon size={13} />
                        </div>
                        <span className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                          {sp.title}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                        {sp.prompt}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Render Chat Messages */}
          {messages.map((message, index) => {
            const isUser = message.role === 'user'
            const isLast = index === messages.length - 1
            const isCopied = copiedId === message.id

            // Check if message content has an embedded generated image
            const generatedImgMatch = message.content.match(
              /\[generated_image:\s*([^|]+)\|\s*([^\]]+)\]/i
            )
            const cleanContent = generatedImgMatch
              ? message.content.replace(/\[generated_image:[^\]]+\]/i, '').trim()
              : message.content

            return (
              <div
                key={message.id || `msg-${index}`}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] shadow-sm">
                    <Bot size={17} />
                  </div>
                )}

                <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end max-w-[80%]' : 'items-start max-w-[85%]'}`}>
                  {/* Sender Name */}
                  <div className="px-1 text-[11px] font-medium text-[var(--muted)]">
                    {isUser ? 'You' : (selectedModel?.name ?? 'Second Brain')}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-5 py-3.5 text-sm shadow-[var(--shadow-sm)] ${
                      isUser
                        ? 'rounded-tr-xs bg-[var(--accent)] text-white leading-relaxed'
                        : 'rounded-tl-xs border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text)]'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{cleanContent}</p>
                    ) : (
                      <>
                        {cleanContent && <MarkdownContent content={cleanContent} />}
                        {streaming && isLast && (
                          <span className="inline-block h-3.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] ml-1" />
                        )}

                        {/* Inline Generated Image Card if detected */}
                        {generatedImgMatch && (
                          <ChatImageCard
                            prompt={generatedImgMatch[1].trim()}
                            filePath={generatedImgMatch[2].trim()}
                            dataUrl={imageDataUrls[message.id]}
                          />
                        )}
                      </>
                    )}
                  </div>

                  {/* Action Bar for Assistant */}
                  {!isUser && cleanContent && (
                    <div className="flex items-center gap-1 px-1 pt-0.5 text-xs text-[var(--muted)]">
                      <button
                        type="button"
                        onClick={() => handleCopy(message.id, cleanContent)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                      >
                        {isCopied ? (
                          <>
                            <Check size={12} className="text-emerald-500" />
                            <span className="text-emerald-500 text-[11px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>

                      {isLast && !streaming && (
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                        >
                          <RefreshCw size={12} />
                          <span className="text-[11px]">Retry</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--border)]">
                    <User size={15} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Active Inline Image Generation HUD in Chat */}
          {activeImageGen && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] shadow-sm">
                <Wand2 size={17} className="animate-pulse" />
              </div>
              <div className="flex flex-col gap-1 items-start max-w-lg w-full">
                <div className="px-1 text-[11px] font-medium text-[var(--muted)]">
                  Second Brain Studio
                </div>
                <ChatImageCard
                  prompt={activeImageGen.prompt}
                  generating={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bento Tile 5: Smart Input Dock */}
        <div className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-card)] flex flex-col gap-2">
          {/* Quick Helper Line */}
          <div className="flex items-center justify-between px-1 text-[11px] text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setInput((prev) => (prev.startsWith('/image ') ? prev : `/image ${prev}`))
                  textareaRef.current?.focus()
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-all ${
                  input.startsWith('/image ')
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-semibold'
                    : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                title="Prefix prompt with /image to generate pictures directly"
              >
                <ImagePlus size={12} />
                <span>Image Prompt</span>
              </button>
              <span className="hidden sm:inline-block">Type /image &lt;prompt&gt; to create pictures</span>
            </div>

            <span className="hidden sm:inline-block">Enter to send · Shift+Enter for newline</span>
          </div>

          {/* Text Input Row */}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              rows={2}
              value={input}
              placeholder={
                engineState === 'running'
                  ? 'Ask anything, or type /image to generate an artwork…'
                  : 'Type message or start text engine on left to chat…'
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="border-0 bg-transparent shadow-none focus:ring-0 resize-none text-sm min-h-[46px]"
            />

            {streaming ? (
              <Button
                variant="secondary"
                onClick={() => cancelRef.current?.()}
                className="shrink-0 mb-1"
              >
                <Square size={14} />
                Stop
              </Button>
            ) : (
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="shrink-0 mb-1 shadow-sm"
              >
                <Send size={14} />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Generation Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Generation Settings"
        description={
          activeConversation
            ? 'Adjust model hyperparameters for this conversation.'
            : 'Adjust model hyperparameters for new conversations.'
        }
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text)]">
            <span className="font-medium">Temperature ({temperature || '0.7 default'})</span>
            <span className="text-[11px] text-[var(--muted)]">Higher = more creative & diverse, lower = more focused.</span>
            <Input
              value={temperature}
              placeholder="0.7"
              onChange={(e) => setTemperature(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text)]">
            <span className="font-medium">Top P ({topP || '0.9 default'})</span>
            <span className="text-[11px] text-[var(--muted)]">Nucleus sampling threshold.</span>
            <Input
              value={topP}
              placeholder="0.9"
              onChange={(e) => setTopP(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text)]">
            <span className="font-medium">Max Tokens ({maxTokens || '1024 default'})</span>
            <Input
              value={maxTokens}
              placeholder="1024"
              onChange={(e) => setMaxTokens(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save</Button>
          </div>
        </div>
      </Dialog>

      {/* Quick Image Dialog */}
      {imageModeDialog && (
        <Dialog
          open={imageModeDialog}
          onClose={() => setImageModeDialog(false)}
          title="Imagine Artwork in Chat"
          description="Prompt your local Stable Diffusion model to render an image directly in this conversation."
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text)]">
                Image Prompt
              </label>
              <Textarea
                rows={3}
                placeholder="Describe what you want to visualize (e.g. A futuristic neon metropolis at twilight)..."
                value={customImagePrompt}
                onChange={(e) => setCustomImagePrompt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Resolution: 512×512</span>
              <span>Model: {imageModels[0]?.name ?? 'Default'}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setImageModeDialog(false)}>
                Cancel
              </Button>
              <Button
                disabled={!customImagePrompt.trim()}
                onClick={() => {
                  const p = customImagePrompt.trim()
                  setImageModeDialog(false)
                  setCustomImagePrompt('')
                  handleSend(`/image ${p}`)
                }}
              >
                <Sparkles size={14} className="mr-1.5" />
                Generate Now
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
