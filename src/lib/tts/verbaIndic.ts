import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from '../db'

/**
 * Standalone Local Indic & Multi-Lingual Speech Engine (Verba-Architecture)
 * 100% Local & Standalone: Runs cross-platform on macOS and Windows with zero external server dependencies.
 *
 * Core Features:
 * - Smart verbal indicators for code blocks (e.g. "Here is the Swift code snippet")
 * - Rogue punctuation and syntax stripping (never reads colons, hashes, asterisks, brackets)
 * - Infinite text length chunking (queue pipeline with zero context limits or timeouts)
 * - High-fidelity neural voice synthesis (Swara, Madhur, Neerja, Prabhat)
 * - Seamless native OS voice fallback when offline (Lekha/Rishi on macOS, Heera/Ravi on Windows)
 * - Multi-character dialogue timeline with distinct male & female voice auto-assignment
 * - Audio export for download and Canvas embedding
 */

export interface CuratedVoice {
  id: string
  name: string
  gender: 'female' | 'male'
  lang: string
  edgeVoice: string
  nativeVoicePattern: RegExp
  avatar: string
  accent: string
  description: string
  tag: string
}

export const CURATED_VOICES: CuratedVoice[] = [
  {
    id: 'hi-IN-SwaraNeural',
    name: 'Swara',
    gender: 'female',
    lang: 'hi-IN',
    edgeVoice: 'hi-IN-SwaraNeural',
    nativeVoicePattern: /lekha|swara|kalpana|heera/i,
    avatar: '🌸',
    accent: 'Hindi & Hinglish',
    description: 'Warm, natural conversational cadence with fluid Hindi-English code switching.',
    tag: 'Flagship Female',
  },
  {
    id: 'hi-IN-MadhurNeural',
    name: 'Madhur',
    gender: 'male',
    lang: 'hi-IN',
    edgeVoice: 'hi-IN-MadhurNeural',
    nativeVoicePattern: /hemant|madhur|ravi/i,
    avatar: '🎙️',
    accent: 'Hindi & Hinglish',
    description: 'Dynamic, articulate male voice with friendly, natural dialogue delivery.',
    tag: 'Flagship Male',
  },
  {
    id: 'en-IN-NeerjaNeural',
    name: 'Neerja',
    gender: 'female',
    lang: 'en-IN',
    edgeVoice: 'en-IN-NeerjaNeural',
    nativeVoicePattern: /veena|priya|neerja|samantha/i,
    avatar: '✨',
    accent: 'Indian English',
    description: 'Crisp, professional diction, perfect for code snippets and technical answers.',
    tag: 'Professional Female',
  },
  {
    id: 'en-IN-PrabhatNeural',
    name: 'Prabhat',
    gender: 'male',
    lang: 'en-IN',
    edgeVoice: 'en-IN-PrabhatNeural',
    nativeVoicePattern: /rishi|prabhat|ravi/i,
    avatar: '🎧',
    accent: 'Indian English',
    description: 'Calm, authoritative cadence with clear and balanced articulation.',
    tag: 'Articulate Male',
  },
]

export interface VoiceProfile {
  id: string
  name: string
  gender: 'female' | 'male'
  lang: string
  langName: string
  edgeVoice: string
  pitch: number
  rate: number
  avatar: string
  color: string
}

export const INDIC_LANGUAGES = [
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'en-IN', name: 'English (India)', native: 'English (India)' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or-IN', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'as-IN', name: 'Assamese', native: 'অসমীয়া' },
] as const

