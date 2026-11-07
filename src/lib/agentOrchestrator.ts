import { invoke } from '@tauri-apps/api/core'
import { getSystemSpecs, type SystemSpecs } from './systemInfo'
import { isTauriRuntime, listModels, type ModelRecord } from './db'
import { formatBytes } from './gguf'
import { isNetworkAvailable } from './networkStatus'
import {
  addMemoryFact,
  analyzeUserIntentAndDoubt,
  decideKnowledgeSource,
  evaluateClarificationNeed,
  executeTmdbQuery,
  executeWeatherQuery,
  executeWebSearch,
  extractAndStoreMemories,
  extractMemoryFactsFromText,
  getAgentRankTitle,
  loadAgentConfig,
  loadAgentPolicy,
  loadMemories,
  recordAgentReward,
  searchCrossChatHistory,
  type AgentClarificationData,
  type KnowledgeSourceDecision,
  type TmdbMediaItem,
  type WeatherWidgetData,
  type WebSearchResultItem,
} from './agentSkills'
import {
  describeTools,
  thinkAboutRequest,
  type BrainPlan,
  type ToolAvailability,
} from './agentBrain'

export type AgentToolName =
  | 'generate_image'
  | 'render_table'
  | 'structured_list'
  | 'create_artifact'
  | 'inspect_hardware'
  | 'compute_math'
  | 'web_search'
  | 'query_tmdb'
  | 'live_weather'
  | 'save_workspace_note'
  | 'ask_clarification'
  | 'direct_reasoning'

export type ResponseFormatMode = 'auto' | 'table' | 'list' | 'image' | 'widget' | 'web' | 'tmdb'

export interface AgentStep {
  id: string
  type: 'think' | 'tool_call' | 'tool_result'
  title: string
  detail?: string
  tool?: AgentToolName
  status: 'running' | 'done'
}

export interface SystemWidgetData {
  cpuBrand: string
  osArch: string
  totalRamGb: number
  cores: number
  acceleration: string
  optimalThreads: number
  textModelCount: number
  imageModelCount: number
  activeModelName: string
}

export interface MathWidgetData {
  expression: string
  result: string
}

export interface TmdbWidgetData {
  sourceLabel: string
  items: TmdbMediaItem[]
}

export interface WebSearchWidgetData {
  query: string
  engineLabel: string
  results: WebSearchResultItem[]
}

export interface WorkspaceNoteWidgetData {
  filename: string
  savedPath: string
}

export interface AgentTurnMeta {
  toolUsed: AgentToolName
  steps: AgentStep[]
  durationMs?: number
  decisionConfidence?: number
  knowledgeDecision?: KnowledgeSourceDecision
  clarificationWidget?: AgentClarificationData
  rewardGiven?: 'up' | 'down' | null
  recalledMemories?: string[]
  newMemorySaved?: string
  systemWidget?: SystemWidgetData
  mathWidget?: MathWidgetData
  tmdbWidget?: TmdbWidgetData
  webSearchWidget?: WebSearchWidgetData
  weatherWidget?: WeatherWidgetData
  workspaceNoteWidget?: WorkspaceNoteWidgetData
  imagePrompt?: string
}

const META_PREFIX = '<!--SB_META:'
const META_SUFFIX = ':SB_META-->'

export function encodeMessageWithMeta(content: string, meta: AgentTurnMeta | null): string {
  if (!meta) return content
  try {
    const json = JSON.stringify(meta)
    return `${META_PREFIX}${json}${META_SUFFIX}\n${content}`
  } catch {
    return content
  }
}

export function decodeMessageMeta(rawContent: string): {
  meta: AgentTurnMeta | null
  cleanText: string
  extractedThink: string | null
} {
  let working = rawContent
  let meta: AgentTurnMeta | null = null

  if (working.startsWith(META_PREFIX)) {
    const endIdx = working.indexOf(META_SUFFIX)
    if (endIdx !== -1) {
      const jsonStr = working.slice(META_PREFIX.length, endIdx)
      try {
        meta = JSON.parse(jsonStr) as AgentTurnMeta
      } catch {
        // ignore malformed meta
      }
      working = working.slice(endIdx + META_SUFFIX.length).replace(/^\n/, '')
    }
  }

  let extractedThink: string | null = null
  const thinkMatch = working.match(/<think>([\s\S]*?)(?:<\/think>|$)/i)
  if (thinkMatch) {
    extractedThink = thinkMatch[1].trim()
    working = working.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
  }

  return { meta, cleanText: working, extractedThink }
}

/**
 * Detects if the user prompt is requesting image generation.
 */
export function detectImageIntent(
  input: string,
  formatMode: ResponseFormatMode = 'auto',
): { isImage: boolean; rawSubject: string } {
  const trimmed = input.trim()

  if (formatMode === 'image') {
    const cleaned = trimmed.replace(/^\/(image|imagine|draw)\s*/i, '').trim()
    return {
      isImage: true,
      rawSubject: cleaned || 'creative artwork based on our conversation',
    }
  }

  const slashMatch = trimmed.match(/^\/(image|imagine|draw)(?:\s+([\s\S]+))?$/i)
  if (slashMatch) {
    return {
      isImage: true,
      rawSubject: (slashMatch[2] || 'creative artwork based on our conversation').trim(),
    }
  }

  const lower = trimmed.toLowerCase()
  const imageTriggerPatterns = [
    /\b(?:create|generate|make|draw|paint|render|visualize|sketch|design)\s+(?:me\s+)?(?:an?\s+)?(?:new\s+)?(?:image|picture|photo|artwork|illustration|painting|portrait|wallpaper|poster|visual)\b/i,
    /\b(?:image|picture|artwork|illustration)\s+(?:of|showing|depicting|based on)\b/i,
    /^draw\s+/i,
    /^paint\s+/i,
  ]

  if (
    /\b(html|css|table|code|function|script|json|sql|markdown|prompt|prompts|template)\b/i.test(
      lower,
    )
  ) {
    return { isImage: false, rawSubject: '' }
  }

  for (const pattern of imageTriggerPatterns) {
    if (pattern.test(trimmed)) {
      return { isImage: true, rawSubject: trimmed }
    }
  }

  return { isImage: false, rawSubject: '' }
}

/**
 * Safely evaluates pure arithmetic expressions if found in the user query.
 */
