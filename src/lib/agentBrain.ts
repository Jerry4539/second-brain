/**
 * Agent Brain — Instant (<1ms) Cognitive Intent, Context & Tool-Awareness Engine
 * engineered specifically to make compact local models (360M – 3B) act like fast,
 * smart, tool-aware agents without double-LLM latency or JSON classification errors.
 */

export type BrainIntent =
  | 'chat'
  | 'answer'
  | 'task'
  | 'web_search'
  | 'media'
  | 'weather'
  | 'image'
  | 'recall_history'
  | 'clarify'

export interface BrainPlan {
  intent: BrainIntent
  /** One concise sentence describing what the user actually wants. */
  understanding: string
  /** Clean, high-signal search query when live data is needed. */
  searchQuery: string
  /** Only populated when intent === 'clarify'. */
  clarifyQuestion: string
  clarifyOptions: string[]
  source: 'llm' | 'heuristic'
}

export interface ToolAvailability {
  online: boolean
  webSearch: boolean
  media: boolean
  weather: boolean
  image: boolean
  memory: boolean
}

/** Compact, small-model-friendly tool status manifest. */
export function describeTools(tools: ToolAvailability): string {
  const status = (ok: boolean, offReason = 'offline') =>
    ok ? 'READY' : `OFF (${offReason})`
  return [
    `- web_search (Google News + Live Web + Cricinfo Scores): ${status(tools.webSearch, tools.online ? 'disabled' : 'offline')}`,
    `- media (TMDB Movies, TV, Anime & K-Drama Discovery): ${status(tools.media, tools.online ? 'disabled' : 'offline')}`,
    `- weather (Live City Weather & Forecast): ${status(tools.weather, tools.online ? 'disabled' : 'offline')}`,
    `- image (Local Stable Diffusion Image Generator): ${status(tools.image, 'no model')}`,
    `- recall_history (Cross-Chat SQLite Memory Search): READY`,
    `- memory (User Profile & Facts Vault): ${status(tools.memory, 'disabled')}`,
  ].join('\n')
}