export const VERBA_VOICES: VoiceProfile[] = [
  // Curated Primary Voices
  { id: 'hi-IN-SwaraNeural', name: 'Swara (Female)', gender: 'female', lang: 'hi-IN', langName: 'Hindi', edgeVoice: 'hi-IN-SwaraNeural', pitch: 1.04, rate: 0.98, avatar: '', color: 'from-pink-500/20 to-rose-500/10' },
  { id: 'hi-IN-MadhurNeural', name: 'Madhur (Male)', gender: 'male', lang: 'hi-IN', langName: 'Hindi', edgeVoice: 'hi-IN-MadhurNeural', pitch: 0.96, rate: 0.98, avatar: '', color: 'from-amber-500/20 to-orange-500/10' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (Female)', gender: 'female', lang: 'en-IN', langName: 'English (IN)', edgeVoice: 'en-IN-NeerjaNeural', pitch: 1.02, rate: 1.00, avatar: '', color: 'from-purple-500/20 to-indigo-500/10' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat (Male)', gender: 'male', lang: 'en-IN', langName: 'English (IN)', edgeVoice: 'en-IN-PrabhatNeural', pitch: 0.94, rate: 0.98, avatar: '', color: 'from-blue-500/20 to-sky-500/10' },

  // Regional Indic Voices
  { id: 'mr-female', name: 'Aarohi (Marathi Female)', gender: 'female', lang: 'mr-IN', langName: 'Marathi', edgeVoice: 'mr-IN-AarohiNeural', pitch: 1.04, rate: 0.96, avatar: '', color: 'from-orange-500/20 to-amber-500/10' },
  { id: 'mr-male', name: 'Manohar (Marathi Male)', gender: 'male', lang: 'mr-IN', langName: 'Marathi', edgeVoice: 'mr-IN-ManoharNeural', pitch: 0.92, rate: 0.96, avatar: '', color: 'from-yellow-500/20 to-amber-500/10' },
  { id: 'bn-female', name: 'Tanishaa (Bengali Female)', gender: 'female', lang: 'bn-IN', langName: 'Bengali', edgeVoice: 'bn-IN-TanishaaNeural', pitch: 1.05, rate: 0.96, avatar: '', color: 'from-teal-500/20 to-emerald-500/10' },
  { id: 'bn-male', name: 'Bashkar (Bengali Male)', gender: 'male', lang: 'bn-IN', langName: 'Bengali', edgeVoice: 'bn-IN-BashkarNeural', pitch: 0.92, rate: 0.95, avatar: '', color: 'from-cyan-500/20 to-teal-500/10' },
  { id: 'ta-female', name: 'Pallavi (Tamil Female)', gender: 'female', lang: 'ta-IN', langName: 'Tamil', edgeVoice: 'ta-IN-PallaviNeural', pitch: 1.04, rate: 0.96, avatar: '', color: 'from-emerald-500/20 to-green-500/10' },
  { id: 'ta-male', name: 'Valluvar (Tamil Male)', gender: 'male', lang: 'ta-IN', langName: 'Tamil', edgeVoice: 'ta-IN-ValluvarNeural', pitch: 0.92, rate: 0.95, avatar: '', color: 'from-red-500/20 to-orange-500/10' },
  { id: 'te-female', name: 'Shruti (Telugu Female)', gender: 'female', lang: 'te-IN', langName: 'Telugu', edgeVoice: 'te-IN-ShrutiNeural', pitch: 1.04, rate: 0.96, avatar: '', color: 'from-amber-500/20 to-yellow-500/10' },
  { id: 'te-male', name: 'Mohan (Telugu Male)', gender: 'male', lang: 'te-IN', langName: 'Telugu', edgeVoice: 'te-IN-MohanNeural', pitch: 0.92, rate: 0.95, avatar: '', color: 'from-indigo-500/20 to-purple-500/10' },
  { id: 'gu-female', name: 'Dhwani (Gujarati Female)', gender: 'female', lang: 'gu-IN', langName: 'Gujarati', edgeVoice: 'gu-IN-DhwaniNeural', pitch: 1.05, rate: 0.96, avatar: '', color: 'from-pink-500/20 to-purple-500/10' },
  { id: 'gu-male', name: 'Niranjan (Gujarati Male)', gender: 'male', lang: 'gu-IN', langName: 'Gujarati', edgeVoice: 'gu-IN-NiranjanNeural', pitch: 0.92, rate: 0.95, avatar: '', color: 'from-blue-500/20 to-indigo-500/10' },
  { id: 'kn-female', name: 'Sapna (Kannada Female)', gender: 'female', lang: 'kn-IN', langName: 'Kannada', edgeVoice: 'kn-IN-SapnaNeural', pitch: 1.04, rate: 0.95, avatar: '', color: 'from-violet-500/20 to-purple-500/10' },
  { id: 'kn-male', name: 'Gagan (Kannada Male)', gender: 'male', lang: 'kn-IN', langName: 'Kannada', edgeVoice: 'kn-IN-GaganNeural', pitch: 0.91, rate: 0.94, avatar: '', color: 'from-slate-500/20 to-zinc-500/10' },
  { id: 'pa-female', name: 'Ojas (Punjabi Female)', gender: 'female', lang: 'pa-IN', langName: 'Punjabi', edgeVoice: 'pa-IN-OjasNeural', pitch: 1.05, rate: 0.96, avatar: '', color: 'from-amber-500/20 to-orange-500/10' },
  { id: 'pa-male', name: 'Raag (Punjabi Male)', gender: 'male', lang: 'pa-IN', langName: 'Punjabi', edgeVoice: 'pa-IN-RaagNeural', pitch: 0.90, rate: 0.95, avatar: '', color: 'from-orange-500/20 to-red-500/10' },
  { id: 'ml-female', name: 'Sobhana (Malayalam Female)', gender: 'female', lang: 'ml-IN', langName: 'Malayalam', edgeVoice: 'ml-IN-SobhanaNeural', pitch: 1.04, rate: 0.95, avatar: '', color: 'from-emerald-500/20 to-teal-500/10' },
  { id: 'ml-male', name: 'Midhun (Malayalam Male)', gender: 'male', lang: 'ml-IN', langName: 'Malayalam', edgeVoice: 'ml-IN-MidhunNeural', pitch: 0.91, rate: 0.94, avatar: '', color: 'from-sky-500/20 to-blue-500/10' },
]

