import { getSetting, listModels } from './db'
import { generateText, startTextEngine, textEngineStatus } from './textEngine'
import { executeNewsSearch, executeWebSearch, loadAgentConfig } from './agentSkills'

export interface MochiBoardCardBrief {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  color?: string
  fill?: string
  onFrame?: string
  text?: string
  font?: string
  name?: string
  kids?: string[]
  desc?: string
  body?: string
  shape?: string
  tag?: string
  items?: string[]
  rows?: string[][]
  header?: boolean
  hex?: string
  url?: string
  selected?: boolean
}

export interface MochiBoardSnapshot {
  name: string
  cards: MochiBoardCardBrief[]
  links: Array<[string, string]>
  unsorted: MochiBoardCardBrief[]
  styles?: { colors?: string[]; text?: string[] }
  fontsOnThisMac?: string[]
  recentChat?: string[]
  mochiStyle?: string
  library?: {
    projects: Array<{ name: string; folders: string[] }>
    foldersNotInAProject: string[]
    boards: Array<{ id: string; name: string; folder: string | null; current?: boolean }>
  }
}

export interface MochiHostCallbacks {
  onGenerateImage?: (prompt: string, opts?: { showCard?: boolean }) => Promise<string | null>
  onNotify?: (message: string) => void
}

interface ScreenTheme {
  bg: string
  surface: string
  text: string
  muted: string
  primary: string
  onPrimary: string
}

const VALID_COLORS = ['white', 'pink', 'butter', 'mint', 'lilac', 'sky', 'peach'] as const

/**
 * Ensures the local LLM text engine is running before Second Brain answers in Canvas.
 * If idle, automatically boots the user's selected (or first installed) GGUF model.
 */
async function ensureTextEngineRunning(): Promise<boolean> {
  try {
    const status = await textEngineStatus()
    if (status.running) return true

    const models = await listModels('text')
    if (!models || models.length === 0) return false

    const savedId = await getSetting('selected_text_model_id').catch(() => null)
    const chosen = (savedId && models.find((m) => m.id === savedId)) || models[0]
    if (!chosen?.path) return false

    await startTextEngine(chosen.path)
    return true
  } catch {
    return false
  }
}

async function runTextPrompt(
  prompt: string,
  systemPrompt: string,
  maxTokens = 450,
  temperature = 0.35,
): Promise<string> {
  const ready = await ensureTextEngineRunning()
  if (!ready) throw new Error('No local text model available')

  return new Promise<string>((resolve, reject) => {
    let acc = ''
    generateText({
      prompt,
      settings: {
        system_prompt: systemPrompt,
        max_tokens: maxTokens,
        temperature,
      },
      onToken: (tok) => {
        acc += tok
      },
      onDone: () => resolve(acc),
      onError: (msg) => reject(new Error(msg)),
    }).catch(reject)
  })
}

function pickColor(idx: number): (typeof VALID_COLORS)[number] {
  const palette: Array<(typeof VALID_COLORS)[number]> = ['butter', 'pink', 'mint', 'sky', 'lilac', 'peach']
  return palette[idx % palette.length]
}

function summarizeSnapshotForPrompt(snap: MochiBoardSnapshot): string {
  const lines: string[] = [
    `Active Board: "${snap.name || 'Untitled board'}" (${snap.cards?.length || 0} cards, ${snap.links?.length || 0} links, ${snap.unsorted?.length || 0} in Unsorted tray)`,
  ]
  const selected = (snap.cards || []).filter((c) => c.selected)
  if (selected.length > 0) {
    lines.push(
      `Selected Cards (${selected.length}): ${selected
        .map((c) => `[id:${c.id} type:${c.type} color:${c.color || 'white'}] "${(c.text || c.name || '').slice(0, 80)}"`)
        .join('; ')}`,
    )
  }
  if ((snap.unsorted || []).length > 0) {
    lines.push(
      `Unsorted Tray (${snap.unsorted.length}): ${snap.unsorted
        .map((u) => `[id:${u.id}] "${(u.text || '').slice(0, 60)}"`)
        .join('; ')}`,
    )
  }
  for (const c of (snap.cards || []).slice(0, 30)) {
    const selTag = c.selected ? ' *SELECTED*' : ''
    const itemsStr = c.items?.length ? ` (items: ${c.items.slice(0, 5).join(', ')})` : ''
    lines.push(
      `- id:${c.id} (${c.type}${selTag}, x:${c.x}, y:${c.y}, color:${c.color || c.fill || 'white'}): "${(c.text || c.name || c.body || '').replace(/\s+/g, ' ').slice(0, 110)}"${itemsStr}`,
    )
  }
  return lines.join('\n')
}