/** Normalizes common typos, phonetic Hinglish, and shorthand before intent & search analysis. */
export function normalizeUserText(raw: string): string {
  return raw
    .replace(/\bdiwlai\b/gi, 'Diwali')
    .replace(/\bhopliday\b/gi, 'holiday')
    .replace(/\bavilable\b/gi, 'available')
    .replace(/\brecomand(?:ed|ation)?\b/gi, 'recommend')
    .replace(/\bsugest(?:ion)?\b/gi, 'suggest')
    .replace(/\bilkahya\b/gi, 'likhwaya')
    .replace(/\blikhaya\b/gi, 'likhwaya')
    .replace(/\bk[\s-]?dramas?\b/gi, 'K-Drama Korean drama')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Builds a clean, keyword-focused search engine query from a natural user prompt. */
export function buildCleanSearchQuery(
  rawPrompt: string,
  history: Array<{ role: string; content: string }> = [],
): string {
  const normalized = normalizeUserText(rawPrompt.replace(/^\/(web|search|google|tmdb)\s*/i, ''))
  const lower = normalized.toLowerCase()

  // Special expansion for sports/cricket match updates so news feeds return actual scorecards & outcomes
  if (/\b(cricket|ipl|odi|t20|test match|world cup|bcci|ind vs|india match|last match)\b/i.test(lower)) {
    const teamMatch = normalized.match(
      /\b(india|australia|england|pakistan|new zealand|south africa|sri lanka|bangladesh|west indies|afghanistan|csk|mi|rcb|kkr)\b/i,
    )
    const team = teamMatch ? teamMatch[1] : 'India'
    return `${team} cricket match result score`
  }

  // Strip conversational framing while preserving entities, years, and topic nouns
  const stripped = normalized
    .replace(
      /\b(can you find|could you find|please find|find out|and let me know|let me know|tell me about|can you tell me|do you know about|do you know|what is the|what are the|give me update on|update of|update on|bro|bruh|hey|please|pls|plz|okk|ok)\b/gi,
      ' ',
    )
    .replace(
      /^(can|could|would|will)\s+(you|u)\s+(please\s+)?(check|search|find|get|show|tell|give|suggest|recommend)\s+(me\s+)?/i,
      ' ',
    )
    .replace(/[?!.,;:"'`()[\]{}]+/g, ' ')
    .replace(/\b(and|or|the|a|an|me|us|my|our|you|your|is|are|was|were|be|to|for|in|on|at|of|from|with)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (stripped.length >= 3) {
    return stripped
  }

  // If the user asked a short follow-up ("what about pricing?", "and the cast?"), anchor to the previous user topic
  const prevUser = [...history].reverse().find((m) => m.role === 'user')?.content
  if (prevUser) {
    const prevClean = buildCleanSearchQuery(prevUser, [])
    if (prevClean && prevClean !== stripped) {
      return `${prevClean} ${stripped}`.trim().slice(0, 90)
    }
  }

  return normalized.replace(/[?!.]+/g, '').trim()
}

/**
 * Instant, zero-latency (<1ms) semantic intent & context analyzer.
 * Understands what the user really means, resolves typos & Hinglish, checks tool availability,
 * and produces a clear plan without delaying token generation or confusing small 0.5B–3B models.
 */
export async function thinkAboutRequest(
  userPrompt: string,
  history: Array<{ role: string; content: string }>,
  tools: ToolAvailability,
): Promise<BrainPlan> {
  const raw = userPrompt.trim()
  const normalized = normalizeUserText(raw)
  const lower = normalized.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)

  // 1. Explicit slash commands
  if (/^\/(image|imagine|draw)\b/i.test(lower)) {
    const subj = normalized.replace(/^\/(image|imagine|draw)\s*/i, '').trim()
    return {
      intent: 'image',
      understanding: `Generate an image of "${subj || 'the requested scene'}".`,
      searchQuery: '',
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  if (/^\/tmdb\b/i.test(lower)) {
    const q = buildCleanSearchQuery(normalized, history)
    return {
      intent: 'media',
      understanding: `Find movies/shows matching "${q}" using TMDB and live web data.`,
      searchQuery: q,
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  if (/^\/(web|search|google)\b/i.test(lower)) {
    const q = buildCleanSearchQuery(normalized, history)
    return {
      intent: 'web_search',
      understanding: `Search the live web & news for "${q}" and answer the user's question directly.`,
      searchQuery: q,
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 2. Cross-Chat Episodic Memory / History Recall (English + Hinglish + Typos)
  const isPastHistoryQuery =
    /\b(have i ever|did i ever|have i ask|have i asked|did i ask|did we talk|did we discuss|do you remember when|in our previous|in my previous|earlier chat|last chat|previous chat|before have i|kya maine|kya maina|maine aapse|maina aapse|maine tumse|likhwaya|likha tha|pucha tha|bataya tha|baat ki thi)\b/i.test(
      lower,
    )
  const isCorrectionAboutHistory =
    /\b(no bro|nahi bro|arey bro|i am asking|i'm asking)\b/i.test(lower) &&
    /\b(email|mail|ask|asked|likh|likhwaya|pucha|ever|before)\b/i.test(lower)

  if (isPastHistoryQuery || isCorrectionAboutHistory) {
    return {
      intent: 'recall_history',
      understanding:
        'The user is asking whether they previously asked or discussed this topic in an earlier saved chat.',
      searchQuery: buildCleanSearchQuery(normalized, history),
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 3. Conversational Skepticism, Doubt, Greetings, Emotions, or Meta-Questions about the Agent
  const isSkepticismOrBanter =
    /\b(i\s+(?:don't|dont|do not)\s+think\s+(?:so\s+)?(?:that\s+)?(?:you|u)\s+can\s+help|you\s+can(?:'t|not)\s+help\s+me|i\s+doubt\s+(?:you|it|that)|can\s+(?:you|u)\s+(?:really|actually|even)\s+help|are\s+you\s+(?:sure|capable|real|smart|useful)|what\s+can\s+you\s+even\s+do|how\s+can\s+you\s+help\s+me)\b/i.test(
      lower,
    )
  const isGreetingOrShortAck =
    words.length <= 5 &&
    /^(hi|hii+|hello|hey|yo|sup|thanks|thank you|thx|ok|okk+|okay|cool|awesome|great|nice|sure|yep|nope|no|yes|lol|haha|hmm|alright|bye|good\s*(?:morning|afternoon|evening|night))[!.?\s]*$/i.test(
      lower,
    )
  const isEmotionalOrCheckIn =
    /\b(i'?m\s+(?:bored|tired|sad|happy|lonely|exhausted|stressed|confused|annoyed|angry|sleepy)|how\s+are\s+you|how\s+(?:r|are)\s+u|what'?s\s+up|how\s+is\s+it\s+going|let'?s\s+talk|let'?s\s+chat)\b/i.test(
      lower,
    )

  if (isSkepticismOrBanter || isGreetingOrShortAck || isEmotionalOrCheckIn) {
    return {
      intent: 'chat',
      understanding: isSkepticismOrBanter
        ? 'The user is expressing doubt about whether I can help — respond warmly, mention my real tools, and ask what challenge they want to tackle.'
        : 'The user is chatting casually — reply warmly and naturally in 1–3 sentences.',
      searchQuery: '',
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 4. Image Generation Intent
  if (
    /\b(generate|create|draw|paint|render|make|sketch)\s+(?:me\s+)?(?:an?\s+|some\s+)?(?:ultra[\s-]?realistic\s+|cinematic\s+|high[\s-]?quality\s+|beautiful\s+|cute\s+)?(image|picture|photo|photograph|artwork|illustration|portrait|wallpaper|poster)\b/i.test(
      lower,
    )
  ) {
    return {
      intent: 'image',
      understanding: 'The user wants to generate a visual artwork on their Mac.',
      searchQuery: '',
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 5. Weather Intent
  if (
    tools.weather &&
    /\b(weather|temperature|forecast|rain|snow|humidity|wind speed|how hot|how cold)\b/i.test(lower) &&
    !/\b(write a story|poem|metaphor|code)\b/i.test(lower)
  ) {
    return {
      intent: 'weather',
      understanding: 'The user wants live weather conditions.',
      searchQuery: buildCleanSearchQuery(normalized, history),
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 6. Movies, TV Shows, K-Dramas, Anime, Netflix / Streaming Recommendations
  if (
    /\b(movie|movies|film|films|tv show|tv series|web series|sitcom|k-drama|kdrama|k drama|korean drama|anime|manga|imdb|tmdb|netflix|prime video|amazon prime|disney\+|disney plus|hbo|hulu|apple tv|crunchyroll|what to watch|watch on|recommend a show|recommend a movie|best series)\b/i.test(
      lower,
    )
  ) {
    const q = buildCleanSearchQuery(normalized, history)
    return {
      intent: 'media',
      understanding: `The user wants movie/show recommendations or details ("${q}").`,
      searchQuery: q,
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 7. Live Web / News / Sports / Current Events / Specific Entity Lookup
  const needsLiveWeb =
    /\b(latest|current|today|todays|today's|tonight|yesterday|this week|this month|this year|2025|2026|breaking news|news|live score|score|cricket|match|who won|last match|update of|update on|price of|stock|bitcoin|btc|release date|vulnerability|cve-|exploit|php2shell|log4shell|zero-day|use internet|search online|check online|google)\b/i.test(
      lower,
    )

  if (needsLiveWeb) {
    const q = buildCleanSearchQuery(normalized, history)
    return {
      intent: 'web_search',
      understanding: `Fetch current live web/news facts for "${q}" and answer the user's question directly.`,
      searchQuery: q,
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 8. Concrete Task Execution (Drafting emails, writing code, building widgets, creating tables/plans)
  if (
    /\b(write|draft|compose|build|create|code|implement|refactor|debug|translate|summarize|rewrite|compare|table|plan|roadmap)\b/i.test(
      lower,
    )
  ) {
    return {
      intent: 'task',
      understanding: `Complete the user's task directly and cleanly.`,
      searchQuery: '',
      clarifyQuestion: '',
      clarifyOptions: [],
      source: 'heuristic',
    }
  }

  // 9. Default: Direct Answer (with optional hybrid web lookup if smart_hybrid decides so)
  return {
    intent: 'answer',
    understanding: 'Answer the user clearly, directly, and naturally.',
    searchQuery: buildCleanSearchQuery(normalized, history),
    clarifyQuestion: '',
    clarifyOptions: [],
    source: 'heuristic',
  }
}

// ============================================================================
// Output Hygiene: History Sanitising + Repetition-Loop Prevention
// ============================================================================

/**
 * Cleans assistant text so small models never parrot old UI scaffolding
 * ("Interactive Clarifying Questions: 1. What are we working on?") or repeated blocks,
 * and so existing saved messages in SQLite render cleanly.
 */
export function sanitizeAssistantHistory(content: string): string {
  const withoutScaffold = content
    // Strip multi-line "Interactive Clarifying Questions:" blocks and their numbered items
    .replace(
      /(?:^|\n)\s*(?:\*\*)?Interactive Clarifying Questions:?(?:\*\*)?\s*(?:\n\s*\d+\\?\.\s*[^\n]+)+/gi,
      '\n',
    )
    .split('\n')
    .filter((line) => !/^\s*(\*\*)?\s*interactive clarifying questions/i.test(line))
    .filter(
      (line) =>
        !/^\s*\d+\\?\.\s*(what are we (working on|trying to achieve)|how should (the )?(output|results) be formatted)/i.test(
          line,
        ),
    )
    .join('\n')

  return collapseRepetition(withoutScaffold).text.trim()
}

function normalizeParagraph(p: string): string {
  return p
    .toLowerCase()
    .replace(/^(?:>\s*)?(?:💡|⚠️)?\s*(?:\*\*)?(?:key takeaway|pro tip|important)(?:\*\*)?[:\s]*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Detects when a small model repeats paragraphs or callout boxes (degenerate loop)
 * and returns the clean text truncated before the repetition.
 */
export function collapseRepetition(text: string): { text: string; looped: boolean } {
  const paragraphs = text.split(/\n\s*\n/)
  const seen = new Map<string, number>()
  const kept: string[] = []
  let looped = false

  for (const rawP of paragraphs) {
    // Also clean stray leading "** " inside callouts (e.g. "** The last cricket match...")
    const p = rawP.replace(/^(\s*(?:>\s*)?(?:💡\s*)?(?:\*\*Key Takeaway:?\*\*\s*)?)\*\*+\s+/i, '$1')
    const key = normalizeParagraph(p)
    if (key.length >= 20) {
      const count = (seen.get(key) ?? 0) + 1
      seen.set(key, count)
      if (count >= 2) {
        looped = true
        continue
      }
    }
    kept.push(p)
  }

  return { text: kept.join('\n\n').trim(), looped }
}

/** True when a streaming response has entered a repetition loop. */
export function isStreamLooping(text: string): boolean {
  if (/Interactive Clarifying Questions:/i.test(text)) {
    return true
  }
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(normalizeParagraph)
    .filter((p) => p.length >= 20)
  const counts = new Map<string, number>()
  for (const p of paragraphs) {
    const c = (counts.get(p) ?? 0) + 1
    if (c >= 2) return true
    counts.set(p, c)
  }
  if (text.length > 450) {
    const tail = text.slice(-110)
    const first = text.indexOf(tail)
    if (first !== -1 && first < text.length - 110) {
      return true
    }
  }
  return false
}