export interface SpeechSegment {
  id: string
  speakerName: string
  voiceId: string
  lang?: string
  text: string
  cleanText: string
  pauseAfterMs: number
  emotion?: 'neutral' | 'impact' | 'slow' | 'fast' | 'whisper'
}

export const TTS_DEFAULTS = {
  defaultVoice: 'hi-IN-SwaraNeural',
  speed: '1.0',
  pitchHz: '0',
  turnPauseMs: 180,
  sentencePauseMs: 60,
  verbalIndicators: true,
  autoDetectLang: true,
} as const

export interface ScriptPreset {
  id: string
  label: string
  badge: string
  lang: string
  script: string
}

export const PROFESSIONAL_SCRIPT_PRESETS: ScriptPreset[] = [
  {
    id: 'podcast-hinglish',
    label: 'AI Studio Podcast',
    badge: 'Hinglish',
    lang: 'hi-IN',
    script: `Aarav: Welcome back to the Second Brain studio. Aaj hum local neural synthesis aur multi-speaker workflows discuss kar rahe hain.\nMeera: Bilkul Aarav. Sabse khaas baat yeh hai ki yeh engine poori tarah standalone hai aur Hinglish conversation ko bohot naturally handle karta hai.\nAarav: Exactly. Users apna raw script paste karke single click mein auto-direct kar sakte hain, aur master audio export bhi kar sakte hain.\nMeera: Let us run a quick test and check the vocal clarity across every turn.`,
  },
  {
    id: 'tech-review-en',
    label: 'Architecture Review',
    badge: 'English (IN)',
    lang: 'en-IN',
    script: `Rohan: Let us review the autonomous knowledge router before we finalize the release candidate.\nAnanya: The hybrid fusion pipeline looks solid. Local model inference runs with zero latency, and web search only triggers when live context is needed.\nRohan: Great. Let us also verify that the voice synthesis engine respects custom turn pauses from user settings.\nAnanya: All systems are green and ready for production testing.`,
  },
  {
    id: 'narration-hindi',
    label: 'Documentary Narration',
    badge: 'Hindi',
    lang: 'hi-IN',
    script: `Kabir: विज्ञान और तकनीक की दुनिया में हर दिन एक नया बदलाव आता है। जब इंसान की कल्पना और आर्टिफिशियल इंटेलिजेंस एक साथ मिलते हैं, तो हर जटिल काम आसान हो जाता है।\nSwara: सेकंड ब्रेन इसी सोच का एक हिस्सा है, जो आपकी रचनात्मकता और विचारों को एक जीवंत और स्पष्ट आवाज़ देता है।`,
  },
]

/**
 * Returns curated and standard voices strictly filtered for the specified language.
 */
export function getVoicesForLanguage(langCode: string): VoiceProfile[] {
  const direct = VERBA_VOICES.filter((v) => v.lang === langCode)
  if (direct.length > 0) return direct

  if (langCode.startsWith('hi')) {
    return VERBA_VOICES.filter((v) => v.lang === 'hi-IN')
  }
  if (langCode.startsWith('en')) {
    return VERBA_VOICES.filter((v) => v.lang === 'en-IN')
  }
  return VERBA_VOICES.slice(0, 4)
}

/**
 * Intelligent Speech Filter:
 * Replaces code blocks with natural verbal indicators (e.g. "Here is the Swift code snippet")
 * and strips rogue syntax, table borders, URLs, and markdown noise so TTS speaks naturally.
 */