function tryEvaluateMath(input: string): MathWidgetData | null {
  const cleaned = input
    .replace(/^(?:calculate|compute|solve|what is|whats|eval)\s+/i, '')
    .replace(/[?=]/g, '')
    .trim()

  if (!/^[\d\s.+\-*/()%^]+$/.test(cleaned) || !/[+\-*/%^]/.test(cleaned) || !/\d/.test(cleaned)) {
    return null
  }

  try {
    const jsExpr = cleaned.replace(/\^/g, '**')
    const fn = new Function(`return (${jsExpr})`)
    const val = fn()
    if (typeof val === 'number' && Number.isFinite(val)) {
      const formatted = Number.isInteger(val)
        ? val.toLocaleString()
        : Number(val.toFixed(6)).toLocaleString(undefined, { maximumFractionDigits: 6 })
      return { expression: cleaned, result: formatted }
    }
  } catch {
    return null
  }
  return null
}

/** Builds an interactive clarification card from the brain's own question. */
function buildBrainClarification(brain: BrainPlan, userPrompt: string): AgentClarificationData | null {
  if (!brain.clarifyQuestion) return null
  const options =
    brain.clarifyOptions.length >= 2
      ? brain.clarifyOptions
      : ['Give me a quick direct answer', 'Go deep with details', "I'll explain more in chat"]
  return {
    reason: brain.understanding || 'Need one detail to do this right',
    mode: 'ask_first',
    originalGoal: userPrompt,
    questions: [{ id: 'brain_clarify', question: brain.clarifyQuestion, options }],
  }
}

/** Maps the brain's intent onto the knowledge-source decision shown in the UI. */
function brainToKnowledgeDecision(
  brain: BrainPlan,
  tools: ToolAvailability,
  fallback: KnowledgeSourceDecision,
): KnowledgeSourceDecision {
  switch (brain.intent) {
    case 'web_search':
      return tools.webSearch
        ? {
            mode: 'live_internet',
            label: 'Live Internet Search',
            reason: brain.understanding || 'Needs current information from the web',
            confidence: 95,
          }
        : {
            mode: 'model_only',
            label: 'Local Brain (offline)',
            reason: 'Live data needed but web search is unavailable — answering from model knowledge',
            confidence: 80,
          }
    case 'media':
    case 'weather':
      return fallback
    default:
      return {
        mode: 'model_only',
        label: 'Model Reasoning',
        reason: brain.understanding || 'Answerable from model knowledge',
        confidence: 92,
      }
  }
}

/**
 * Builds the reward-adapted system prompt addition from the agent's learned policy weights
 * and any recalled long-term user memories.
 */
function buildPolicyAndMemoryPrompt(
  policy: {
    level: number
    totalXp: number
    tablePreference: number
    stepByStepDepth: number
    conciseness: number
  },
  recalledMemories: string[],
  isOnline: boolean,
  tools?: ToolAvailability,
): string {
  const rank = getAgentRankTitle(policy.level)
  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time'

  const toolBlock = tools
    ? describeTools(tools)
    : '- web_search, media, weather, image, recall_history, memory'

  const parts: string[] = [
    `You are Second Brain, a capable AI agent running privately on the user's Mac (${rank}, ${policy.totalXp} XP).`,
    `Today is ${formattedDate}, ${formattedTime} (${tz}). Internet: ${isOnline ? 'CONNECTED' : 'OFFLINE — answer from your own knowledge and saved memory'}.`,
    `Your tools (the app runs them for you and pastes the results into the user's message in [brackets]):\n${toolBlock}`,
    'How you work:',
    '1. First understand what the user really means — fix typos, understand Hinglish, and use the earlier conversation to resolve references. Reply in the language style the user uses.',
    '2. If tool results are provided, base your answer on them, mention the key facts directly, and never claim you cannot browse. If a needed tool is unavailable, say so in one short line and give your best answer from your own knowledge.',
    '3. Be a real partner: answer directly first, then add only the detail that helps. Match length to the question — small talk gets 1–3 friendly sentences, complex questions get structure.',
    '4. Think critically: check facts against each other, point out uncertainty honestly, and never invent dates, scores, or numbers that are not in the provided data.',
    '5. Ask one short clarifying question only when you truly cannot act; otherwise make a sensible assumption and proceed.',
    '6. Formatting: use **bold** for key terms, `###` headings and bullets only for longer answers, fenced code blocks for code, ```email blocks for emails, ```text blocks for copyable prompts. Tables only when comparing 2+ items with real data. Never write in ALL CAPS.',
    '7. Never repeat a paragraph, never add meta-commentary about your formatting, and never end with generic filler.',
  ]

  if (policy.conciseness >= 0.75) {
    parts.push('The user prefers concise, zero-fluff answers.')
  }

  if (recalledMemories.length > 0) {
    parts.push(
      `What you know about the user:\n${recalledMemories.map((m) => `- ${m}`).join('\n')}`,
    )
  }

  return parts.join('\n')
}

/**
 * Autonomous Multi-Tool & Reward-Driven Agent Planner:
 * Evaluates user intent, enabled Settings skills (Internet, Google Search, TMDB, Weather, Memory Vault,
 * Workspace Notes, Code Sandbox), Clarifying Questions, and learned Reward Policy weights.
 */