export function buildFallbackSvgDataUrl(label: string, idx = 0, w = 480, h = 360): string {
  const palettes = [
    ['#1e1b2e', '#ff8fc2', '#ffd1e6', '#ffffff'],
    ['#162436', '#4f9dff', '#bae6fd', '#ffffff'],
    ['#162c26', '#34d399', '#a7f3d0', '#ffffff'],
    ['#271c3a', '#a78bfa', '#ddd6fe', '#ffffff'],
  ]
  const [bg, accent, soft, ink] = palettes[idx % palettes.length]
  const safe = String(label || 'AI Concept')
    .replace(/[<>&"]/g, '')
    .slice(0, 42)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="#0f0d15"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" rx="20" fill="url(#g)"/>
    <circle cx="${w * 0.72}" cy="${h * 0.32}" r="${Math.min(w, h) * 0.24}" fill="${accent}" opacity="0.28"/>
    <circle cx="${w * 0.32}" cy="${h * 0.52}" r="${Math.min(w, h) * 0.28}" fill="${soft}" opacity="0.14"/>
    <rect x="${w * 0.12}" y="${h * 0.18}" width="${w * 0.76}" height="${h * 0.52}" rx="16" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="2"/>
    <text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" font-family="DM Sans, -apple-system, sans-serif" font-weight="700" font-size="16" fill="${ink}">${safe}</text>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function isDarkHex(hex?: string): boolean {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 75
}

function resolveScreenTheme(text: string, fallbackDark = false): ScreenTheme | undefined {
  const lower = text.toLowerCase()
  const wantsDark =
    /\b(dark|night|black|midnight|obsidian|cyber|neon|oled|amoled)\b/i.test(lower) ||
    (!/\b(light|white|bright|day)\b/i.test(lower) && fallbackDark)

  let primary = wantsDark ? '#6366f1' : '#18181b'
  if (/\b(instagram|insta|pink|rose|magenta|dating|beauty)\b/i.test(lower)) primary = '#e1306c'
  else if (/\b(spotify|whatsapp|music|green|emerald|mint|fitness|health)\b/i.test(lower)) primary = '#1db954'
  else if (/\b(youtube|netflix|video|red|crimson)\b/i.test(lower)) primary = '#ef4444'
  else if (/\b(twitter|linkedin|facebook|blue|sky|ocean|travel|flight)\b/i.test(lower)) primary = '#0ea5e9'
  else if (/\b(discord|twitch|crypto|web3|ai|purple|violet|indigo)\b/i.test(lower)) primary = '#8b5cf6'
  else if (/\b(amazon|shop|food|delivery|orange|amber|gold)\b/i.test(lower)) primary = '#f59e0b'

  if (wantsDark) {
    return {
      bg: '#0c0c10',
      surface: '#181820',
      text: '#f4f4f7',
      muted: '#9ca3af',
      primary,
      onPrimary: '#ffffff',
    }
  }

  if (primary !== '#18181b') {
    return {
      bg: '#ffffff',
      surface: '#f4f4f6',
      text: '#18181b',
      muted: '#71717a',
      primary,
      onPrimary: '#ffffff',
    }
  }

  return undefined
}

function extractScreenTopic(prompt: string, boardName?: string): string {
  const cleaned = prompt
    .replace(
      /^(?:can you\s+|could you\s+|please\s+|hey\s+|bro\s+)?(?:create|design|build|make|draft|draw|show|add|generate)\s+(?:me\s+)?(?:an?\s+|the\s+)?/i,
      '',
    )
    .replace(
      /\b(?:mobile|phone|ios|android|web|desktop|website|app|application|ui|ux|wireframe|mockup|screen|page|layout|flow|view|interface)\b/gi,
      ' ',
    )
    .replace(/\b(?:similar to|like|inspired by|in|with|using|for|of)\b/gi, ' ')
    .replace(/\b(?:dark|light|night|black|white|theme|mode|style)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length >= 2 && !/^(it|this|that|one|cards?|next)$/i.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  if (boardName && !/^untitled/i.test(boardName)) {
    return boardName
  }
  return 'Creator Studio'
}

function designDomainScreens(prompt: string, snapshot: MochiBoardSnapshot, forceDesktop = false) {
  const lower = prompt.toLowerCase()
  const frames = (snapshot.cards || []).filter((c) => c.type === 'frame')
  const lastFrame = frames[frames.length - 1]
  const inheritDark = lastFrame ? isDarkHex(lastFrame.fill) : false
  const contextText = `${prompt} ${lastFrame?.name || ''} ${(snapshot.recentChat || []).slice(-2).join(' ')}`
  const theme = resolveScreenTheme(contextText, inheritDark)
  const isDark = theme ? isDarkHex(theme.bg) : false
  const themeLabel = isDark ? ' (Dark Theme)' : ''

  const isDesktop =
    forceDesktop || /\b(website|landing page|desktop|web app|web layout|browser)\b/i.test(lower)

  const topic = extractScreenTopic(prompt, lastFrame?.name?.replace(/\s*[—-].*$/, '') || snapshot.name)

  // 1. Desktop Website / Landing Page Layout
  if (isDesktop) {
    const isInsta = /\b(instagram|insta|social|photo|creator|reel)\b/i.test(contextText)
    const brandName = isInsta ? 'Instagram Web' : topic
    return {
      say: `I built a ${isDark ? 'dark-themed ' : ''}desktop website layout for “${brandName}” using your Ideate kit ✦`,
      screens: [
        {
          name: `${brandName} — Web${themeLabel}`,
          device: 'Desktop',
          theme,
          items: [
            {
              piece: 'Header',
              logo: brandName,
              links: isInsta ? ['Feed', 'Explore', 'Reels', 'Messages'] : ['Features', 'Workflow', 'Pricing', 'Docs'],
              cta: isInsta ? 'Create Post +' : 'Get Started',
            },
            {
              piece: 'Hero',
              title: isInsta
                ? 'Share stories, reels & moments in high contrast.'
                : `${brandName}: built for speed and clarity.`,
              text: isInsta
                ? 'Discover creators, watch full-screen Reels, and message friends from a sleek desktop workspace.'
                : `Everything you need to run ${brandName} with real-time collaboration and instant insights.`,
              cta: isInsta ? 'Open Feed' : 'Start Free Trial',
              cta2: 'Explore Live Demo',
              img: `${brandName} hero showcase`,
            },
            {
              piece: 'Features',
              title: `Why people love ${brandName}`,
              items: isInsta
                ? [
                    { icon: 'auto_awesome', title: 'Live Stories', text: 'Watch ephemeral updates from your favorite creators.' },
                    { icon: 'movie', title: 'Full-HD Reels', text: 'Immersive short-form video feed with remix tools.' },
                    { icon: 'chat_bubble_outline', title: 'Direct Messages', text: 'Encrypted group chats, voice notes, and shared posts.' },
                  ]
                : [
                    { icon: 'bolt', title: 'Instant Workflow', text: 'Zero-latency navigation designed for daily power users.' },
                    { icon: 'insights', title: 'Live Telemetry', text: 'Real-time metrics, conversion funnels, and smart alerts.' },
                    { icon: 'lock', title: 'Private by Default', text: 'Local-first architecture that keeps your data yours.' },
                  ],
            },
            {
              piece: 'CTA',
              title: `Ready to launch ${brandName}?`,
              text: 'Customize any block directly on the canvas or add the next flow screen.',
              cta: 'Get Started Now',
            },
            {
              piece: 'Footer',
              brand: brandName,
              cols: [
                ['Product', ['Overview', 'Features', 'Releases']],
                ['Community', ['Creators', 'Showcase', 'Forum']],
                ['Support', ['Help Center', 'Privacy', 'Terms']],
              ],
            },
          ],
        },
      ],
      next: ['Make the mobile version', 'Write real copy for these cards', 'Try a different color style'],
    }
  }

  // 2. "Next screen in the flow" or Profile / Detail follow-up screen
  const isNextScreenAsk = /\b(next screen|another screen|second screen|profile screen|detail screen|comments screen)\b/i.test(lower)
  if (isNextScreenAsk || /\b(profile|account|bio|portfolio)\b/i.test(lower)) {
    const isSocial = /\b(instagram|insta|social|creator|feed|story|reel)\b/i.test(contextText)
    const screenTitle = isSocial ? 'Creator Profile' : `${topic} — Profile & Details`
    return {
      say: `I added the “${screenTitle}” screen${isDark ? ' in dark theme' : ''} right beside your flow ✦`,
      screens: [
        {
          name: `${screenTitle}${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: isSocial ? '@jerry.studio' : screenTitle, icon: 'settings' },
            {
              piece: 'Heading',
              text: isSocial ? 'Jerry · Product & Visual Creator' : `${topic} Workspace`,
              sub: isSocial ? '148 Posts  ·  24.8k Followers  ·  312 Following' : 'Pro Member · Active since 2026',
              size: 20,
            },
            { piece: 'Button', text: isSocial ? 'Follow Creator' : 'Edit Profile', style: 'primary' },
            {
              piece: 'Card',
              title: isSocial ? 'Pinned Reel · Dark Mode Design System' : 'Featured Milestone',
              text: isSocial ? '84.2k plays · “How we crafted a tactile dark interface”' : '98% completion across 12 active workflows',
              img: isSocial ? 'Pinned creator reel cover' : 'Featured project preview',
            },
            {
              piece: 'List row',
              icon: 'collections',
              title: isSocial ? 'Saved Collections & Boards' : 'Recent Activity Log',
              sub: isSocial ? '18 curated design moodboards' : 'Updated 5 minutes ago',
            },
            {
              piece: 'List row',
              icon: 'insights',
              title: isSocial ? 'Creator Insights & Reach' : 'Notifications & Preferences',
              sub: isSocial ? '+38% engagement this week' : 'All alerts enabled',
            },
            {
              piece: 'Tab bar',
              tabs: isSocial
                ? [
                    ['home', 'Home'],
                    ['search', 'Explore'],
                    ['add_box', 'Post'],
                    ['movie', 'Reels'],
                    ['person_outline', 'Profile'],
                  ]
                : [
                    ['home', 'Home'],
                    ['search', 'Explore'],
                    ['insights', 'Activity'],
                    ['person_outline', 'Profile'],
                  ],
              active: isSocial ? 4 : 3,
            },
          ],
        },
      ],
      next: ['Make it a website layout', 'Write real copy for these cards', 'Try a different color style'],
    }
  }

  // 3. Instagram / Social Feed / Photo / Reels App
  if (/\b(instagram|insta|social|feed|stories|reels|tiktok|threads|pinterest)\b/i.test(lower)) {
    const brand = /\btiktok\b/i.test(lower) ? 'TikTok' : /\bthreads\b/i.test(lower) ? 'Threads' : 'Instagram'
    return {
      say: `I designed a ${isDark ? 'dark-themed ' : ''}${brand} mobile Home screen with Stories, Creator Feed, and bottom navigation ✦`,
      screens: [
        {
          name: `${brand} — Home${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: brand, back: false, icon: 'chat_bubble_outline' },
            {
              piece: 'List row',
              icon: 'auto_awesome',
              title: 'Stories · @your_story, @alex.ux, @kobo +8',
              sub: 'Tap to watch live creator stories',
            },
            {
              piece: 'Card',
              title: '@alex.visuals · Shibuya, Tokyo',
              text: '2,840 likes · “Midnight neon reflections in the rain ✨ #darkui #photography”',
              img: 'Shibuya neon night photo post',
            },
            {
              piece: 'List row',
              icon: 'favorite_border',
              title: 'Liked by @sarah_design and 2,839 others',
              sub: 'View all 142 comments · 14 minutes ago',
            },
            {
              piece: 'Card',
              title: '@studio.motion · Featured Reel',
              text: '19.4k plays · “Smooth micro-interactions for mobile apps”',
              img: 'Featured vertical reel preview',
            },
            { piece: 'Button', text: 'Create New Post +', style: 'primary' },
            {
              piece: 'Tab bar',
              tabs: [
                ['home', 'Home'],
                ['search', 'Explore'],
                ['add_box', 'Post'],
                ['movie', 'Reels'],
                ['person_outline', 'Profile'],
              ],
              active: 0,
            },
          ],
        },
      ],
      next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
    }
  }

  // 4. Spotify / Music / Podcast Player
  if (/\b(spotify|music|song|playlist|audio|podcast|player)\b/i.test(lower)) {
    return {
      say: `I created a ${isDark ? 'dark-themed ' : ''}Music Player & Playlist screen on your canvas ✦`,
      screens: [
        {
          name: `Music Player${themeLabel}`,
          device: 'iPhone',
          theme: theme || resolveScreenTheme('spotify dark', true),
          items: [
            { piece: 'Nav bar', title: 'Now Playing', icon: 'more_horiz' },
            {
              piece: 'Card',
              title: 'Midnight City Synth · M83',
              text: '02:14 / 04:03 · Lossless Spatial Audio',
              img: 'Album cover artwork',
            },
            { piece: 'Button', text: '❚❚  Pause  ·  Shuffle Play', style: 'primary' },
            { piece: 'Heading', text: 'Up Next in Queue', sub: 'Late Night Coding Mix · 24 tracks', size: 18 },
            { piece: 'List row', icon: 'music_note', title: 'Starboy · The Weeknd', sub: '3:50 · High-Res Audio' },
            { piece: 'List row', icon: 'music_note', title: 'Nightcall · Kavinsky', sub: '4:18 · Synthwave Essentials' },
            {
              piece: 'Tab bar',
              tabs: [
                ['home', 'Home'],
                ['search', 'Search'],
                ['library_music', 'Library'],
                ['person_outline', 'Profile'],
              ],
              active: 0,
            },
          ],
        },
      ],
      next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
    }
  }

  // 5. Chat / Messaging / WhatsApp / Discord
  if (/\b(whatsapp|telegram|discord|slack|messenger|chat|messaging|inbox|dm)\b/i.test(lower)) {
    return {
      say: `I drafted a ${isDark ? 'dark-themed ' : ''}Messaging & Direct Chat screen on your board ✦`,
      screens: [
        {
          name: `Messages${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: 'Messages', back: false, icon: 'edit' },
            { piece: 'Search', text: 'Search chats, channels & files…' },
            {
              piece: 'List row',
              icon: 'chat_bubble',
              title: 'Design Team · 4 online',
              sub: ' Maya: “Just pushed the new dark mode tokens ✨” · 2m',
            },
            {
              piece: 'List row',
              icon: 'person',
              title: 'Alex Rivera',
              sub: '“Let’s review the interactive prototype at 3 PM” · 18m',
            },
            {
              piece: 'List row',
              icon: 'bolt',
              title: 'Second Brain AI Bot',
              sub: '“Your sprint summary and 3 wireframes are ready” · 1h',
            },
            {
              piece: 'Card',
              title: 'Voice Lounge · Product Sync',
              text: '3 teammates speaking right now · Tap to join audio',
              img: 'Live voice room waveform',
            },
            { piece: 'Button', text: 'New Message +', style: 'primary' },
            {
              piece: 'Tab bar',
              tabs: [
                ['chat_bubble_outline', 'Chats'],
                ['group', 'Channels'],
                ['call', 'Calls'],
                ['settings', 'Settings'],
              ],
              active: 0,
            },
          ],
        },
      ],
      next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
    }
  }

  // 6. E-Commerce / Shopping / Store / Food Delivery
  if (/\b(shop|store|ecommerce|e-commerce|cart|checkout|product|amazon|nike|shoe|fashion|food|delivery)\b/i.test(lower)) {
    return {
      say: `I built a ${isDark ? 'dark-themed ' : ''}Storefront & Product Discovery screen on your board ✦`,
      screens: [
        {
          name: `${topic} Store${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: `${topic} Shop`, back: false, icon: 'shopping_bag' },
            { piece: 'Search', text: 'Search drops, collections & brands…' },
            {
              piece: 'Card',
              title: 'Limited Edition · Aero Pro Series',
              text: '$189.00 · Free express delivery · 4.9 ★ (420 reviews)',
              img: 'Featured product hero photo',
            },
            {
              piece: 'List row',
              icon: 'local_fire_department',
              title: 'Trending New Arrivals',
              sub: '12 curated pieces restocked today',
            },
            {
              piece: 'List row',
              icon: 'local_shipping',
              title: 'Instant Checkout & Apple Pay',
              sub: 'Same-day dispatch on all orders',
            },
            { piece: 'Button', text: 'Add to Bag — $189', style: 'primary' },
            {
              piece: 'Tab bar',
              tabs: [
                ['home', 'Shop'],
                ['search', 'Explore'],
                ['shopping_bag', 'Bag'],
                ['favorite_border', 'Saved'],
                ['person_outline', 'Account'],
              ],
              active: 0,
            },
          ],
        },
      ],
      next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
    }
  }

  // 7. Finance / Crypto / Wallet / Banking
  if (/\b(crypto|wallet|bank|banking|finance|fintech|trading|stocks|payment|portfolio)\b/i.test(lower)) {
    return {
      say: `I built a ${isDark ? 'dark-themed ' : ''}Fintech Portfolio & Wallet screen on your board ✦`,
      screens: [
        {
          name: `Portfolio Wallet${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: 'Portfolio', back: false, icon: 'notifications_none' },
            {
              piece: 'Heading',
              text: '$48,920.40',
              sub: '+$1,842.10 (+3.92%) today · Live market feed',
              size: 26,
            },
            {
              piece: 'Card',
              title: '7-Day Performance Curve',
              text: 'Outperforming benchmark by +6.4% this month',
              img: 'Portfolio growth chart',
            },
            { piece: 'List row', icon: 'Paid', title: 'Bitcoin · BTC', sub: '$91,420.00 · +4.2% · 0.34 BTC' },
            { piece: 'List row', icon: 'bolt', title: 'Solana · SOL', sub: '$218.50 · +8.1% · 45.0 SOL' },
            { piece: 'Button', text: 'Send / Swap Assets ⇄', style: 'primary' },
            {
              piece: 'Tab bar',
              tabs: [
                ['home', 'Wallet'],
                ['insights', 'Markets'],
                ['swap_horiz', 'Swap'],
                ['person_outline', 'Profile'],
              ],
              active: 0,
            },
          ],
        },
      ],
      next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
    }
  }

  // 8. Login / Sign Up / Onboarding Flow
  if (/\b(login|log in|sign[- ]?in|sign[- ]?up|auth|onboard)\b/i.test(lower)) {
    return {
      say: `I put together a ${isDark ? 'dark-themed ' : ''}mobile Sign In & Home flow for “${topic}” ✦`,
      screens: [
        {
          name: `Sign In${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: 'Welcome', back: false },
            { piece: 'Image', img: `${topic} brand artwork`, h: 150 },
            { piece: 'Heading', text: `Sign in to ${topic}`, sub: 'Sync your boards, notes, and AI workflows.' },
            { piece: 'Input', label: 'Email address', text: 'jerry@secondbrain.app' },
            { piece: 'Input', label: 'Password', text: '••••••••••••' },
            { piece: 'Button', text: 'Continue →', style: 'primary' },
          ],
        },
        {
          name: `${topic} — Home${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: topic, back: false, icon: 'notifications_none' },
            { piece: 'Search', text: `Search ${topic}…` },
            {
              piece: 'Card',
              title: 'Today’s Priority Spotlight',
              text: '3 high-impact tasks ready for your review',
              img: 'Spotlight cover preview',
            },
            { piece: 'List row', icon: 'bolt', title: 'Design System Tokens', sub: 'Updated 10m ago · 14 components' },
            { piece: 'List row', icon: 'check_circle', title: 'Launch Readiness Checklist', sub: '6 of 8 milestones complete' },
            {
              piece: 'Tab bar',
              tabs: [
                ['home', 'Home'],
                ['search', 'Explore'],
                ['dashboard', 'Boards'],
                ['person_outline', 'Profile'],
              ],
              active: 0,
            },
          ],
        },
      ],
      next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
    }
  }

  // 9. Dashboard / Analytics / Overview
  if (/\b(dashboard|analytics|metrics|overview|admin|stats)\b/i.test(lower)) {
    return {
      say: `Here is a ${isDark ? 'dark-themed ' : ''}mobile Analytics & KPI Dashboard for “${topic}” ✦`,
      screens: [
        {
          name: `${topic} — Dashboard${themeLabel}`,
          device: 'iPhone',
          theme,
          items: [
            { piece: 'Nav bar', title: `${topic} Analytics`, back: false, icon: 'tune' },
            { piece: 'Search', text: 'Filter metrics, cohorts & funnels…' },
            {
              piece: 'Card',
              title: 'Weekly Growth & Velocity',
              text: '+28.4% active engagement vs last 7 days',
              img: 'Real-time velocity chart',
            },
            { piece: 'List row', icon: 'insights', title: 'Conversion Rate', sub: '4.82% (+0.6% this week)' },
            { piece: 'List row', icon: 'group', title: 'Active Daily Sessions', sub: '18,420 live users online' },
            { piece: 'Button', text: 'Export Full Report ↗', style: 'primary' },
            {
              piece: 'Tab bar',
              tabs: [
                ['insights', 'Overview'],
                ['dashboard', 'Funnels'],
                ['group', 'Audience'],
                ['settings', 'Settings'],
              ],
              active: 0,
            },
          ],
        },
      ],
      next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
    }
  }

  // 10. Custom Topic Mobile Screen (Tailored to whatever topic the user asked for!)
  return {
    say: `I designed a ${isDark ? 'dark-themed ' : ''}mobile screen for “${topic}” — double-click any element to customize ✦`,
    screens: [
      {
        name: `${topic} — Home${themeLabel}`,
        device: 'iPhone',
        theme,
        items: [
          { piece: 'Nav bar', title: topic, back: false, icon: 'notifications_none' },
          { piece: 'Search', text: `Search ${topic.toLowerCase()}…` },
          {
            piece: 'Card',
            title: `${topic} · Featured Spotlight`,
            text: `Explore top picks, live updates, and curated collections in ${topic}.`,
            img: `${topic} featured cover`,
          },
          {
            piece: 'List row',
            icon: 'auto_awesome',
            title: `Trending in ${topic}`,
            sub: 'Updated just now · 12 new items',
          },
          {
            piece: 'List row',
            icon: 'bookmark_border',
            title: 'Saved & Pinned Items',
            sub: 'Quick access to your favorite workflows',
          },
          { piece: 'Button', text: `Explore ${topic} →`, style: 'primary' },
          {
            piece: 'Tab bar',
            tabs: [
              ['home', 'Home'],
              ['search', 'Discover'],
              ['favorite_border', 'Saved'],
              ['person_outline', 'Profile'],
            ],
            active: 0,
          },
        ],
      },
    ],
    next: ['Add the next screen in the flow', 'Make it a website layout', 'Write real copy for these cards'],
  }
}

/**
 * Handles `MB.ask(prompt, snapshot, confirmed, opts)` from Canvas's native engine.
 * Returns a JSON string matching `applyMochi(r, q)` action schema.
 */
export async function handleMochiNativeAsk(
  rawPrompt: string,
  snapshot: MochiBoardSnapshot,
  _confirmed = false,
  _opts: { mobbin?: boolean; higgs?: boolean } = {},
  callbacks: MochiHostCallbacks = {},
): Promise<string> {
  const prompt = rawPrompt.replace(/^\(The person named you [^)]+\)\s*/i, '').trim()
  const lower = prompt.toLowerCase()
  const cards = snapshot?.cards || []
  const selectedCards = cards.filter((c) => c.selected)
  const unsortedCards = snapshot?.unsorted || []

  // 0A. Quick Command / Follow-up: "Write real copy for these cards" / "Write the real copy"
  if (/\b(write (the )?real copy|real copy for|improve copy|rewrite copy|fill in real text|better copy)\b/i.test(lower)) {
    const frames = cards.filter((c) => c.type === 'frame')
    const lastFrame = frames[frames.length - 1]
    const targetTextCards =
      selectedCards.filter((c) => ['text', 'note', 'title'].includes(c.type)).length > 0
        ? selectedCards.filter((c) => ['text', 'note', 'title'].includes(c.type))
        : lastFrame
        ? cards.filter((c) => c.onFrame === lastFrame.id && c.type === 'text')
        : cards.filter((c) => ['text', 'note', 'title'].includes(c.type))

    if (targetTextCards.length > 0) {
      const topic = lastFrame?.name?.replace(/\s*[—-].*$/, '') || snapshot.name || 'Creator App'
      const copyPool = [
        `${topic} · Live Feed`,
        'Search creators, collections & reels…',
        '@alex.studio · Featured Drop',
        '3,420 likes · “Crafted for high-contrast dark mode workflows ✨”',
        'Trending Creators & Stories',
        '18 new updates from people you follow',
        'Saved Collections & Moodboards',
        'Synced across all your devices',
        'Create New Post +',
      ]
      let k = 0
      const edit = targetTextCards
        .filter((c) => {
          const t = (c.text || '').trim()
          return t.length > 2 && !/^(Home|Explore|Search|Post|Reels|Profile|Saved|Shop|Bag)$/i.test(t)
        })
        .map((c) => {
          const t = (c.text || '').trim()
          let replacement = copyPool[k % copyPool.length]
          if (/^(Untitled board|Title|App Screen|Explore)$/i.test(t)) replacement = topic
          else if (/^Search/i.test(t)) replacement = `Search ${topic.toLowerCase()}…`
          else if (/^(Button|Primary Action)$/i.test(t)) replacement = `Launch ${topic} →`
          else k++
          return { id: c.id, text: replacement }
        })

      if (edit.length > 0) {
        return JSON.stringify({
          say: `I updated ${edit.length} text elements on your screen with tailored copy for “${topic}” ✦`,
          edit,
          next: ['Add the next screen in the flow', 'Make it a website layout', 'Try a different color style'],
        })
      }
    }
  }

  // 0B. Quick Command / Follow-up: "Try a different color style" / "Switch to dark theme" / "Make it dark mode" (on existing screen)
  const existingFrames = cards.filter((c) => c.type === 'frame')
  if (
    existingFrames.length > 0 &&
    (/\b(try a different (color )?style|switch to (dark|light)|make it (dark|light) (theme|mode)|change (the )?theme)\b/i.test(lower) ||
      (/^(dark|light) (theme|mode)$/i.test(lower))) &&
    !/\b(create|build|new|another|similar to)\b/i.test(lower)
  ) {
    const targetFrame =
      selectedCards.find((c) => c.type === 'frame') || existingFrames[existingFrames.length - 1]
    const childCards = cards.filter((c) => c.onFrame === targetFrame.id)
    const currentlyDark = isDarkHex(targetFrame.fill)
    const makeDark = /\blight\b/i.test(lower) ? false : /\bdark\b/i.test(lower) ? true : !currentlyDark

    const bg = makeDark ? '#0c0c10' : '#ffffff'
    const surface = makeDark ? '#181820' : '#f4f4f6'
    const textCol = makeDark ? '#f4f4f7' : '#18181b'
    const mutedCol = makeDark ? '#9ca3af' : '#71717a'
    const accentCol = makeDark ? '#e1306c' : '#6366f1'

    const edit: Array<Record<string, unknown>> = [{ id: targetFrame.id, fill: bg }]
    for (const c of childCards) {
      if (c.type === 'box') {
        const isButton = c.h >= 42 && c.h <= 56 && isDarkHex(c.fill)
        edit.push({
          id: c.id,
          fill: isButton ? accentCol : surface,
          stroke: isButton ? accentCol : makeDark ? '#2a2a36' : '#e4e4e7',
        })
      } else if (c.type === 'text') {
        const isMuted = c.color === '#71717a' || c.color === '#9ca3af' || c.color === '#a1a1aa'
        edit.push({
          id: c.id,
          color: isMuted ? mutedCol : textCol,
        })
      } else if (c.type === 'icon') {
        edit.push({
          id: c.id,
          color: textCol,
        })
      }
    }

    return JSON.stringify({
      say: `I restyled “${targetFrame.name || 'your screen'}” into ${makeDark ? 'sleek Dark Theme' : 'clean Light Theme'} ✦`,
      edit,
      next: ['Add the next screen in the flow', 'Write real copy for these cards', 'Make it a website layout'],
    })
  }

  // 0. Direct Selection Edits (color change, rename, connect, delete, summarize selected cards)
  if (selectedCards.length > 0) {
    const colorMatch = lower.match(/\b(white|pink|butter|mint|lilac|sky|peach|yellow|green|blue|purple)\b/)
    if (
      colorMatch &&
      /\b(turn|make|color|paint|change|set)\b/i.test(lower) &&
      !/\b(screen|wireframe|page|image|theme|layout)\b/i.test(lower)
    ) {
      const colorMap: Record<string, (typeof VALID_COLORS)[number]> = {
        white: 'white',
        pink: 'pink',
        butter: 'butter',
        yellow: 'butter',
        mint: 'mint',
        green: 'mint',
        lilac: 'lilac',
        purple: 'lilac',
        sky: 'sky',
        blue: 'sky',
        peach: 'peach',
      }
      const targetColor = colorMap[colorMatch[1]] || 'mint'
      return JSON.stringify({
        say: `I colored ${selectedCards.length === 1 ? 'that card' : `those ${selectedCards.length} cards`} ${targetColor} ✦`,
        edit: selectedCards.map((c) => ({ id: c.id, color: targetColor })),
        next: ['Group these by theme', 'Connect them with arrows', 'Make a checklist from these'],
      })
    }

    if (/\b(connect|link|wire)\s+(these|them|selected|cards)\b/i.test(lower) && selectedCards.length >= 2) {
      const sorted = [...selectedCards].sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x))
      const connect: Array<[string, string]> = []
      for (let i = 0; i < sorted.length - 1; i++) {
        connect.push([sorted[i].id, sorted[i + 1].id])
      }
      return JSON.stringify({
        say: `Connected your ${selectedCards.length} selected cards in order ✦`,
        connect,
        next: ['Group these into a collection', 'Make a checklist from these'],
      })
    }

    const sayMatch = prompt.match(/\b(?:make it say|change text to|rename to)\s+["“']?([^"”']+)["”']?$/i)
    if (sayMatch && selectedCards.length === 1) {
      const newText = sayMatch[1].trim()
      return JSON.stringify({
        say: `Updated the card to say “${newText}” ✦`,
        edit: [{ id: selectedCards[0].id, text: newText }],
      })
    }
  }

  // 1. Auto-Organize / Group by Theme / Tidy / Sort Unsorted
  if (
    /\b(group|sort|organi[sz]e|tidy|rearrange|re-arrange|cluster|clean up|line up|arrange|sort unsorted)\b/i.test(
      lower,
    ) &&
    !/\b(project|folder)\b/i.test(lower)
  ) {
    const targetCards =
      selectedCards.length > 1
        ? selectedCards
        : cards.filter((c) => ['note', 'todo', 'doc', 'link', 'swatch'].includes(c.type))

    if (targetCards.length > 0 || unsortedCards.length > 0) {
      const baseX = targetCards.length > 0 ? Math.min(...targetCards.map((c) => c.x)) : 180
      const baseY = targetCards.length > 0 ? Math.min(...targetCards.map((c) => c.y)) : 140

      const buckets: Record<string, { color: (typeof VALID_COLORS)[number]; ids: string[] }> = {
        'Key Ideas & Notes': { color: 'butter', ids: [] },
        'Action Items & Tasks': { color: 'mint', ids: [] },
        'Research & References': { color: 'sky', ids: [] },
      }

      for (const c of targetCards) {
        const text = `${c.name || ''} ${c.text || ''} ${(c.items || []).join(' ')}`.toLowerCase()
        if (c.type === 'todo' || /\b(todo|task|fix|ship|build|next|step|deadline|test|launch)\b/.test(text)) {
          buckets['Action Items & Tasks'].ids.push(c.id)
        } else if (
          c.type === 'link' ||
          c.type === 'doc' ||
          /\b(http|research|user|quote|pain|insight|competitor|article|source)\b/.test(text)
        ) {
          buckets['Research & References'].ids.push(c.id)
        } else {
          buckets['Key Ideas & Notes'].ids.push(c.id)
        }
      }

      const activeBuckets = Object.entries(buckets).filter(([, b]) => b.ids.length > 0)
      const collections = activeBuckets.map(([name, b], idx) => ({
        name,
        color: b.color,
        x: baseX + idx * 330,
        y: baseY,
        cols: b.ids.length > 4 ? 2 : 1,
      }))

      const edit = activeBuckets.flatMap(([name, b]) =>
        b.ids.map((id) => ({
          id,
          in: name,
          color: b.color,
        })),
      )

      const place = unsortedCards.map((u, idx) => ({
        id: u.id,
        x: baseX + (idx % 3) * 250,
        y: baseY + 340 + Math.floor(idx / 3) * 180,
      }))

      return JSON.stringify({
        say: `I sorted ${targetCards.length} cards into ${collections.length} themed collections${
          place.length ? ` and placed ${place.length} unsorted items onto your board` : ''
        } ✦`,
        collections,
        edit,
        place,
        next: ['Make a checklist from this', 'What am I missing?', 'Design a wireframe for this'],
      })
    }
  }

  // 2. Generate AI Image on Canvas intent
  if (
    /\b(generate|create|draw|paint|render|make)\s+(?:me\s+)?(?:an?\s+)?(ai\s+)?(image|picture|photo|art|artwork|illustration|poster)\b/i.test(
      lower,
    ) ||
    /^\/image\b/i.test(lower)
  ) {
    const cleanPrompt =
      prompt
        .replace(/^\/image\s*/i, '')
        .replace(
          /^(?:can you\s+|please\s+)?(?:generate|create|draw|paint|render|make)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?(?:image|picture|photo|art|artwork|illustration|poster)\s*/i,
          '',
        )
        .replace(/^(?:of|for|about|showing)\s+/i, '')
        .trim() ||
      (selectedCards[0]?.text ? selectedCards[0].text.slice(0, 120) : 'cozy creative studio workspace, studio ghibli & Apple design aesthetic')

    let dataUrl: string | null = null
    if (callbacks.onGenerateImage) {
      try {
        dataUrl = await callbacks.onGenerateImage(cleanPrompt)
      } catch {
        dataUrl = null
      }
    }
    const finalUrl = dataUrl || buildFallbackSvgDataUrl(cleanPrompt, 0)

    return JSON.stringify({
      say: dataUrl
        ? `Here's your newly rendered image for “${cleanPrompt.slice(0, 60)}” pinned right onto the canvas ✦`
        : `I created a visual concept card for “${cleanPrompt.slice(0, 60)}” on your board ✦`,
      images: [
        {
          url: finalUrl,
          caption: cleanPrompt.slice(0, 48),
        },
      ],
      next: ['Generate another variation', 'Pick colors that match this', 'Build a landing page around this'],
    })
  }

  // 3. Build Wireframe Screen / App UI / Website Layout intent (including quick follow-ups!)
  const isScreenIntent =
    /\b(wireframe|screen|mobile app|home screen|login|sign[- ]?up|checkout|onboarding|dashboard|settings page|profile page|profile screen|landing page|pricing page|website|website layout|desktop version|mobile version|ui\b)\b/i.test(
      lower,
    ) &&
    /\b(design|build|make|create|show|draft|layout|add|try|wireframe)\b/i.test(lower)

  if (isScreenIntent) {
    const baseSpec = designDomainScreens(prompt, snapshot)

    // Try local LLM to customize screen copy if available, while preserving theme & valid piece structure
    try {
      const llmRaw = await runTextPrompt(
        `User request: "${prompt}"\nBoard context: "${snapshot.name}"\nDesign a UI screen in JSON.`,
        `Return ONLY valid JSON matching:
{
  "say": "Short warm message ending with ✦",
  "screenName": "Screen Title",
  "navTitle": "Top bar title",
  "cardTitle": "Featured card heading",
  "cardText": "Featured card description",
  "row1Title": "First list row title",
  "row1Sub": "First list row subtitle",
  "row2Title": "Second list row title",
  "row2Sub": "Second list row subtitle",
  "buttonText": "Primary CTA button text"
}
Tailor every field specifically to the user's request ("${prompt}"). No generic placeholders.`,
        280,
        0.3,
      )
      const a = llmRaw.indexOf('{')
      const b = llmRaw.lastIndexOf('}')
      if (a >= 0 && b > a) {
        const parsed = JSON.parse(llmRaw.slice(a, b + 1))
        const firstScreen = baseSpec.screens?.[0]
        if (parsed && firstScreen && firstScreen.device === 'iPhone' && baseSpec.screens.length === 1) {
          if (parsed.screenName) firstScreen.name = String(parsed.screenName)
          if (parsed.say) baseSpec.say = String(parsed.say).endsWith('✦') ? parsed.say : `${parsed.say} ✦`
          for (const item of firstScreen.items as Array<Record<string, unknown>>) {
            if (item.piece === 'Nav bar' && parsed.navTitle) item.title = String(parsed.navTitle)
            if (item.piece === 'Card' && parsed.cardTitle) {
              item.title = String(parsed.cardTitle)
              if (parsed.cardText) item.text = String(parsed.cardText)
              break
            }
          }
          const rows = (firstScreen.items as Array<Record<string, unknown>>).filter((i) => i.piece === 'List row')
          if (rows[0] && parsed.row1Title) {
            rows[0].title = String(parsed.row1Title)
            if (parsed.row1Sub) rows[0].sub = String(parsed.row1Sub)
          }
          if (rows[1] && parsed.row2Title) {
            rows[1].title = String(parsed.row2Title)
            if (parsed.row2Sub) rows[1].sub = String(parsed.row2Sub)
          }
          const btn = (firstScreen.items as Array<Record<string, unknown>>).find((i) => i.piece === 'Button')
          if (btn && parsed.buttonText) btn.text = String(parsed.buttonText)
        }
      }
    } catch {
      // Domain-aware screen architect already built a tailored screen in baseSpec!
    }

    return JSON.stringify(baseSpec)
  }

  // 4. Live Web / News Search onto Canvas
  if (
    /^\/(web|search|news)\b/i.test(lower) ||
    /\b(search the web|search online|from internet|latest news|live update|find online|look up online)\b/i.test(lower)
  ) {
    try {
      const config = await loadAgentConfig()
      const cleanQuery = prompt
        .replace(/^\/(web|search|news)\s*/i, '')
        .replace(/\b(search the web for|search online for|look up online)\s*/i, '')
        .trim()
      const isNews = /\b(news|latest|today|update|headline)\b/i.test(lower)
      const results = isNews
        ? await executeNewsSearch(cleanQuery, 4)
        : await executeWebSearch(cleanQuery, config, { fresh: true })

      if (results.length > 0) {
        const collName = `Web Research: ${cleanQuery.slice(0, 28)}`
        return JSON.stringify({
          say: `I searched the live web for “${cleanQuery}” and pinned ${Math.min(results.length, 4)} sources into a collection ✦`,
          collections: [{ name: collName, color: 'sky', cols: 2 }],
          add: results.slice(0, 4).map((r, idx) => ({
            type: 'note',
            name: r.source || `Source ${idx + 1}`,
            text: `${r.title}\n\n${r.snippet.slice(0, 160)}`,
            color: idx === 0 ? 'sky' : 'white',
            tag: 'WEB',
            in: collName,
          })),
          next: ['Summarize these into a doc', 'Make an action checklist from this', 'Group all cards by theme'],
        })
      }
    } catch {
      // Fall through to LLM
    }
  }

  // 5. Summarize / Write a Doc from the Board
  if (/\b(summarize|summary|write a doc|create a doc|turn into a doc|brief|report)\b/i.test(lower)) {
    const sourceCards = selectedCards.length > 0 ? selectedCards : cards
    const cardBullets = sourceCards
      .filter((c) => c.text || c.name || c.items?.length)
      .slice(0, 12)
      .map((c) => `- **${c.name || c.type.toUpperCase()}**: ${(c.text || (c.items || []).join(', ')).slice(0, 140)}`)
      .join('\n')

    let docBody = `# ${snapshot.name || 'Board Summary'}\n\n## Key Takeaways\n${
      cardBullets || '- Ready to capture key ideas, wireframes, and action items on this board.'
    }\n\n## Next Steps\n- Review core flows and prioritize top tasks\n- Refine open questions with the team`

    try {
      const llmDoc = await runTextPrompt(
        `Board context:\n${summarizeSnapshotForPrompt(snapshot)}\n\nWrite a clean, concise markdown document summarizing this board for: "${prompt}".`,
        'Write a crisp, well-structured Markdown document (# Heading, ## Sections, bullet points). Return ONLY the markdown text.',
        420,
        0.3,
      )
      if (llmDoc && llmDoc.trim().length > 25) {
        docBody = llmDoc.trim()
      }
    } catch {
      // keep structured docBody
    }

    return JSON.stringify({
      say: `I wrote a structured summary doc from your ${sourceCards.length || 'current'} board items ✦`,
      add: [
        {
          type: 'doc',
          text: `${snapshot.name || 'Board'} — Summary`,
          body: docBody,
        },
      ],
      next: ['Make a checklist from this', 'Group notes by theme', 'Design a wireframe screen'],
    })
  }

  // 6. Checklist / Action Plan intent
  if (/\b(checklist|to-?do|action items|action plan|steps|tasks)\b/i.test(lower)) {
    const contextTopics = selectedCards.length
      ? selectedCards.map((c) => c.text || c.name || '').filter(Boolean)
      : cards
          .slice(0, 6)
          .map((c) => c.text || c.name || '')
          .filter(Boolean)

    try {
      const rawText = await runTextPrompt(
        `Board context:\n${summarizeSnapshotForPrompt(snapshot)}\n\nUser request: "${prompt}"`,
        'Return ONLY valid JSON with {"say": string, "add": [{"type": "todo", "text": string, "color": "mint"|"butter"|"pink"|"sky", "items": string[]}], "next": string[]}. Keep items concise (4-6 actionable items).',
        320,
        0.3,
      )
      const first = rawText.indexOf('{')
      const last = rawText.lastIndexOf('}')
      if (first >= 0 && last > first) {
        const parsed = JSON.parse(rawText.slice(first, last + 1))
        if (parsed && (parsed.add || parsed.say)) {
          return JSON.stringify(parsed)
        }
      }
    } catch {
      // fallback below
    }

    const items =
      contextTopics.length >= 2
        ? contextTopics.slice(0, 5).map((t) => `Review & complete: ${t.slice(0, 48)}`)
        : [
            'Define core goal & success metric',
            'Gather reference examples & user notes',
            'Sketch primary user flow on the board',
            'Review with team & refine top priority',
          ]

    return JSON.stringify({
      say: 'I created an actionable checklist on your board ✦',
      add: [
        {
          type: 'todo',
          text: snapshot.name ? `${snapshot.name} — Next Steps` : 'Action Checklist',
          color: 'mint',
          items,
        },
      ],
      next: ['Break this into smaller notes', 'Design a wireframe for step 1', 'Group everything by theme'],
    })
  }

  // 7. Color Swatches / Palette intent
  if (/\b(palette|color scheme|colors|swatches)\b/i.test(lower)) {
    const swatches = [
      { type: 'swatch', hex: '#ff9ec4', label: 'Sakura Pink' },
      { type: 'swatch', hex: '#ffd97d', label: 'Warm Butter' },
      { type: 'swatch', hex: '#7bf1a8', label: 'Fresh Mint' },
      { type: 'swatch', hex: '#90dbf4', label: 'Clear Sky' },
      { type: 'swatch', hex: '#cdb4db', label: 'Soft Lilac' },
    ]
    return JSON.stringify({
      say: 'I dropped a harmonious 5-color palette onto your canvas ✦',
      add: swatches,
      next: ['Pick fonts that match', 'Build a landing page in these colors'],
    })
  }

  // 8. Conversational Questions / Greetings / Board Critique (Answer in chat without dumping unwanted sticky notes!)
  const isConversationalOrQuestion =
    /^(hi|hello|hey|yo|sup|who are you|what can you do|help|how does this work|thanks|thank you)\b/i.test(lower) ||
    (/^(what|why|how|where|when|who|can you explain|tell me|critique|review|analyze|what am i missing)\b/i.test(lower) &&
      !/\b(add|create|make|build|draw|put|place|brainstorm|generate)\b/i.test(lower))

  if (isConversationalOrQuestion) {
    try {
      const reply = await runTextPrompt(
        `${summarizeSnapshotForPrompt(snapshot)}\n\nUser asks Second Brain: "${prompt}"\nReply directly in 1 to 3 warm, helpful, specific sentences:`,
        `You are Second Brain, the warm, sharp AI co-pilot living inside Second Brain's infinite Canvas. Answer the user's question directly and concisely (1-3 sentences), referencing what is actually on their board ("${snapshot.name || 'Untitled board'}") when relevant. End with ✦. Do NOT output JSON.`,
        220,
        0.4,
      )
      const cleanReply = reply.trim().replace(/^["']|["']$/g, '')
      if (cleanReply) {
        return JSON.stringify({
          say: cleanReply.endsWith('✦') ? cleanReply : `${cleanReply} ✦`,
          next: ['Brainstorm sticky notes', 'Design a mobile login screen', 'Make an action checklist'],
        })
      }
    } catch {
      // deterministic conversational fallback below
    }

    if (/^(hi|hello|hey|yo|sup|who are you|what can you do|help)\b/i.test(lower)) {
      return JSON.stringify({
        say: `Hi! I'm Second Brain — your Canvas AI co-pilot. Your board “${snapshot.name || 'Untitled board'}” currently has ${cards.length} item${cards.length === 1 ? '' : 's'}. Ask me to brainstorm notes, group cards by theme, design mobile/web wireframes in dark or light mode, summarize into a doc, or generate AI art ✦`,
        next: ['Create an Instagram home screen in dark theme', 'Design a mobile login screen', 'Generate an AI image'],
      })
    }

    if (/\b(missing|critique|review|improve|feedback)\b/i.test(lower)) {
      const hasTodo = cards.some((c) => c.type === 'todo')
      const hasFrame = cards.some((c) => c.type === 'frame')
      return JSON.stringify({
        say: `Looking at “${snapshot.name || 'Untitled board'}” (${cards.length} items): ${
          !hasFrame
            ? 'you have great concepts, and adding a wireframe screen next would make the user flow concrete'
            : !hasTodo
            ? 'your visual layout looks solid — adding an action checklist will help lock in the next shipping steps'
            : 'your board has a strong mix of notes and structure; grouping related notes into themed collections will make it even easier to scan'
        } ✦`,
        next: ['Add the next screen in the flow', 'Create an action checklist', 'Group notes by theme'],
      })
    }
  }

  // 9. Local LLM Co-Pilot for brainstorming, adding topic cards, or custom canvas actions
  try {
    const systemPrompt = `You are Second Brain, the warm, sharp AI co-pilot built into Second Brain's Canvas.
You MUST reply with a single valid JSON object (no markdown fences outside JSON) that matches this schema:
{
  "say": "Short warm message ending with ✦",
  "collections": [{"name": "Theme Name", "color": "pink"|"butter"|"mint"|"lilac"|"sky"|"peach"}],
  "add": [
    {"type": "note"|"todo"|"title"|"swatch"|"doc", "name": "Short label", "text": "Specific, useful card content", "color": "butter"|"pink"|"mint"|"sky"|"lilac"|"peach"|"white", "items": ["task 1", "task 2"], "in": "Optional Theme Name"}
  ],
  "edit": [
    {"id": "existing_card_id", "text": "Updated text", "color": "pink", "in": "Optional Theme Name"}
  ],
  "connect": [["card_id_1", "card_id_2"]],
  "next": ["Follow-up suggestion 1", "Follow-up suggestion 2"]
}
Only include arrays you actually need. Generate specific, high-signal content tailored to the user's topic.`

    const userMessage = `${summarizeSnapshotForPrompt(snapshot)}\n\nUser request: "${prompt}"\nJSON response:`
    const rawText = await runTextPrompt(userMessage, systemPrompt, 520, 0.35)

    const a = rawText.indexOf('{')
    const b = rawText.lastIndexOf('}')
    if (a >= 0 && b > a) {
      const parsed = JSON.parse(rawText.slice(a, b + 1))
      if (parsed && typeof parsed === 'object') {
        if (!parsed.say) parsed.say = 'Here is what I put together for your board ✦'
        return JSON.stringify(parsed)
      }
    } else if (rawText.trim().length > 10) {
      return JSON.stringify({
        say: `${rawText.trim()} ✦`,
        next: ['Turn this into sticky notes', 'Make a checklist from this', 'Design a wireframe'],
      })
    }
  } catch {
    // Fall through to smart topic-specific fallback
  }

  // 10. Smart topic-aware fallback when no local LLM is installed yet
  const topic =
    prompt
      .replace(
        /^(?:can you\s+|please\s+)?(?:brainstorm|create|add|make|give me|write|suggest|build)\s+(?:some\s+|a\s+|an\s+)?(?:notes|ideas|cards|plan|thoughts|mind\s*map|flowchart)?\s*(?:on|about|for)?\s*/i,
        '',
      )
      .trim() ||
    snapshot.name ||
    'Project Brainstorm'

  const collName = `${topic.slice(0, 32)} — Ideas`
  return JSON.stringify({
    say: `I created a themed collection and checklist for “${topic.slice(0, 45)}” on your canvas ✦`,
    collections: [{ name: collName, color: 'butter', cols: 2 }],
    add: [
      {
        type: 'note',
        name: 'Objective',
        text: `Primary goal & value proposition for ${topic.slice(0, 40)}.`,
        color: pickColor(0),
        in: collName,
      },
      {
        type: 'note',
        name: 'Target Audience & Flow',
        text: `Core user journey and key friction points to solve in ${topic.slice(0, 40)}.`,
        color: pickColor(1),
        in: collName,
      },
      {
        type: 'note',
        name: 'Differentiator',
        text: `What makes ${topic.slice(0, 40)} feel effortless, fast, and memorable.`,
        color: pickColor(2),
        in: collName,
      },
      {
        type: 'todo',
        text: `${topic.slice(0, 28)} — Action Plan`,
        color: 'mint',
        items: [
          `Define scope & milestones for ${topic.slice(0, 28)}`,
          'Sketch primary wireframe screen on the board',
          'Review and prioritize top 3 deliverables',
        ],
      },
    ],
    next: ['Design a wireframe for this', 'Summarize board into a doc', 'Generate an AI image for this'],
  })
}

/**
 * Handles `MB.rewrite(text, how, title, around)` for rewriting selected notes or docs on the canvas.
 */
export async function handleMochiRewrite(
  text: string,
  how: string,
  title = '',
  around: string[] = [],
): Promise<string> {
  const cleanText = String(text || '').trim()
  if (!cleanText) return cleanText

  try {
    const contextStr = around?.length ? `\nNearby cards on board: ${around.slice(0, 5).join(' | ')}` : ''
    const rawText = await runTextPrompt(
      `Card title: "${title}"${contextStr}\nInstruction: Rewrite this to be ${how}.\n\nOriginal text:\n${cleanText}\n\nRewritten text:`,
      'You rewrite text on a visual canvas. Return ONLY the rewritten text itself — no quotes, no preamble, no explanation.',
      350,
      0.3,
    )
    const out = rawText.trim().replace(/^["']|["']$/g, '')
    if (out) return out
  } catch {
    // fallback below
  }

  const h = String(how || '').toLowerCase()
  if (h.includes('short') || h.includes('tight') || h.includes('concise')) {
    const firstSentence = cleanText.split(/(?<=[.!?])\s+/)[0] || cleanText
    return firstSentence.length > 90 ? firstSentence.slice(0, 88).trim() + '…' : firstSentence
  }
  if (h.includes('bullet') || h.includes('list')) {
    return cleanText
      .split(/(?<=[.!?])\s+|\n+/)
      .filter(Boolean)
      .map((line) => `• ${line.replace(/^[•\-*]\s*/, '')}`)
      .join('\n')
  }
  if (h.includes('punch') || h.includes('bold') || h.includes('clear')) {
    return cleanText.replace(/\b(very|really|just|basically|actually)\s+/gi, '').trim()
  }
  return cleanText
}

/**
 * Handles `MB.higgsMake(o)` and `MB.drawFill(o)` to populate wireframe image placeholders.
 */
export async function handleMochiHiggsMake(
  o: { images?: Array<{ id: string; label?: string; w?: number; h?: number }> },
  callbacks: MochiHostCallbacks = {},
): Promise<string> {
  const items = o?.images || []
  const out: Array<{ id: string; url: string; svg?: string }> = []

  for (let i = 0; i < items.length; i++) {
    const im = items[i]
    const prompt = im.label || 'modern clean UI illustration, vibrant soft lighting'
    let url: string | null = null
    if (i === 0 && callbacks.onGenerateImage) {
      try {
        url = await callbacks.onGenerateImage(prompt, { showCard: false })
      } catch {
        url = null
      }
    }
    if (!url) {
      url = buildFallbackSvgDataUrl(im.label || 'Illustration', i, im.w || 360, im.h || 220)
    }
    out.push({ id: im.id, url })
  }

  return JSON.stringify({ images: out })
}