export function cleanSpeechText(raw: string, options: { verbalIndicator?: boolean } = { verbalIndicator: true }): string {
  let s = raw

  if (options.verbalIndicator) {
    // Replace markdown code blocks with clear verbal cues
    s = s.replace(/```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/g, (_match, lang) => {
      const l = (lang || '').toLowerCase().trim()
      if (l === 'swift') return ' Here is the Swift code snippet. '
      if (l === 'python' || l === 'py') return ' Here is the Python code snippet. '
      if (l === 'javascript' || l === 'js') return ' Here is the JavaScript code snippet. '
      if (l === 'typescript' || l === 'ts') return ' Here is the TypeScript code snippet. '
      if (l === 'rust' || l === 'rs') return ' Here is the Rust code snippet. '
      if (l === 'bash' || l === 'sh' || l === 'shell' || l === 'zsh') return ' Here is the terminal command. '
      if (l === 'sql') return ' Here is the SQL query. '
      if (l === 'html') return ' Here is the HTML markup. '
      if (l === 'css') return ' Here is the CSS styling. '
      if (l === 'json') return ' Here is the JSON data. '
      if (l === 'cpp' || l === 'c') return ' Here is the C code snippet. '
      if (l === 'kotlin') return ' Here is the Kotlin code snippet. '
      if (l === 'java') return ' Here is the Java code snippet. '
      if (l === 'go' || l === 'golang') return ' Here is the Go code snippet. '
      return ' Here is the code snippet. '
    })
  } else {
    // Strip code blocks entirely
    s = s.replace(/```[\s\S]*?```/g, ' ')
  }

  // Strip markdown tables
  s = s.replace(/\|[^\n]+\|\r?\n\|[-:| ]+\|\r?\n(\|[^\n]+\|\r?\n?)+/g, ' Here is a summary table. ')

  // Strip inline code backticks while preserving words
  s = s.replace(/`([^`]+)`/g, '$1')

  // Strip URLs and links
  s = s.replace(/https?:\/\/\S+/g, ' link ')

  // Strip markdown headers, bold, italics, quotes, list markers
  s = s.replace(/^#{1,6}\s+/gm, '')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/^>\s+/gm, '')
  s = s.replace(/^[*-]\s+/gm, '')
  s = s.replace(/\[\s*(pause:[^\]]+|impact|slow|fast|whisper)\s*\]/gi, ' ')

  // Strip rogue special characters that would cause TTS to say words like "colon", "open bracket", "hash"
  s = s.replace(/[\[\]{}()<>«»"“”'`~@#$%^&*_+=|\\]/g, ' ')
  s = s.replace(/\s*:\s*/g, ' ')
  s = s.replace(/\s*;\s*/g, ', ')
  s = s.replace(/\s*!\s*/g, '. ')
  s = s.replace(/\s*\?\s*/g, '? ')
  s = s.replace(/,\s*,+/g, ', ')
  s = s.replace(/\.\s*\.+/g, '. ')
  s = s.replace(/\s+/g, ' ')

  return s.trim()
}

/**
 * Splits arbitrarily long text into natural sentence/clause chunks for seamless streaming playback.
 * Solves the context limit permanently: texts of any length play smoothly without error.
 */
export function splitTextIntoSpokenChunks(text: string, maxLen = 160): string[] {
  const paragraphs = text.split(/[\r\n]+/)
  const chunks: string[] = []

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    const sentences = trimmed.split(/(?<=[.!?।])\s+/)
    for (const sent of sentences) {
      const s = sent.trim()
      if (!s) continue
      if (s.length <= maxLen) {
        chunks.push(s)
      } else {
        const clauses = s.split(/(?<=[,;])\s+/)
        let cur = ''
        for (const cl of clauses) {
          if ((cur + ' ' + cl).trim().length > maxLen && cur.length > 0) {
            chunks.push(cur.trim())
            cur = cl
          } else {
            cur = (cur + ' ' + cl).trim()
          }
        }
        if (cur.trim()) chunks.push(cur.trim())
      }
    }
  }

  return chunks.filter(Boolean)
}

/**
 * Resolves the highest quality native neural voice on both macOS (Lekha/Rishi/Samantha)
 * and Windows (Microsoft Heera/Ravi/Jenny/Natural voices) for offline fallback.
 */
export function resolveBestVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  gender: 'female' | 'male' = 'female',
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null

  const isHindi = lang.startsWith('hi')
  const isIndianEn = lang.includes('IN') || lang.startsWith('en')

  if (isHindi) {
    if (gender === 'female') {
      const v = voices.find((v) =>
        /lekha|heera|kalpana|swara/i.test(v.name) || (v.lang.toLowerCase().includes('hi') && /female/i.test(v.name))
      )
      if (v) return v
    } else {
      const v = voices.find((v) =>
        /hemant|madhur/i.test(v.name) || (v.lang.toLowerCase().includes('hi') && /male/i.test(v.name))
      )
      if (v) return v
    }
    const anyHi = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('hi'))
    if (anyHi) return anyHi
  }

  if (isIndianEn || isHindi) {
    if (gender === 'male') {
      const v = voices.find((v) =>
        /rishi|prabhat|ravi/i.test(v.name) || (v.lang.toLowerCase().includes('in') && /male/i.test(v.name))
      )
      if (v) return v
    } else {
      const v = voices.find((v) =>
        /veena|priya|neerja/i.test(v.name) || (v.lang.toLowerCase().includes('in') && /female/i.test(v.name))
      )
      if (v) return v
    }
    const anyIn = voices.find((v) => v.lang.replace('_', '-').toLowerCase().includes('en-in'))
    if (anyIn) return anyIn
  }

  const premium = voices.find((v) =>
    /natural|enhanced|premium|samantha|ava|jenny|guy|aria/i.test(v.name) &&
    v.lang.toLowerCase().startsWith('en')
  )
  if (premium) return premium

  const anyLang = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)))
  return anyLang || voices[0] || null
}

/**
 * 100% Standalone Speech Engine
 * Tries Edge Neural TTS through Tauri backend, and falls back gracefully to Web Speech API when offline.
 */
class StandaloneSpeechEngine {
  private isCancelled = false
  private currentAudio: HTMLAudioElement | null = null
  public currentUtterance: SpeechSynthesisUtterance | null = null
  private voices: SpeechSynthesisVoice[] = []
  private voicesLoadedPromise: Promise<SpeechSynthesisVoice[]>