export async function planAgentTurn(
  userPrompt: string,
  activeModelName: string,
  formatMode: ResponseFormatMode = 'auto',
  conversationHistory: Array<{ role: string; content: string }> = [],
): Promise<{
  tool: AgentToolName
  steps: AgentStep[]
  augmentedPrompt: string
  systemAddition: string
  decisionConfidence: number
  recommendedTemperature?: number
  knowledgeDecision: KnowledgeSourceDecision
  clarificationWidget?: AgentClarificationData
  recalledMemories: string[]
  newMemorySaved?: string
  systemWidget?: SystemWidgetData
  mathWidget?: MathWidgetData
  tmdbWidget?: TmdbWidgetData
  webSearchWidget?: WebSearchWidgetData
  weatherWidget?: WeatherWidgetData
  workspaceNoteWidget?: WorkspaceNoteWidgetData
  imageSubject?: string
}> {
  const lower = userPrompt.toLowerCase().trim()
  const [config, policy] = await Promise.all([loadAgentConfig(), loadAgentPolicy()])

  let knowledgeDecision = decideKnowledgeSource(userPrompt, config, conversationHistory)
  let clarification =
    config.proactiveDecisionMode && formatMode === 'auto'
      ? evaluateClarificationNeed(userPrompt)
      : null

  // 0. Episodic Memory Extraction, History Scan & Priority Recall
  let newMemorySaved: string | undefined
  if (config.memoryVaultEnabled) {
    // Scan earlier user turns in the active conversation so facts stated 10+ turns ago are never lost
    for (const msg of conversationHistory) {
      if (msg.role === 'user') {
        const historicalFacts = extractMemoryFactsFromText(msg.content)
        for (const hf of historicalFacts) {
          await addMemoryFact(hf.fact, hf.category)
        }
      }
    }

    const extracted = await extractAndStoreMemories(userPrompt)
    if (extracted) {
      newMemorySaved = extracted.fact
      if (config.rewardLearningEnabled) {
        await recordAgentReward(5, 'memory_vault', 'Autonomously learned new user fact', true)
      }
    }
  }

  // Reload memories AFTER extraction so newly learned facts are immediately active on this turn
  const freshMemories = config.memoryVaultEnabled ? await loadMemories() : []
  // Always prioritize identity facts (name, role, org, location) first so they are never pushed out
  const identityMemories = freshMemories.filter((m) => m.category === 'identity')
  const otherMemories = freshMemories.filter((m) => m.category !== 'identity')
  const recalledMemories = [...identityMemories, ...otherMemories]
    .slice(0, 12)
    .map((m) => m.fact)

  const isOnline = isNetworkAvailable()
  const tools: ToolAvailability = {
    online: isOnline,
    webSearch:
      isOnline &&
      config.knowledgeRoutingMode !== 'offline_only' &&
      (config.webSearchEnabled || config.googleSearchEnabled),
    media: isOnline && config.tmdbEnabled,
    weather: isOnline && config.weatherEnabled,
    image: true,
    memory: config.memoryVaultEnabled,
  }

  // ---------------------------------------------------------------------------
  // AGENT BRAIN: think about what the user actually wants before choosing a tool
  // ---------------------------------------------------------------------------
  const isExplicitWebCommand = formatMode === 'web' || /^\/(web|search|google)\b/i.test(lower)
  const skipBrain =
    (formatMode !== 'auto' && formatMode !== 'web') ||
    /^\/(image|imagine|draw|tmdb|specs|save|clear|table|widget|code|brainstorm|summarize)\b/i.test(lower) ||
    /\[clarified preferences:/i.test(userPrompt)
  const brainInput = userPrompt.replace(/^\/(web|search|google)\s*/i, '').trim() || userPrompt
  let brain: BrainPlan | null = skipBrain
    ? null
    : await thinkAboutRequest(brainInput, conversationHistory, tools)
  if (brain && isExplicitWebCommand) {
    brain = { ...brain, intent: 'web_search' }
  }

  if (brain) {
    // The brain decides; regex-based clarification only survives if the brain also wants to clarify
    clarification =
      brain.intent === 'clarify'
        ? clarification ?? buildBrainClarification(brain, userPrompt)
        : null
    knowledgeDecision = brainToKnowledgeDecision(brain, tools, knowledgeDecision)
  }

  const brainNote = brain
    ? `\nYour reading of the user's current message: ${brain.understanding || 'see message'}${
        brain.intent === 'web_search' && !tools.webSearch
          ? '\nLive web search is unavailable right now, so answer from your own knowledge and say briefly that it may not include the very latest updates.'
          : ''
      }`
    : ''
  const baseSystemAddition =
    buildPolicyAndMemoryPrompt(policy, recalledMemories, isOnline, tools) + brainNote
  const brainStep: AgentStep[] = brain
    ? [
        {
          id: 's_brain',
          type: 'think',
          title: `Understood: ${brain.understanding.slice(0, 90) || brain.intent}`,
          detail: `Intent: ${brain.intent}${brain.searchQuery ? ` • Search: "${brain.searchQuery}"` : ''} • Planner: ${
            brain.source === 'llm' ? 'local model reasoning' : 'fast path'
          }`,
          status: 'done',
        },
      ]
    : []

  // 0.1 Conversational turn: talk like a person, no tools, no clarification cards
  if (brain?.intent === 'chat') {
    return {
      tool: 'direct_reasoning',
      decisionConfidence: 95,
      recommendedTemperature: 0.7,
      knowledgeDecision: {
        mode: 'model_only',
        label: 'Conversation',
        reason: 'Conversational message — no tools needed',
        confidence: 95,
      },
      recalledMemories,
      newMemorySaved,
      steps: brainStep,
      augmentedPrompt: userPrompt,
      systemAddition: `${baseSystemAddition}\nThis message is conversational. Reply like a warm, sharp friend in 1–3 sentences, no headings or lists. If the user doubts you, acknowledge it honestly, mention one or two concrete things you can actually do for them with your tools, and ask what they need help with.`,
    }
  }

  // 0.2 Direct Personal / Episodic Memory Recall Query ("do you know my name?", "who am i?", "what do you remember about me?")
  const isMemoryRecallQuery =
    /\b(what(?:'s| is) my name|do you know my name|remember my name|who am i|tell me my name|what do you know about me|what do you remember about me|my role|where do i work|where do i live)\b/i.test(
      lower,
    )
  if (isMemoryRecallQuery && recalledMemories.length > 0) {
    const memoryList = recalledMemories.map((m) => `- ${m}`).join('\n')
    return {
      tool: 'direct_reasoning',
      decisionConfidence: 99,
      recommendedTemperature: 0.2,
      knowledgeDecision: {
        mode: 'model_only',
        label: 'Episodic Memory Vault Recall',
        reason: 'Retrieved verified user identity & facts from Long-Term Memory Vault',
        confidence: 99,
      },
      recalledMemories,
      newMemorySaved,
      steps: [
        {
          id: 's_mem',
          type: 'think',
          title: `Memory Vault: Recalled ${recalledMemories.length} stored user ${
            recalledMemories.length === 1 ? 'fact' : 'facts'
          } (99% confidence)`,
          detail: recalledMemories.join(' • '),
          status: 'done',
        },
      ],
      augmentedPrompt: `${userPrompt}\n\n[VERIFIED USER MEMORY VAULT (Use these exact facts to answer directly and naturally):\n${memoryList}]`,
      systemAddition: `${baseSystemAddition}\nAnswer the user's question directly and warmly using the exact facts from the Verified User Memory Vault above.`,
    }
  }

  // 0.3 Cross-Chat Episodic History Search & Doubt / Misunderstanding Disambiguation
  const initialIntentCheck = analyzeUserIntentAndDoubt(userPrompt, conversationHistory, [])
  const shouldSearchHistory = brain
    ? brain.intent === 'recall_history'
    : initialIntentCheck.isPastHistoryQuery || initialIntentCheck.isCorrectionOrDoubt
  if (shouldSearchHistory) {
    const prevUserTurn = [...conversationHistory]
      .reverse()
      .find((m) => m.role === 'user')?.content
    const combinedHistoryQuery = prevUserTurn ? `${prevUserTurn} ${userPrompt}` : userPrompt
    const pastMatches = await searchCrossChatHistory(combinedHistoryQuery)
    const fullIntentAnalysis = analyzeUserIntentAndDoubt(
      userPrompt,
      conversationHistory,
      pastMatches,
    )

    const historyContextLines =
      pastMatches.length > 0
        ? pastMatches
            .map(
              (pm, idx) =>
                `Match ${idx + 1} — Past Chat "${pm.conversationTitle}":\n  • User asked: "${pm.userMessage}"\n  • Assistant replied: "${pm.assistantSnippet}..."`,
            )
            .join('\n')
        : 'No matching past conversation messages were found in saved SQLite history.'

    const memoryList =
      recalledMemories.length > 0
        ? `\nStored Episodic Memory Facts:\n${recalledMemories.map((m) => `- ${m}`).join('\n')}`
        : ''

    return {
      tool: 'ask_clarification',
      decisionConfidence: 97,
      recommendedTemperature: 0.25,
      knowledgeDecision: {
        mode: 'model_only',
        label:
          pastMatches.length > 0
            ? 'Cross-Chat History Recall'
            : 'Intent Disambiguation & Clarification',
        reason:
          pastMatches.length > 0
            ? `Found ${pastMatches.length} matching past chat(s) across your conversation history`
            : 'Clarifying user intent across conversations & resolving ambiguity',
        confidence: 97,
      },
      clarificationWidget: fullIntentAnalysis.clarificationData,
      recalledMemories,
      newMemorySaved,
      steps: [
        {
          id: 's_intent',
          type: 'think',
          title: fullIntentAnalysis.isPastHistoryQuery
            ? `Cross-Chat Episodic Search: Scanned past chats (${pastMatches.length} match${
                pastMatches.length === 1 ? '' : 'es'
              } found)`
            : 'Intent Disambiguator: Detected user correction / ambiguity — clarifying intent',
          detail:
            pastMatches.length > 0
              ? `Matched past chat: "${pastMatches[0].conversationTitle}" — "${pastMatches[0].userMessage.slice(0, 70)}"`
              : fullIntentAnalysis.semanticIntentSummary.slice(0, 120),
          status: 'done',
        },
      ],
      augmentedPrompt: `${userPrompt}\n\n[AGENT SEMANTIC INTENT ANALYSIS:\n${fullIntentAnalysis.semanticIntentSummary}\n\nVERIFIED CROSS-CHAT DATABASE SEARCH RESULTS:\n${historyContextLines}${memoryList}\n\nINSTRUCTION: Answer the user's actual question directly in 2–3 natural, human sentences based on the Verified Cross-Chat Database Search Results above. NEVER say "whatever floats your boat" or deflect with generic small talk. If there is any remaining doubt, ask 1 clear clarifying question and invite them to pick an option below.]`,
      systemAddition: `${baseSystemAddition}\nFollow the Agent Semantic Intent Analysis strictly. Answer the user's question directly and honestly using the Cross-Chat Database Search Results, and ask a brief clarifying question if needed.`,
    }
  }

  // 0.5 Autonomous Agent Clarification First (for underspecified build/plan/recommendation tasks)
  if (clarification && clarification.mode === 'ask_first') {
    return {
      tool: 'ask_clarification',
      decisionConfidence: 96,
      knowledgeDecision,
      clarificationWidget: clarification,
      recalledMemories,
      newMemorySaved,
      steps: [
        ...brainStep,
        {
          id: 's1',
          type: 'think',
          title: 'Need one detail before acting',
          detail: clarification.reason,
          status: 'done',
        },
      ],
      augmentedPrompt: `${userPrompt}\n\n[Before doing this, you need a little more detail from the user. In 1–2 natural sentences, say what you understood and ask: "${clarification.questions[0]?.question ?? 'Could you tell me a bit more?'}". Clickable answer buttons are shown under your message automatically, so do NOT list the options, do NOT number anything, and do NOT write a heading.]`,
      systemAddition: baseSystemAddition,
    }
  }

  // 1. Check Image Generation Tool
  const regexImgCheck = detectImageIntent(userPrompt, formatMode)
  const imgCheck =
    !regexImgCheck.isImage && brain?.intent === 'image'
      ? { isImage: true, rawSubject: userPrompt }
      : regexImgCheck
  if (imgCheck.isImage && (!brain || brain.intent === 'image' || formatMode === 'image' || /^\/(image|imagine|draw)\b/i.test(lower))) {
    return {
      tool: 'generate_image',
      imageSubject: imgCheck.rawSubject,
      decisionConfidence: 98,
      knowledgeDecision,
      recalledMemories,
      newMemorySaved,
      steps: [
        {
          id: 's1',
          type: 'think',
          title: 'Decision Engine: Selected visual generation pipeline (98% confidence)',
          detail: `Routing request to local Stable Diffusion for "${imgCheck.rawSubject.slice(0, 60)}"`,
          status: 'done',
        },
        {
          id: 's2',
          type: 'tool_call',
          tool: 'generate_image',
          title: 'Calling tool: generate_image(width=512, height=512)',
          detail: 'Synthesizing context-aware visual prompt & rendering artwork…',
          status: 'running',
        },
      ],
      augmentedPrompt: userPrompt,
      systemAddition: baseSystemAddition,
    }
  }

  // 2. Check TMDB Movies, TV, Streaming & Media Intelligence Skill (Chained with Live Web Search!)
  const isExplicitTmdb = formatMode === 'tmdb' || /^\/tmdb\b/i.test(lower)
  const isMovieIntent =
    /\b(movie|movies|film|films|tv show|tv series|web series|series|shows|sitcom|k-drama|kdrama|k drama|korean drama|drama|anime|manga|cinema|actor|actress|director|box office|imdb|tmdb|netflix|prime video|amazon prime|disney\+|disney plus|hbo|hulu|apple tv|crunchyroll|streaming|what to watch|watch on|trending movies|trending shows|recommend a movie|recommend a show|documentary)\b/i.test(
      lower,
    )
  if (isExplicitTmdb || (config.tmdbEnabled && (brain ? brain.intent === 'media' : isMovieIntent))) {
    const cleanPrompt = userPrompt.replace(/^\/tmdb\s*/i, '').trim() || 'trending movies this week'
    const canAlsoSearchWeb =
      isOnline &&
      config.knowledgeRoutingMode !== 'offline_only' &&
      (config.webSearchEnabled || config.googleSearchEnabled)

    const [tmdbRes, mediaWebResults] = await Promise.all([
      executeTmdbQuery(cleanPrompt, config),
      canAlsoSearchWeb
        ? executeWebSearch(brain?.searchQuery || cleanPrompt, config, { fresh: true })
        : Promise.resolve([]),
    ])

    if (tmdbRes.items.length > 0 || mediaWebResults.length > 0) {
      const summaryLines = tmdbRes.items
        .map(
          (item, i) =>
            `${i + 1}. **${item.title}** (${item.releaseYear}, ${item.mediaType.toUpperCase()}) — Rating: ⭐ ${item.rating}/10 — ${item.overview.slice(0, 180)}`,
        )
        .join('\n')

      const webEngineLabel =
        config.googleSearchEnabled && config.googleApiKey.trim()
          ? 'Google Custom Search API'
          : 'Live Web Intelligence (Wikipedia + DuckDuckGo)'

      const webLines = mediaWebResults
        .map((r, i) => `[Web ${i + 1}] ${r.title} (${r.source}): ${r.snippet}`)
        .join('\n')

      const mediaSteps: AgentStep[] = [
        {
          id: 's1',
          type: 'think',
          title: 'Multi-Tool Agent Planner: Chaining TMDB Media Index + Live Web Search (97% confidence)',
          detail: `Knowledge gap detected on media/streaming query — executing query_tmdb() + web_search() in parallel`,
          status: 'done',
        },
      ]

      if (tmdbRes.items.length > 0) {
        mediaSteps.push({
          id: 's2',
          type: 'tool_call',
          tool: 'query_tmdb',
          title: `Executed tool: query_tmdb("${cleanPrompt.slice(0, 40)}")`,
          detail: `Retrieved ${tmdbRes.items.length} media titles with ratings & posters via ${tmdbRes.sourceLabel}`,
          status: 'done',
        })
      }

      if (mediaWebResults.length > 0) {
        mediaSteps.push({
          id: 's3',
          type: 'tool_call',
          tool: 'web_search',
          title: `Executed tool: web_search("${cleanPrompt.slice(0, 40)}")`,
          detail: `Retrieved ${mediaWebResults.length} live streaming/editorial sources from ${webEngineLabel}`,
          status: 'done',
        })
      }

      const combinedContextParts: string[] = []
      if (summaryLines) {
        combinedContextParts.push(`LIVE TMDB & MEDIA INDEX DATA:\n${summaryLines}`)
      }
      if (webLines) {
        combinedContextParts.push(`LIVE WEB & STREAMING CONTEXT:\n${webLines}`)
      }

      return {
        tool: 'query_tmdb',
        decisionConfidence: 97,
        knowledgeDecision: {
          mode: 'hybrid_fusion',
          label: 'Multi-Tool Fusion (TMDB + Live Web + Model)',
          reason: 'Chained TMDB Media Discovery + Live Web Search with model recommendations',
          confidence: 97,
        },
        recalledMemories,
        newMemorySaved,
        tmdbWidget:
          tmdbRes.items.length > 0
            ? {
                sourceLabel: tmdbRes.sourceLabel,
                items: tmdbRes.items,
              }
            : undefined,
        webSearchWidget:
          mediaWebResults.length > 0
            ? {
                query: cleanPrompt,
                engineLabel: webEngineLabel,
                results: mediaWebResults,
              }
            : undefined,
        steps: [...brainStep, ...mediaSteps],
        augmentedPrompt: `${cleanPrompt}\n\n[${combinedContextParts.join(
          '\n\n',
        )}\n\nAGENT EXECUTION INSTRUCTION: You have already searched TMDB and the live web for the user. NEVER say "I don't have the ability to browse" or tell the user to search Google or IMDb. Directly recommend the best matching titles above, explain why each is worth watching, and include a clean Markdown comparison table (Title, Year, Rating, Vibe/Why Watch).]`,
        systemAddition: `${baseSystemAddition}\nYou have live TMDB and Web Search data injected into this prompt. Directly recommend specific titles, highlight their ratings and plot hooks, and present a Markdown comparison table. Never tell the user to search Google or IMDb themselves.`,
      }
    }
  }

  // 3. Check Live Weather & Geo-Telemetry Skill
  if (
    config.weatherEnabled &&
    (brain
      ? brain.intent === 'weather'
      : /\b(weather|temperature|forecast|rain|snow|humidity|wind speed|how hot|how cold)\b/i.test(lower))
  ) {
    const wx = await executeWeatherQuery(userPrompt)
    if (wx) {
      return {
        tool: 'live_weather',
        decisionConfidence: 95,
        knowledgeDecision: {
          mode: 'live_internet',
          label: 'Live Weather Telemetry',
          reason: 'Real-time meteorological conditions require live sensor telemetry',
          confidence: 95,
        },
        recalledMemories,
        newMemorySaved,
        weatherWidget: wx,
        steps: [
          {
            id: 's1',
            type: 'think',
            title: 'Knowledge Router: Live meteorological telemetry required (95% confidence)',
            status: 'done',
          },
          {
            id: 's2',
            type: 'tool_call',
            tool: 'live_weather',
            title: `Executed tool: live_weather("${wx.location}")`,
            detail: `${wx.temperatureC}°C (${wx.condition}), Wind ${wx.windKph} km/h, Humidity ${wx.humidity}%`,
            status: 'done',
          },
        ],
        augmentedPrompt: `${userPrompt}\n\n[Live Weather Telemetry for ${wx.location}: Temperature ${wx.temperatureC}°C (Feels like ${wx.feelsLikeC}°C), Condition: ${wx.condition}, Wind: ${wx.windKph} km/h, Humidity: ${wx.humidity}%. Answer using these exact live readings and combine with practical local advice.]`,
        systemAddition: baseSystemAddition,
      }
    }
  }

  // 4. Autonomous Knowledge Router: Live Internet Search OR Hybrid Knowledge Fusion
  const isExplicitWeb = formatMode === 'web' || /^\/(web|search|google)\b/i.test(lower)
  const shouldFetchWebForKnowledge =
    isOnline &&
    (isExplicitWeb ||
      knowledgeDecision.mode === 'live_internet' ||
      knowledgeDecision.mode === 'hybrid_fusion')

  let hybridWebWidget: WebSearchWidgetData | undefined
  let hybridContextBlock = ''
  let hybridEngineLabel =
    config.googleSearchEnabled && config.googleApiKey.trim()
      ? 'Google Custom Search API'
      : 'Live Web Intelligence (Wikipedia + DuckDuckGo + HN)'

  if (shouldFetchWebForKnowledge) {
    const cleanSearch =
      brain?.searchQuery || userPrompt.replace(/^\/(web|search|google)\s*/i, '').trim() || userPrompt
    const results = await executeWebSearch(cleanSearch, config, {
      fresh: brain?.intent === 'web_search' || knowledgeDecision.mode === 'live_internet',
    })
    if (results.length > 0) {
      hybridWebWidget = {
        query: cleanSearch,
        engineLabel: hybridEngineLabel,
        results,
      }
      hybridContextBlock = results
        .map((r, i) => `[${i + 1}] ${r.title} (${r.source} - ${r.url}): ${r.snippet}`)
        .join('\n')
    }
  }

  // If explicit web search, strict live_internet, or hybrid_fusion found web context, return web_search tool directly
  if (
    hybridWebWidget &&
    (isExplicitWeb ||
      knowledgeDecision.mode === 'live_internet' ||
      knowledgeDecision.mode === 'hybrid_fusion')
  ) {
    return {
      tool: 'web_search',
      decisionConfidence: knowledgeDecision.confidence,
      knowledgeDecision,
      recalledMemories,
      newMemorySaved,
      webSearchWidget: hybridWebWidget,
      steps: [
        ...brainStep,
        {
          id: 's1',
          type: 'think',
          title: `Knowledge Router: ${knowledgeDecision.label} (${knowledgeDecision.confidence}% confidence)`,
          detail: knowledgeDecision.reason,
          status: 'done',
        },
        {
          id: 's2',
          type: 'tool_call',
          tool: 'web_search',
          title: `Executed tool: web_search("${hybridWebWidget.query.slice(0, 36)}")`,
          detail: `Retrieved ${hybridWebWidget.results.length} live sources from ${hybridEngineLabel} & fused with ${activeModelName}`,
          status: 'done',
        },
      ],
      augmentedPrompt: `${brainInput}\n\n[Live search results for "${hybridWebWidget.query}" (${hybridEngineLabel}):\n${hybridContextBlock}\n\nUse these results to answer the user's actual question${
        brain?.understanding ? ` (${brain.understanding})` : ''
      }. Start with the direct answer in 1–2 sentences (e.g. the result, score, date, or fact they asked for). Then add 2–5 short bullets with the most useful details, citing sources like [1]. Prefer the newest dated results. If the results do not contain the answer, say that honestly and share the closest relevant information. Do not repeat yourself and do not add a summary table.]`,
      systemAddition: baseSystemAddition,
    }
  }

  // 5. Check Autonomous Workspace Note Writer Skill
  if (
    config.workspaceNotesEnabled &&
    (/^\/save\b/i.test(lower) ||
      /\b(save this to workspace|save a note|write a note to disk|save report as)\b/i.test(lower))
  ) {
    const noteBody = userPrompt.replace(/^\/save\s*/i, '').trim()
    const slug =
      noteBody
        .slice(0, 28)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'agent-note'
    const filename = `${slug}-${Date.now().toString().slice(-4)}.md`
    let savedPath = `workspace/${filename}`
    if (isTauriRuntime()) {
      try {
        savedPath = await invoke<string>('agent_save_workspace_note', {
          filename,
          content: `# Second Brain Agent Note\n\nCreated: ${new Date().toLocaleString()}\n\n${noteBody}`,
        })
      } catch {
        // fallback path label
      }
    }
    return {
      tool: 'save_workspace_note',
      decisionConfidence: 95,
      knowledgeDecision,
      recalledMemories,
      newMemorySaved,
      workspaceNoteWidget: {
        filename,
        savedPath,
      },
      steps: [
        {
          id: 's1',
          type: 'think',
          title: 'Decision Engine: Autonomous Workspace Note persistence triggered',
          status: 'done',
        },
        {
          id: 's2',
          type: 'tool_call',
          tool: 'save_workspace_note',
          title: `Executed tool: save_workspace_note("${filename}")`,
          detail: `Saved to ${savedPath}`,
          status: 'done',
        },
      ],
      augmentedPrompt: `${noteBody}\n\n[System Note: You have saved this note to \`${savedPath}\`. Expand on the note with structured action items and a clean summary.]`,
      systemAddition: baseSystemAddition,
    }
  }

  // 6. Check Hardware / System Telemetry Inspection Tool
  if (
    /\b(my hardware|system specs|my specs|my mac|my pc|my cpu|my gpu|how much ram|system status|what models|hardware profile|metal gpu)\b/i.test(
      lower,
    )
  ) {
    const [specs, textModels, imageModels]: [
      SystemSpecs | null,
      ModelRecord[],
      ModelRecord[],
    ] = await Promise.all([
      getSystemSpecs().catch(() => null),
      listModels('text').catch(() => []),
      listModels('image').catch(() => []),
    ])

    const sysWidget: SystemWidgetData = {
      cpuBrand: specs?.cpu_brand ?? 'Local Processor',
      osArch: specs ? `${specs.os} (${specs.arch})` : 'Desktop OS',
      totalRamGb: specs?.total_ram_gb ?? 8,
      cores: specs?.cpu_cores ?? 4,
      acceleration: specs?.acceleration ?? 'Multi-Core CPU',
      optimalThreads: specs?.optimal_threads ?? 4,
      textModelCount: textModels.length,
      imageModelCount: imageModels.length,
      activeModelName,
    }

    const facts = [
      `CPU: ${sysWidget.cpuBrand} (${sysWidget.cores} cores, ${sysWidget.osArch})`,
      `Memory: ${sysWidget.totalRamGb} GB Unified/System RAM`,
      `Acceleration: ${sysWidget.acceleration} (${sysWidget.optimalThreads} optimal inference threads)`,
      `Installed Text Models (${textModels.length}): ${textModels.map((m) => `${m.name} (${formatBytes(m.size_bytes ?? 0)})`).join(', ') || 'None'}`,
      `Installed Image Models (${imageModels.length}): ${imageModels.map((m) => m.name).join(', ') || 'None'}`,
    ].join('\n')

    return {
      tool: 'inspect_hardware',
      decisionConfidence: 99,
      knowledgeDecision,
      recalledMemories,
      newMemorySaved,
      systemWidget: sysWidget,
      steps: [
        {
          id: 's1',
          type: 'think',
          title: 'Decision Engine: Selected hardware telemetry inspector (99% confidence)',
          status: 'done',
        },
        {
          id: 's2',
          type: 'tool_call',
          tool: 'inspect_hardware',
          title: 'Executed tool: inspect_hardware()',
          detail: `${sysWidget.cpuBrand} • ${sysWidget.totalRamGb} GB RAM • ${sysWidget.acceleration}`,
          status: 'done',
        },
      ],
      augmentedPrompt: `${userPrompt}\n\n[Live System Telemetry Tool Output:\n${facts}\nSummarize these exact figures in a clean Markdown table and bullet points.]`,
      systemAddition: `${baseSystemAddition}\nPresent the live system telemetry in a clean Markdown table and concise bullet points.`,
    }
  }

  // 7. Check Deterministic Math / Sandboxed Evaluator Tool
  if (config.codeSandboxEnabled) {
    const mathRes = tryEvaluateMath(userPrompt)
    if (mathRes) {
      return {
        tool: 'compute_math',
        decisionConfidence: 99,
        knowledgeDecision: {
          mode: 'model_only',
          label: 'Deterministic Math Sandbox + Model',
          reason: 'Exact numerical expression routed to local math sandbox',
          confidence: 99,
        },
        recalledMemories,
        newMemorySaved,
        mathWidget: mathRes,
        steps: [
          {
            id: 's1',
            type: 'think',
            title: 'Decision Engine: Routed numerical expression to deterministic sandbox',
            status: 'done',
          },
          {
            id: 's2',
            type: 'tool_call',
            tool: 'compute_math',
            title: `Executed tool: compute_math("${mathRes.expression}")`,
            detail: `Exact result = ${mathRes.result}`,
            status: 'done',
          },
        ],
        augmentedPrompt: `${userPrompt}\n\n[Calculator Tool Output: ${mathRes.expression} = ${mathRes.result}. State the exact result and show the step-by-step breakdown in a clean list.]`,
        systemAddition: baseSystemAddition,
      }
    }
  }

  // 8. Interactive HTML / SVG / UI Artifact Tool
  if (
    formatMode === 'widget' ||
    (/\b(html|svg|widget|dashboard|interactive|mini app|mini-app|calculator ui|webpage|landing page|ui component)\b/i.test(
      lower,
    ) &&
      /\b(build|create|make|generate|write|design|code|show)\b/i.test(lower))
  ) {
    return {
      tool: 'create_artifact',
      decisionConfidence: 93,
      knowledgeDecision,
      recalledMemories,
      newMemorySaved,
      steps: [
        {
          id: 's1',
          type: 'think',
          title: 'Decision Engine: Planning interactive visual artifact (93% confidence)',
          detail: 'Preparing self-contained HTML/CSS/JS or SVG for the Split-Screen Artifact Canvas',
          status: 'done',
        },
        {
          id: 's2',
          type: 'tool_call',
          tool: 'create_artifact',
          title: 'Calling tool: create_artifact(previewable=true)',
          status: 'done',
        },
      ],
      augmentedPrompt: `${userPrompt}\n\nProvide a complete, self-contained \`\`\`html code block (with modern inline CSS and JavaScript, dark-mode friendly) so it renders live in the Artifact Canvas, followed by a brief bullet list of features.`,
      systemAddition: `${baseSystemAddition}\nAlways output a single self-contained \`\`\`html fenced code block with clean modern dark-mode styling.`,
    }
  }

  // Build Hybrid Fusion prompt enrichment if the Knowledge Router fetched live web facts
  const hybridPromptBlock = hybridWebWidget
    ? `\n\n[Live Internet Context (${hybridEngineLabel}):\n${hybridContextBlock}\n\nHYBRID KNOWLEDGE FUSION: Combine these updated live web facts with your own internal model knowledge so the answer is both freshly grounded and deeply reasoned.]`
    : ''

  // 8.4 General-Purpose Communication Composer (Emails, Letters, Requests, Outreach)
  const isCommunicationDraft =
    /\b(draft|write|compose|send|reply)\b[\s\S]*\b(mail|email|e-mail|letter|leave|holiday|vacation|day off|time off|resignation|apology|application|outreach|proposal)\b/i.test(
      lower,
    ) ||
    /\b(mail|email|e-mail|letter)\s+(to|for)\s+/i.test(lower) ||
    /\b(leave application|sick leave|casual leave)\b/i.test(lower)

  if (isCommunicationDraft) {
    const identityFacts = recalledMemories.filter((m) =>
      /\b(name|work|developer|engineer|student|role|company|department)\b/i.test(m),
    )
    const identityContext =
      identityFacts.length > 0
        ? `Sign off using the user's known identity: ${identityFacts.join('; ')}.`
        : 'Sign off cleanly with `Regards,` followed by the sender name.'

    return {
      tool: 'structured_list',
      decisionConfidence: 97,
      recommendedTemperature: 0.35,
      knowledgeDecision,
      recalledMemories,
      newMemorySaved,
      steps: [
        {
          id: 's0',
          type: 'think',
          title: 'Decision Engine: Selected Human Communication Composer (Temp 0.35)',
          detail: 'Structuring concise, natural first-person draft in an editable Email Card',
          status: 'done',
        },
      ],
      augmentedPrompt: `${userPrompt}\n\n[Communication Reasoning Guide:
1. Identify the sender (first-person "I"), the recipient, and the exact real-world goal of this message.
2. Output a fenced \`\`\`email block starting with \`Subject: <Concise Subject Line>\`.
3. Write in a natural, polite, human voice (3–5 short paragraphs): a brief greeting, a simple 1-line opener ("I hope you are doing well."), the direct request or message, any practical assurance/next step, and a polite sign-off.
4. Do NOT invent unrelated events or use flowery corporate AI clichés. ${identityContext}]`,
      systemAddition: `${baseSystemAddition}\nWrite strictly from the user's first-person perspective ("I") addressing their recipient directly. Keep sentences short, natural, and human.`,
    }
  }

  // 8.5 Copyable Asset & Code Engineering Reasoning (Prompts, Templates, Code, Scripts, Commands)
  const isCodeOrCopyableAsset =
    /\b(prompt|prompts|template|regex|command|script|snippet|function|class|algorithm|program|code|query|sql|dockerfile|config)\b/i.test(
      lower,
    )

  if (isCodeOrCopyableAsset) {
    const isCodeTask =
      /\b(code|function|class|algorithm|program|script|query|sql|java|python|rust|typescript|javascript|c\+\+|golang|bash)\b/i.test(
        lower,
      )
    return {
      tool: 'structured_list',
      decisionConfidence: 96,
      recommendedTemperature: isCodeTask ? 0.3 : 0.6,
      knowledgeDecision,
      recalledMemories,
      newMemorySaved,
      webSearchWidget: hybridWebWidget,
      steps: [
        {
          id: 's0',
          type: 'think',
          title: isCodeTask
            ? 'Decision Engine: Code Engineering Mode (Temp 0.30 for precision)'
            : 'Decision Engine: Copyable Asset Composer',
          detail: 'Structuring response with bold section headers, editable card & key takeaways',
          status: 'done',
        },
      ],
      augmentedPrompt: `${userPrompt}${hybridPromptBlock}\n\n[Structure Guide:
1. Start with a brief 1–2 sentence overview highlighting **key concepts in bold**.
2. Add a clear bold section heading (\`### Section Title\`).
3. Place the copyable ${
        isCodeTask ? 'code inside a fenced ```<language> block' : 'prompt or template inside a fenced ```text block with clean paragraph spacing'
      }.
4. If there is an important caveat or tip, add a concise \`> 💡 **Pro Tip:** ...\` callout.]`,
      systemAddition: baseSystemAddition,
    }
  }

  // 9. Structured Data Table & Chart Tool (Policy-weighted + Hybrid Knowledge Fusion!)
  if (
    formatMode === 'table' ||
    /\b(table|compare|comparison|vs\b|versus|pros and cons|breakdown|matrix|schedule|pricing|benchmarks|difference between|top \d+|best \d+|which is better|metrics|stats|ranking)\b/i.test(
      lower,
    )
  ) {
    const steps: AgentStep[] = [
      {
        id: 's0',
        type: 'think',
        title: `Knowledge Router: ${knowledgeDecision.label} (${knowledgeDecision.confidence}% confidence)`,
        detail: knowledgeDecision.reason,
        status: 'done',
      },
    ]
    if (hybridWebWidget) {
      steps.push({
        id: 's_web',
        type: 'tool_call',
        tool: 'web_search',
        title: `Hybrid Fusion: Fetched ${hybridWebWidget.results.length} live web sources`,
        detail: `Combining ${hybridEngineLabel} + ${activeModelName} internal knowledge`,
        status: 'done',
      })
    }
    steps.push({
      id: 's2',
      type: 'tool_call',
      tool: 'render_table',
      title: 'Calling tool: render_table(sortable=true, chartable=true)',
      status: 'done',
    })

    return {
      tool: 'render_table',
      decisionConfidence: Math.round(policy.tablePreference * 100),
      knowledgeDecision,
      clarificationWidget: clarification ?? undefined,
      recalledMemories,
      newMemorySaved,
      webSearchWidget: hybridWebWidget,
      steps,
      augmentedPrompt: `${userPrompt}${hybridPromptBlock}`,
      systemAddition: `${baseSystemAddition}\nInclude a clean multi-row Markdown comparison table (| Col 1 | Col 2 | Col 3 |) followed by key takeaways.`,
    }
  }

  // 10. Structured Breakdown & List Tool (with Hybrid Knowledge Fusion!)
  const isGreeting =
    /^(hi|hello|hey|yo|sup|good\s+(morning|afternoon|evening)|thanks|thank you)[!.?\s]*$/i.test(
      lower,
    )
  if (
    formatMode === 'list' ||
    (!isGreeting &&
      (userPrompt.trim().split(/\s+/).length >= 5 ||
        /\b(how|what|why|explain|guide|steps|ideas|list|types|ways|tips|plan|summary|summarize|features|benefits|overview)\b/i.test(
          lower,
        )))
  ) {
    const steps: AgentStep[] = [
      {
        id: 's0',
        type: 'think',
        title: `Knowledge Router: ${knowledgeDecision.label}`,
        detail: knowledgeDecision.reason,
        status: 'done',
      },
    ]
    if (hybridWebWidget) {
      steps.push({
        id: 's_web',
        type: 'tool_call',
        tool: 'web_search',
        title: `Hybrid Fusion: Combined ${hybridWebWidget.results.length} live web sources + ${activeModelName}`,
        detail: `Ground-truth verified via ${hybridEngineLabel}`,
        status: 'done',
      })
    }

    return {
      tool: hybridWebWidget ? 'web_search' : 'structured_list',
      decisionConfidence: Math.round(policy.stepByStepDepth * 100),
      knowledgeDecision,
      clarificationWidget: clarification ?? undefined,
      recalledMemories,
      newMemorySaved,
      webSearchWidget: hybridWebWidget,
      steps,
      augmentedPrompt: `${userPrompt}${hybridPromptBlock}`,
      systemAddition: baseSystemAddition,
    }
  }

  // 11. Default Conversational Reasoning
  return {
    tool: 'direct_reasoning',
    decisionConfidence: knowledgeDecision.confidence,
    knowledgeDecision,
    clarificationWidget: clarification ?? undefined,
    recalledMemories,
    newMemorySaved,
    webSearchWidget: hybridWebWidget,
    steps: [
      {
        id: 's1',
        type: 'think',
        title: `Knowledge Router: ${knowledgeDecision.label}`,
        detail: knowledgeDecision.reason,
        status: 'done',
      },
    ],
    augmentedPrompt: `${userPrompt}${hybridPromptBlock}`,
    systemAddition: baseSystemAddition,
  }
}