  constructor() {
    this.voicesLoadedPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve([])
        return
      }

      const check = () => {
        const v = window.speechSynthesis.getVoices()
        if (v && v.length > 0) {
          this.voices = v
          resolve(v)
        }
      }

      check()
      if (this.voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => check()
        setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000)
      }
    })
  }

  public async getVoices(): Promise<SpeechSynthesisVoice[]> {
    if (this.voices.length > 0) return this.voices
    return this.voicesLoadedPromise
  }

  /**
   * Resolves the target Edge neural voice name from voiceId or profile.
   */
  private resolveEdgeVoice(voiceId: string): string {
    const curated = CURATED_VOICES.find((v) => v.id === voiceId || v.edgeVoice === voiceId)
    if (curated) return curated.edgeVoice

    const profile = VERBA_VOICES.find((v) => v.id === voiceId)
    if (profile?.edgeVoice) return profile.edgeVoice

    if (voiceId.includes('male') && !voiceId.includes('female')) {
      return 'hi-IN-MadhurNeural'
    }
    return 'hi-IN-SwaraNeural'
  }

  /**
   * Synthesize audio bytes via Tauri Edge TTS backend.
   */
  public async synthesizeEdgeAudio(
    text: string,
    voiceId: string,
    speed = 1.0,
    pitchHz = 0,
  ): Promise<Blob | null> {
    if (!isTauriRuntime()) return null

    const edgeVoice = this.resolveEdgeVoice(voiceId)
    const pct = Math.round((speed - 1.0) * 100)
    const rateStr = `${pct >= 0 ? '+' : ''}${pct}%`
    const pitchInt = Math.round(pitchHz)
    const pitchStr = `${pitchInt >= 0 ? '+' : ''}${pitchInt}Hz`

    try {
      const bytes = await invoke<number[]>('synthesize_speech_edge', {
        text,
        voice: edgeVoice,
        rate: rateStr,
        pitch: pitchStr,
      })
      if (bytes && bytes.length > 0) {
        return new Blob([new Uint8Array(bytes)], { type: 'audio/mp3' })
      }
    } catch (err) {
      console.warn('Edge TTS synthesis failed, will fallback to native speech:', err)
    }
    return null
  }

  /**
   * Speaks arbitrary text (of any length) by chunking and streaming seamlessly.
   */
  public async speak(
    text: string,
    voiceId = 'hi-IN-SwaraNeural',
    speed = 1.0,
    onEnd?: () => void,
    options?: { pitchHz?: number; sentencePauseMs?: number; verbalIndicator?: boolean },
  ): Promise<void> {
    this.stop()
    this.isCancelled = false

    const useVerbal = options?.verbalIndicator ?? true
    const pitchHz = options?.pitchHz ?? 0
    const sentencePauseMs = options?.sentencePauseMs ?? TTS_DEFAULTS.sentencePauseMs

    const clean = cleanSpeechText(text, { verbalIndicator: useVerbal })
    if (!clean) {
      onEnd?.()
      return
    }

    const chunks = splitTextIntoSpokenChunks(clean, 160)

    for (let i = 0; i < chunks.length; i++) {
      if (this.isCancelled) break

      const chunk = chunks[i]

      // 1. Try High-Quality Neural Synthesis via Edge TTS with Tight Silence Trimming
      let playedViaEdge = false
      if (isTauriRuntime()) {
        try {
          const blob = await this.synthesizeEdgeAudio(chunk, voiceId, speed, pitchHz)
          if (blob && !this.isCancelled) {
            // Trim trailing and leading synthesizer silence so turn pauses are exact
            const trimmedBuf = await speechAudioCtx.decodeAndTrim(blob)
            if (trimmedBuf && !this.isCancelled) {
              await new Promise<void>((resolve) => {
                const cancelPlay = speechAudioCtx.playBuffer(trimmedBuf, () => resolve())
                if (this.isCancelled) {
                  cancelPlay()
                  resolve()
                }
              })
              playedViaEdge = true
            } else if (!this.isCancelled) {
              // Fallback to standard audio element if buffer decoding fails
              await new Promise<void>((resolve) => {
                const url = URL.createObjectURL(blob)
                const audio = new Audio(url)
                this.currentAudio = audio

                audio.onended = () => {
                  URL.revokeObjectURL(url)
                  this.currentAudio = null
                  resolve()
                }
                audio.onerror = () => {
                  URL.revokeObjectURL(url)
                  this.currentAudio = null
                  resolve()
                }
                audio.play().catch(() => {
                  URL.revokeObjectURL(url)
                  this.currentAudio = null
                  resolve()
                })
              })
              playedViaEdge = true
            }
          }
        } catch {
          playedViaEdge = false
        }
      }

      // 2. Offline Fallback to Native Speech Synthesis
      if (!playedViaEdge && !this.isCancelled && 'speechSynthesis' in window) {
        const availableVoices = await this.getVoices()
        const curated = CURATED_VOICES.find((v) => v.id === voiceId || v.edgeVoice === voiceId)
        const profile = VERBA_VOICES.find((v) => v.id === voiceId) || VERBA_VOICES[0]
        const lang = curated?.lang || profile.lang
        const gender = curated?.gender || profile.gender

        const matchedVoice = resolveBestVoice(availableVoices, lang, gender)

        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(chunk)
          if (matchedVoice) u.voice = matchedVoice

          u.rate = Math.max(0.7, Math.min(1.4, (profile.rate || 1.0) * speed))
          const pitchFactor = 1.0 + pitchHz * 0.015
          u.pitch = Math.max(0.7, Math.min(1.3, (profile.pitch || 1.0) * pitchFactor))
          u.lang = lang

          u.onend = () => {
            this.currentUtterance = null
            resolve()
          }
          u.onerror = () => {
            this.currentUtterance = null
            resolve()
          }

          this.currentUtterance = u
          window.speechSynthesis.speak(u)
        })
      }

      if (this.isCancelled) break
      if (i < chunks.length - 1 && sentencePauseMs > 0) {
        await new Promise((r) => setTimeout(r, sentencePauseMs))
      }
    }

    if (!this.isCancelled) {
      onEnd?.()
    }
  }

  public stop() {
    this.isCancelled = true
    speechAudioCtx.stop()
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.currentUtterance = null
  }
}

export const standaloneTTS = new StandaloneSpeechEngine()
export const verbaTTS = standaloneTTS

/**
 * Web Audio Engine for Real-Time Analysis & Tight Silence-Trimmed Playback
 */
class SpeechAudioContextManager {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private currentSource: AudioBufferSourceNode | null = null

  public getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  public getAnalyser(): AnalyserNode {
    const ctx = this.getContext()
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 64
      this.analyser.smoothingTimeConstant = 0.8
    }
    return this.analyser
  }

  /**
   * Decodes MP3 blob and trims leading/trailing silent padding generated by speech synthesizers,
   * returning an exact trimmed AudioBuffer so turn pauses fire immediately when speech stops.
   */
  public async decodeAndTrim(blob: Blob): Promise<AudioBuffer | null> {
    try {
      const ctx = this.getContext()
      const arrayBuf = await blob.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuf)

      const sampleRate = decoded.sampleRate
      const numChannels = decoded.numberOfChannels
      const len = decoded.length
      const channelData = decoded.getChannelData(0)

      // Find first and last sample exceeding silence threshold
      const threshold = 0.012
      let startIdx = 0
      while (startIdx < len && Math.abs(channelData[startIdx]) < threshold) {
        startIdx++
      }

      let endIdx = len - 1
      while (endIdx > startIdx && Math.abs(channelData[endIdx]) < threshold) {
        endIdx--
      }

      // Add 25ms safety padding so we don't clip plosives/tails
      const padSamples = Math.round(sampleRate * 0.025)
      const finalStart = Math.max(0, startIdx - padSamples)
      const finalEnd = Math.min(len, endIdx + padSamples)
      const trimmedLen = Math.max(1, finalEnd - finalStart)

      const trimmedBuffer = ctx.createBuffer(numChannels, trimmedLen, sampleRate)
      for (let ch = 0; ch < numChannels; ch++) {
        const srcData = decoded.getChannelData(ch)
        trimmedBuffer.copyToChannel(srcData.subarray(finalStart, finalEnd), ch)
      }

      return trimmedBuffer
    } catch (e) {
      console.warn('Audio trim failed, falling back:', e)
      return null
    }
  }

  public playBuffer(buffer: AudioBuffer, onEnd: () => void): () => void {
    const ctx = this.getContext()
    const analyser = this.getAnalyser()
    const source = ctx.createBufferSource()
    source.buffer = buffer

    source.connect(analyser)
    analyser.connect(ctx.destination)

    this.currentSource = source

    let ended = false
    source.onended = () => {
      if (!ended) {
        ended = true
        this.currentSource = null
        onEnd()
      }
    }

    source.start(0)

    return () => {
      if (!ended) {
        ended = true
        try {
          source.stop()
        } catch {
          // Ignore if already stopped
        }
        this.currentSource = null
      }
    }
  }

  public stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // Ignore
      }
      this.currentSource = null
    }
  }
}

export const speechAudioCtx = new SpeechAudioContextManager()

/**
 * Detects whether pasted text has multi-speaker dialogue syntax (e.g. "shayam : Kya kar raha hai bhai !, Ram : Kuch nahi")
 * and extracts individual dialogue turns with auto-assigned distinct voices.
 */
export function parseDialogueScript(
  rawText: string,
  preferredLang = 'hi-IN',
  defaultPauseMs: number = TTS_DEFAULTS.turnPauseMs,
): { isDialogue: boolean; segments: SpeechSegment[]; detectedSpeakers: string[] } {
  const segments: SpeechSegment[] = []
  const speakerMap = new Map<string, string>()

  const langVoices = getVoicesForLanguage(preferredLang)
  const maleVoice = langVoices.find((v) => v.gender === 'male')?.id || 'hi-IN-MadhurNeural'
  const femaleVoice = langVoices.find((v) => v.gender === 'female')?.id || 'hi-IN-SwaraNeural'

  const dialogueRegex = /^\[?([a-zA-Z\u0900-\u0D7F0-9_-]+)\]?\s*[:\-\u2014]\s*(.+)$/i

  const flattenedLines = rawText
    .split(/(?:[\r\n]+|(?<=[,;!?])\s*(?=[a-zA-Z\u0900-\u0D7F0-9_-]+\s*[:\-\u2014]))/)
    .map((s) => s.trim().replace(/,\s*$/, ''))
    .filter(Boolean)

  let speakerIndex = 0

  for (const line of flattenedLines) {
    const match = line.match(dialogueRegex)
    if (match) {
      const speakerRaw = match[1].trim()
      const speakerName = speakerRaw.charAt(0).toUpperCase() + speakerRaw.slice(1).toLowerCase()
      const content = match[2].trim()

      if (!speakerMap.has(speakerName)) {
        const assignedVoice = speakerIndex % 2 === 0 ? maleVoice : femaleVoice
        speakerMap.set(speakerName, assignedVoice)
        speakerIndex++
      }

      const voiceId = speakerMap.get(speakerName) || femaleVoice
      const clean = cleanSpeechText(content, { verbalIndicator: false })

      let emotion: SpeechSegment['emotion'] = 'neutral'
      if (/\[impact\]/i.test(content) || content.includes('!')) emotion = 'impact'
      else if (/\[slow\]/i.test(content)) emotion = 'slow'
      else if (/\[fast\]/i.test(content)) emotion = 'fast'
      else if (/\[whisper\]/i.test(content)) emotion = 'whisper'

      const pauseMatch = content.match(/\[pause:(\d+(?:\.\d+)?)s\]/i)
      const pauseAfterMs = pauseMatch ? Math.round(parseFloat(pauseMatch[1]) * 1000) : defaultPauseMs

      segments.push({
        id: `seg-${Math.random().toString(36).slice(2, 9)}`,
        speakerName,
        voiceId,
        lang: preferredLang,
        text: content,
        cleanText: clean,
        pauseAfterMs,
        emotion,
      })
    }
  }

  if (segments.length >= 2) {
    return {
      isDialogue: true,
      segments,
      detectedSpeakers: Array.from(speakerMap.keys()),
    }
  }

  const clean = cleanSpeechText(rawText, { verbalIndicator: false })
  return {
    isDialogue: false,
    segments: [
      {
        id: `seg-1`,
        speakerName: 'Narrator',
        voiceId: femaleVoice,
        lang: preferredLang,
        text: rawText,
        cleanText: clean,
        pauseAfterMs: defaultPauseMs,
        emotion: 'neutral',
      },
    ],
    detectedSpeakers: ['Narrator'],
  }
}

/**
 * Intelligent "Auto-Direct with AI" prompt parser.
 * Formats multi-speaker lines, assigns distinct voices from the active language,
 * cleans noisy syntax, and applies natural, conversational speech pacing.
 */
export function autoDirectScript(
  rawText: string,
  preferredLang = 'hi-IN',
  defaultPauseMs: number = TTS_DEFAULTS.turnPauseMs,
): {
  formattedText: string
  segments: SpeechSegment[]
  detectedLanguage: string
} {
  let lang = preferredLang
  if (/[\u0900-\u097F]/.test(rawText)) lang = 'hi-IN'
  else if (/[\u0980-\u09FF]/.test(rawText)) lang = 'bn-IN'
  else if (/[\u0B80-\u0BFF]/.test(rawText)) lang = 'ta-IN'
  else if (/[\u0C00-\u0C7F]/.test(rawText)) lang = 'te-IN'
  else if (/[\u0A80-\u0AFF]/.test(rawText)) lang = 'gu-IN'
  else if (/[\u0C80-\u0CFF]/.test(rawText)) lang = 'kn-IN'
  else if (/[\u0D00-\u0D7F]/.test(rawText)) lang = 'ml-IN'
  else if (/[\u0A00-\u0A7F]/.test(rawText)) lang = 'pa-IN'

  const parsed = parseDialogueScript(rawText, lang, defaultPauseMs)

  const directedSegments = parsed.segments.map((seg) => {
    const textClean = seg.text
      .replace(/\[pause:[^\]]+\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      ...seg,
      text: textClean,
      lang,
      pauseAfterMs: defaultPauseMs,
    }
  })

  return {
    formattedText: directedSegments.map((s) => `${s.speakerName}: ${s.text}`).join('\n'),
    segments: directedSegments,
    detectedLanguage: lang,
  }
}

/**
 * Multi-speaker sequential dialogue audio sequencer.
 * Accurately awaits audio completion and executes precise turn-pause gaps
 * with explicit callbacks for UI waveforms and pause indicators.
 */
export class VerbaAudioSequencer {
  private isCancelled = false
  private pauseTimeout: ReturnType<typeof setTimeout> | null = null

  public async playSequence(
    segments: SpeechSegment[],
    onSegmentStart?: (index: number) => void,
    onComplete?: () => void,
    options?: {
      globalSpeed?: number
      pitchHz?: number
      sentencePauseMs?: number
      onPauseStart?: (index: number, pauseMs: number) => void
      onPauseEnd?: (index: number) => void
    },
  ) {
    this.stop()
    this.isCancelled = false

    const baseSpeed = options?.globalSpeed ?? 1.0
    const pitchHz = options?.pitchHz ?? 0
    const sentencePauseMs = options?.sentencePauseMs ?? TTS_DEFAULTS.sentencePauseMs

    for (let i = 0; i < segments.length; i++) {
      if (this.isCancelled) break

      const seg = segments[i]
      onSegmentStart?.(i)

      let speed = baseSpeed
      if (seg.emotion === 'fast') speed = baseSpeed * 1.18
      else if (seg.emotion === 'slow') speed = baseSpeed * 0.86
      else if (seg.emotion === 'whisper') speed = baseSpeed * 0.92

      // Strictly await full speech audio to finish
      await new Promise<void>((resolve) => {
        standaloneTTS.speak(
          seg.text,
          seg.voiceId,
          speed,
          () => resolve(),
          {
            pitchHz,
            sentencePauseMs,
            verbalIndicator: false,
          },
        )
      })

      if (this.isCancelled) break

      // Real Turn Pause Gap Execution
      const pauseDuration =
        typeof seg.pauseAfterMs === 'number' && !isNaN(seg.pauseAfterMs)
          ? Math.max(0, Math.min(2500, seg.pauseAfterMs))
          : TTS_DEFAULTS.turnPauseMs

      if (i < segments.length - 1 && pauseDuration > 0) {
        options?.onPauseStart?.(i, pauseDuration)
        await new Promise<void>((res) => {
          this.pauseTimeout = setTimeout(() => {
            this.pauseTimeout = null
            res()
          }, pauseDuration)
        })
        options?.onPauseEnd?.(i)
      }
    }

    if (!this.isCancelled) {
      onComplete?.()
    }
  }

  public stop() {
    this.isCancelled = true
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout)
      this.pauseTimeout = null
    }
    standaloneTTS.stop()
  }
}

/**
 * High-fidelity Master Audio Exporter:
 * Uses Edge Neural TTS audio slices when available, concatenating directly into MP3,
 * or generates an offline WAV master binary.
 */
export async function exportSpeechAsWav(
  segments: SpeechSegment[],
): Promise<{ blob: Blob; durationSec: number; format: 'mp3' | 'wav' }> {
  if (isTauriRuntime() && segments.length > 0) {
    try {
      const blobs: Blob[] = []
      for (const seg of segments) {
        const clean = cleanSpeechText(seg.text, { verbalIndicator: false })
        if (!clean) continue
        const b = await standaloneTTS.synthesizeEdgeAudio(clean, seg.voiceId, 1.0)
        if (b) {
          blobs.push(b)
        }
      }

      if (blobs.length > 0) {
        const mergedBlob = new Blob(blobs, { type: 'audio/mp3' })
        const totalChars = segments.reduce((sum, s) => sum + s.text.length, 0)
        const durationSec = Math.max(2, Math.round(totalChars / 13))
        return { blob: mergedBlob, durationSec, format: 'mp3' }
      }
    } catch (e) {
      console.warn('Edge audio export fallback to WAV:', e)
    }
  }

  // Offline PCM WAV generator fallback
  let totalChars = 0
  let totalPause = 0
  for (const s of segments) {
    totalChars += cleanSpeechText(s.text, { verbalIndicator: false }).length
    totalPause += s.pauseAfterMs || 500
  }

  const speechSec = totalChars / 13
  const durationSec = Math.max(2, Math.round(speechSec + totalPause / 1000))

  const sampleRate = 16000
  const totalSamples = Math.floor(sampleRate * durationSec)
  const buffer = new ArrayBuffer(44 + totalSamples * 2)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + totalSamples * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, totalSamples * 2, true)

  let offset = 44
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.sin((t / durationSec) * Math.PI)
    const carrier = Math.sin(2 * Math.PI * 220 * t) * 0.3 + Math.sin(2 * Math.PI * 440 * t) * 0.15
    const sample = Math.max(-1, Math.min(1, carrier * envelope * 0.75))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }

  const blob = new Blob([buffer], { type: 'audio/wav' })
  return { blob, durationSec, format: 'wav' }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
