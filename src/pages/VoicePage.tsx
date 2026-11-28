import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AudioLines,
  Download,
  Pause,
  Play,
  Plus,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Wand2,
} from 'lucide-react'
import { getSetting, setSetting } from '../lib/db'
import { useToast } from '../lib/toast'
import {
  INDIC_LANGUAGES,
  PROFESSIONAL_SCRIPT_PRESETS,
  TTS_DEFAULTS,
  type SpeechSegment,
  autoDirectScript,
  cleanSpeechText,
  exportSpeechAsWav,
  getVoicesForLanguage,
  parseDialogueScript,
  VerbaAudioSequencer,
  standaloneTTS,
  speechAudioCtx,
} from '../lib/tts/verbaIndic'

// Voice theme palette for real-time waveform visualization & character styling
const VOICE_COLOR_MAP: Record<
  string,
  {
    waveColor: string
    activeBar: string
    badgeBg: string
    border: string
    ring: string
  }
> = {
  'hi-IN-SwaraNeural': {
    waveColor: '#f43f5e',
    activeBar: 'bg-rose-500',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    border: 'border-rose-500/30',
    ring: 'ring-rose-500/30',
  },
  'hi-IN-MadhurNeural': {
    waveColor: '#f59e0b',
    activeBar: 'bg-amber-500',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/30',
  },
  'en-IN-NeerjaNeural': {
    waveColor: '#a855f7',
    activeBar: 'bg-purple-500',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    border: 'border-purple-500/30',
    ring: 'ring-purple-500/30',
  },
  'en-IN-PrabhatNeural': {
    waveColor: '#0ea5e9',
    activeBar: 'bg-sky-500',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    border: 'border-sky-500/30',
    ring: 'ring-sky-500/30',
  },
  default: {
    waveColor: '#10b981',
    activeBar: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/30',
  },
}

function getVoiceStyling(voiceId: string) {
  return VOICE_COLOR_MAP[voiceId] || VOICE_COLOR_MAP.default
}

export function VoicePage() {
  const { showToast } = useToast()
  const [selectedLang, setSelectedLang] = useState<string>('hi-IN')
  const [activePresetId, setActivePresetId] = useState<string>(PROFESSIONAL_SCRIPT_PRESETS[0].id)
  const [rawScript, setRawScript] = useState<string>(PROFESSIONAL_SCRIPT_PRESETS[0].script)
  const [segments, setSegments] = useState<SpeechSegment[]>([])
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1)
  const [isPausing, setIsPausing] = useState<boolean>(false)
  const [pauseDurationActive, setPauseDurationActive] = useState<number>(0)
  const [exporting, setExporting] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  // Real-time Audio Visualizer state
  const [waveHeights, setWaveHeights] = useState<number[]>([4, 6, 8, 12, 16, 10, 6, 4])
  const animationFrameRef = useRef<number | null>(null)

  // Studio Settings (synced with user Settings)
  const [defaultPauseMs, setDefaultPauseMs] = useState<number>(TTS_DEFAULTS.turnPauseMs)
  const [studioSpeed, setStudioSpeed] = useState<number>(1.0)
  const [studioPitchHz, setStudioPitchHz] = useState<number>(0)
  const [sentencePauseMs, setSentencePauseMs] = useState<number>(TTS_DEFAULTS.sentencePauseMs)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const sequencerRef = useRef<VerbaAudioSequencer | null>(null)

  if (!sequencerRef.current) {
    sequencerRef.current = new VerbaAudioSequencer()
  }

  // Load saved user preferences from DB
  useEffect(() => {
    let cancelled = false
    async function loadPrefs() {
      try {
        const [savedPause, savedSpeed, savedPitch, savedSentPause] = await Promise.all([
          getSetting('tts_pause_ms'),
          getSetting('tts_speed'),
          getSetting('tts_pitch'),
          getSetting('tts_sentence_pause_ms'),
        ])
        if (cancelled) return

        const resolvedPause =
          savedPause && !isNaN(Number(savedPause))
            ? Math.max(0, Math.min(1000, Number(savedPause)))
            : TTS_DEFAULTS.turnPauseMs
        setDefaultPauseMs(resolvedPause)

        if (savedSpeed && !isNaN(Number(savedSpeed))) {
          setStudioSpeed(Number(savedSpeed))
        }
        if (savedPitch && !isNaN(Number(savedPitch))) {
          setStudioPitchHz(Number(savedPitch))
        }
        if (savedSentPause && !isNaN(Number(savedSentPause))) {
          setSentencePauseMs(Number(savedSentPause))
        }

        const parsed = parseDialogueScript(
          PROFESSIONAL_SCRIPT_PRESETS[0].script,
          PROFESSIONAL_SCRIPT_PRESETS[0].lang,
          resolvedPause,
        )
        setSegments(parsed.segments)
      } catch {
        const parsed = parseDialogueScript(
          PROFESSIONAL_SCRIPT_PRESETS[0].script,
          'hi-IN',
          TTS_DEFAULTS.turnPauseMs,
        )
        setSegments(parsed.segments)
      }
    }
    loadPrefs()
    return () => {
      cancelled = true
      sequencerRef.current?.stop()
      standaloneTTS.stop()
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // True Real-Time Audio Spectrum Visualizer Loop
  useEffect(() => {
    if (!isPlaying || isPausing) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    let running = true
    const analyser = speechAudioCtx.getAnalyser()
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateWave = () => {
      if (!running) return
      analyser.getByteFrequencyData(dataArray)

      // Sample 12 frequency bands across human speech range
      const step = Math.max(1, Math.floor(dataArray.length / 12))
      const heights: number[] = []
      for (let i = 0; i < 12; i++) {
        const val = dataArray[i * step] || 0
        // Map 0-255 to bar pixel height 4px - 26px
        const h = Math.max(3, Math.round((val / 255) * 24) + 3)
        heights.push(h)
      }
      setWaveHeights(heights)
      animationFrameRef.current = requestAnimationFrame(updateWave)
    }

    animationFrameRef.current = requestAnimationFrame(updateWave)

    return () => {
      running = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isPlaying, isPausing])

  // Apply script preset
  function handleApplyPreset(presetId: string) {
    const preset = PROFESSIONAL_SCRIPT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    sequencerRef.current?.stop()
    standaloneTTS.stop()
    setIsPlaying(false)
    setActiveSegmentIndex(-1)
    setIsPausing(false)
    setPreviewingId(null)

    setActivePresetId(preset.id)
    setSelectedLang(preset.lang)
    setRawScript(preset.script)
    const parsed = parseDialogueScript(preset.script, preset.lang, defaultPauseMs)
    setSegments(parsed.segments)
    showToast(`Loaded ${preset.label} preset`, 'info')
  }

  // Auto-Direct with AI
  function handleAutoDirect() {
    sequencerRef.current?.stop()
    standaloneTTS.stop()
    setIsPlaying(false)
    setActiveSegmentIndex(-1)
    setIsPausing(false)
    setPreviewingId(null)

    const result = autoDirectScript(rawScript, selectedLang, defaultPauseMs)
    setSegments(result.segments)
    if (result.detectedLanguage && result.detectedLanguage !== selectedLang) {
      setSelectedLang(result.detectedLanguage)
    }

    showToast(
      `Auto-directed ${result.segments.length} turns with ${defaultPauseMs}ms pauses`,
      'success',
    )
  }

  // Sync turn pause across studio and persist
  async function handleChangeDefaultPause(ms: number) {
    const clamped = Math.max(0, Math.min(1000, Math.round(ms)))
    setDefaultPauseMs(clamped)
    setSegments((prev) => prev.map((s) => ({ ...s, pauseAfterMs: clamped })))
    await setSetting('tts_pause_ms', String(clamped)).catch(() => {})
    showToast(`Turn pause set to ${clamped}ms`, 'info')
  }

  // Update speed
  async function handleChangeSpeed(spd: number) {
    setStudioSpeed(spd)
    await setSetting('tts_speed', String(spd)).catch(() => {})
  }

  // Reset to clean factory defaults
  async function handleResetStudioDefaults() {
    sequencerRef.current?.stop()
    standaloneTTS.stop()
    setIsPlaying(false)
    setActiveSegmentIndex(-1)
    setIsPausing(false)
    setPreviewingId(null)

    const defPause = TTS_DEFAULTS.turnPauseMs
    setDefaultPauseMs(defPause)
    setStudioSpeed(1.0)
    setStudioPitchHz(0)
    setSentencePauseMs(TTS_DEFAULTS.sentencePauseMs)

    await Promise.all([
      setSetting('tts_pause_ms', String(defPause)),
      setSetting('tts_speed', '1.0'),
      setSetting('tts_pitch', '0'),
      setSetting('tts_sentence_pause_ms', String(TTS_DEFAULTS.sentencePauseMs)),
    ]).catch(() => {})

    const defaultPreset = PROFESSIONAL_SCRIPT_PRESETS[0]
    setActivePresetId(defaultPreset.id)
    setSelectedLang(defaultPreset.lang)
    setRawScript(defaultPreset.script)
    const parsed = parseDialogueScript(defaultPreset.script, defaultPreset.lang, defPause)
    setSegments(parsed.segments)
    showToast('Reset Voice Studio to defaults (180ms pause, 1.0x speed)', 'success')
  }

  // Insert token at cursor
  function handleInsertToken(token: string) {
    if (!textareaRef.current) {
      setRawScript((prev) => `${prev.trimEnd()} ${token}`)
      return
    }
    const el = textareaRef.current
    const start = el.selectionStart ?? rawScript.length
    const end = el.selectionEnd ?? rawScript.length
    const next = rawScript.slice(0, start) + ` ${token} ` + rawScript.slice(end)
    setRawScript(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length + 2, start + token.length + 2)
    }, 10)
  }

  // Segment modifiers
  function handleUpdateSegmentLang(segmentId: string, newLang: string) {
    const voices = getVoicesForLanguage(newLang)
    const newVoice = voices[0]?.id || 'hi-IN-SwaraNeural'
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, lang: newLang, voiceId: newVoice } : s)),
    )
  }

  function handleUpdateVoice(segmentId: string, newVoiceId: string) {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, voiceId: newVoiceId } : s)),
    )
  }

  function handleAssignSpeakerVoice(speakerName: string, newVoiceId: string) {
    setSegments((prev) =>
      prev.map((s) =>
        s.speakerName.toLowerCase() === speakerName.toLowerCase()
          ? { ...s, voiceId: newVoiceId }
          : s,
      ),
    )
    showToast(`Assigned voice to "${speakerName}"`, 'info')
  }

  function handleUpdateSpeakerName(segmentId: string, name: string) {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, speakerName: name } : s)),
    )
  }

  function handleUpdateSegmentText(segmentId: string, newText: string) {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId ? { ...s, text: newText, cleanText: cleanSpeechText(newText) } : s,
      ),
    )
  }

  function handleUpdatePause(segmentId: string, pauseMs: number) {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, pauseAfterMs: pauseMs } : s)),
    )
  }

  function handleRemoveSegment(segmentId: string) {
    setSegments((prev) => prev.filter((s) => s.id !== segmentId))
  }

  function handleAddSegment() {
    const voices = getVoicesForLanguage(selectedLang)
    const defaultVoice =
      segments.length % 2 === 0
        ? voices.find((v) => v.gender === 'male')?.id || voices[0]?.id || 'hi-IN-MadhurNeural'
        : voices.find((v) => v.gender === 'female')?.id || voices[0]?.id || 'hi-IN-SwaraNeural'

    const newSeg: SpeechSegment = {
      id: `seg-${Math.random().toString(36).slice(2, 9)}`,
      speakerName: `Speaker ${segments.length + 1}`,
      voiceId: defaultVoice,
      lang: selectedLang,
      text: 'Type dialogue line here...',
      cleanText: 'Type dialogue line here',
      pauseAfterMs: defaultPauseMs,
      emotion: 'neutral',
    }
    setSegments((prev) => [...prev, newSeg])
  }

  // Play / Pause Master Sequence
  async function handleTogglePlay() {
    if (isPlaying) {
      sequencerRef.current?.stop()
      setIsPlaying(false)
      setActiveSegmentIndex(-1)
      setIsPausing(false)
      return
    }

    if (segments.length === 0) {
      showToast('Please add script text to synthesize.', 'warning')
      return
    }

    setPreviewingId(null)
    setIsPlaying(true)
    setIsPausing(false)

    try {
      await sequencerRef.current?.playSequence(
        segments,
        (idx) => {
          setActiveSegmentIndex(idx)
          setIsPausing(false)
        },
        () => {
          setIsPlaying(false)
          setActiveSegmentIndex(-1)
          setIsPausing(false)
        },
        {
          globalSpeed: studioSpeed,
          pitchHz: studioPitchHz,
          sentencePauseMs,
          onPauseStart: (_idx, pauseMs) => {
            setIsPausing(true)
            setPauseDurationActive(pauseMs)
          },
          onPauseEnd: () => {
            setIsPausing(false)
          },
        },
      )
    } catch (err) {
      console.error(err)
      setIsPlaying(false)
      setActiveSegmentIndex(-1)
      setIsPausing(false)
      showToast('Speech error: ' + (err as Error).message, 'warning')
    }
  }

  // Preview individual segment
  async function handlePreviewSegment(seg: SpeechSegment) {
    if (previewingId === seg.id) {
      standaloneTTS.stop()
      setPreviewingId(null)
      return
    }

    sequencerRef.current?.stop()
    setIsPlaying(false)
    setActiveSegmentIndex(-1)
    setIsPausing(false)
    setPreviewingId(seg.id)

    try {
      await standaloneTTS.speak(
        seg.text,
        seg.voiceId,
        studioSpeed,
        () => {
          setPreviewingId((cur) => (cur === seg.id ? null : cur))
        },
        {
          pitchHz: studioPitchHz,
          sentencePauseMs,
          verbalIndicator: false,
        },
      )
    } catch {
      setPreviewingId(null)
    }
  }

  // Download sequence
  async function handleDownloadAudio() {
    if (segments.length === 0) return
    setExporting(true)
    try {
      const { blob, durationSec, format } = await exportSpeechAsWav(segments)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `voice-studio-${Date.now()}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Exported ${durationSec}s master audio (${format.toUpperCase()})`, 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to export audio file', 'warning')
    } finally {
      setExporting(false)
    }
  }

  function handleCopyScript() {
    const text = segments.map((s) => `${s.speakerName}: ${s.text}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Script copied to clipboard', 'info')
  }

  // Cast members
  const uniqueSpeakers = Array.from(
    new Map(segments.map((s) => [s.speakerName, s])).values(),
  )

  const activeSegment =
    activeSegmentIndex >= 0 && segments[activeSegmentIndex]
      ? segments[activeSegmentIndex]
      : segments[0] || null

  const activeVoiceStyle = activeSegment ? getVoiceStyling(activeSegment.voiceId) : VOICE_COLOR_MAP.default

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 pb-32 select-none sm:px-5">
      {/* ===================================================================== */}
      {/* 1. TOP HEADER & QUICK ACTIONS (PROPER TOP-RIGHT ALIGNMENT)            */}
      {/* ===================================================================== */}
      <div className="flex w-full items-start justify-between gap-4 pt-1 pb-1">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Voice Studio</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Multi-speaker neural dialogue synthesis with AI auto-directing and exact turn pauses.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/settings?tab=voice"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            <Sliders size={13} />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={handleResetStudioDefaults}
            title="Reset script and pacing to defaults"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. TOP BENTO ROW: LANGUAGE, TURN PAUSE GAP, PLAYBACK SPEED            */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        {/* Language Selection Card */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs lg:col-span-4 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
              <AudioLines size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Studio Language
              </div>
              <div className="text-xs font-semibold text-[var(--text)] truncate">
                Filters voices automatically
              </div>
            </div>
          </div>
          <select
            value={selectedLang}
            onChange={(e) => {
              const newLang = e.target.value
              setSelectedLang(newLang)
              const parsed = parseDialogueScript(rawScript, newLang, defaultPauseMs)
              setSegments(parsed.segments)
            }}
            className="shrink-0 max-w-[150px] truncate rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] outline-none hover:border-[var(--accent)] cursor-pointer"
          >
            {INDIC_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Global Turn Pause Gap Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs lg:col-span-5 min-w-0">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Turn Pause Gap
              </span>
              <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.2 font-mono text-[10px] font-bold text-[var(--accent)]">
                {defaultPauseMs}ms
              </span>
            </div>
            <div className="text-xs font-semibold text-[var(--text)]">
              Silence delay between speakers
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[40, 100, 180, 260, 400].map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => handleChangeDefaultPause(ms)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-all ${
                  defaultPauseMs === ms
                    ? 'bg-[var(--accent)] text-white shadow-2xs'
                    : 'border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {ms}ms
              </button>
            ))}
          </div>
        </div>

        {/* Playback Speed Multiplier */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs sm:col-span-2 lg:col-span-3 min-w-0">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Playback Speed
            </div>
            <div className="text-xs font-semibold text-[var(--text)]">
              Vocal cadence
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[0.85, 1.0, 1.15].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => handleChangeSpeed(spd)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  studioSpeed === spd
                    ? 'bg-[var(--accent)] text-white shadow-2xs'
                    : 'border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {spd === 1.0 ? '1.0x' : `${spd}x`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. MAIN WORKSPACE (BENTO GRID: LEFT SCRIPT, RIGHT TIMELINE)           */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* ----------------------------------------------------------------- */}
        {/* LEFT COLUMN (5 COLS): SCRIPT INPUT & TEMPLATES                    */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-4 lg:col-span-5 min-w-0">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Script Director</h3>
                <p className="text-[11px] text-[var(--muted)]">
                  Select a template or paste multi-speaker dialogue
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoDirect}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20 active:scale-95 transition-all"
              >
                <Wand2 size={13} />
                <span>Auto-Direct</span>
              </button>
            </div>

            {/* Presets Grid without Emojis, Clean Badges */}
            <div className="grid grid-cols-3 gap-2">
              {PROFESSIONAL_SCRIPT_PRESETS.map((preset) => {
                const active = activePresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`flex flex-col items-start justify-between rounded-xl border p-2.5 text-left transition-all ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)] shadow-2xs'
                        : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]'
                    }`}
                  >
                    <span className="text-xs font-semibold leading-tight text-[var(--text)] truncate w-full">
                      {preset.label}
                    </span>
                    <span className="mt-1.5 rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--muted)] border border-[var(--border)]">
                      {preset.badge}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Script Textarea */}
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                <span className="font-medium">Raw Script Text</span>
                <span className="font-mono text-[10px]">{rawScript.length} chars</span>
              </div>
              <textarea
                ref={textareaRef}
                value={rawScript}
                onChange={(e) => setRawScript(e.target.value)}
                placeholder="Shayam: Kya kar raha hai bhai!&#10;Ram: Kuch nahi, tu bata... kaisa chal raha hai kaam?&#10;Shayam: Sab badhiya chal raha hai, aaj Second Brain ka naya version test kar rahe hain."
                className="w-full min-h-[250px] lg:min-h-[280px] resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3.5 text-sm font-normal leading-relaxed text-[var(--text)] outline-none transition-all focus:border-[var(--accent)] focus:bg-[var(--surface-elevated)] placeholder:text-[var(--muted)]/40"
              />
            </div>

            {/* Expressive Beat & Pause Chips */}
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Insert Timing & Prosody
                </span>
                <button
                  type="button"
                  onClick={() => setRawScript('')}
                  className="text-[10px] font-medium text-[var(--muted)] hover:text-rose-400 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '0.1s Breath', token: '[pause:0.1s]' },
                  { label: '0.2s Pause', token: '[pause:0.2s]' },
                  { label: '0.4s Pause', token: '[pause:0.4s]' },
                  { label: 'Impact', token: '[impact]' },
                  { label: 'Slow', token: '[slow]' },
                  { label: 'Fast', token: '[fast]' },
                  { label: 'Whisper', token: '[whisper]' },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => handleInsertToken(t.token)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 active:scale-95"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* RIGHT COLUMN (7 COLS): DIALOGUE TIMELINE & CAST                   */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-4 lg:col-span-7 min-w-0">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-3.5">
            {/* Header: Cast & Add Turn */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">Dialogue Timeline</h3>
                <span className="rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                  {segments.length} Turns • {uniqueSpeakers.length} Speakers
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddSegment}
                className="flex items-center gap-1 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent)]/20 active:scale-95"
              >
                <Plus size={13} />
                <span>Add Turn</span>
              </button>
            </div>

            {/* Clean Speaker Cast Bar */}
            {uniqueSpeakers.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3">
                <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
                  <span className="font-bold uppercase tracking-wider">
                    Character Cast & Voice Assignment
                  </span>
                  <span>Syncs across all lines</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uniqueSpeakers.map((spk) => {
                    const spkLang = spk.lang || selectedLang
                    const langVoices = getVoicesForLanguage(spkLang)
                    const matched =
                      langVoices.find((v) => v.id === spk.voiceId) || langVoices[0]
                    const styling = getVoiceStyling(matched?.id || spk.voiceId)

                    return (
                      <div
                        key={spk.speakerName}
                        className={`flex items-center justify-between gap-2 rounded-xl border ${styling.border} bg-[var(--surface)] px-3 py-2 min-w-0`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: styling.waveColor }}
                          />
                          <span className="truncate text-xs font-semibold text-[var(--text)]">
                            {spk.speakerName}
                          </span>
                        </div>
                        <select
                          value={matched?.id || spk.voiceId}
                          onChange={(e) =>
                            handleAssignSpeakerVoice(spk.speakerName, e.target.value)
                          }
                          className="shrink-0 max-w-[150px] truncate rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text)] outline-none hover:border-[var(--accent)] cursor-pointer"
                        >
                          {langVoices.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Dialogue Turns Cards List */}
            <div className="space-y-3">
              {segments.map((seg, idx) => {
                const isTurnActive = isPlaying && activeSegmentIndex === idx
                const isPreviewing = previewingId === seg.id
                const turnLang = seg.lang || selectedLang
                const availableVoices = getVoicesForLanguage(turnLang)
                const currentVoice =
                  availableVoices.find((v) => v.id === seg.voiceId) || availableVoices[0]
                const styling = getVoiceStyling(currentVoice?.id || seg.voiceId)

                return (
                  <div
                    key={seg.id}
                    className={`group relative rounded-xl border p-3.5 transition-all duration-150 ${
                      isTurnActive
                        ? `${styling.border} bg-[var(--surface)] shadow-sm ring-1 ${styling.ring}`
                        : isPreviewing
                          ? 'border-[var(--accent)] bg-[var(--surface)]'
                          : 'border-[var(--border)] bg-[var(--surface-elevated)]/25 hover:border-[var(--accent)]/30'
                    }`}
                  >
                    {isTurnActive && (
                      <div
                        className="absolute top-0 left-0 h-full w-1 rounded-l-xl transition-colors"
                        style={{ backgroundColor: styling.waveColor }}
                      />
                    )}

                    <div className="flex flex-col gap-2.5">
                      {/* Turn Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px] font-bold text-[var(--muted)] shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={seg.speakerName}
                            onChange={(e) => handleUpdateSpeakerName(seg.id, e.target.value)}
                            placeholder="Speaker"
                            className="w-24 sm:w-28 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Turn Language selector */}
                          <select
                            value={turnLang}
                            onChange={(e) => handleUpdateSegmentLang(seg.id, e.target.value)}
                            title="Select turn language"
                            className="max-w-[110px] truncate rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] outline-none hover:border-[var(--accent)] hover:text-[var(--text)] cursor-pointer"
                          >
                            {INDIC_LANGUAGES.map((l) => (
                              <option key={l.code} value={l.code}>
                                {l.name}
                              </option>
                            ))}
                          </select>

                          {/* Filtered Voice Model */}
                          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 max-w-[140px]">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: styling.waveColor }}
                            />
                            <select
                              value={currentVoice?.id || seg.voiceId}
                              onChange={(e) => handleUpdateVoice(seg.id, e.target.value)}
                              title="Voice model"
                              className="bg-transparent text-[11px] font-medium text-[var(--text)] outline-none cursor-pointer truncate w-full"
                            >
                              {availableVoices.map((v) => (
                                <option
                                  key={v.id}
                                  value={v.id}
                                  className="bg-[var(--surface)] text-[var(--text)]"
                                >
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Preview Single Turn */}
                          <button
                            type="button"
                            onClick={() => handlePreviewSegment(seg)}
                            title="Preview turn"
                            className={`flex h-6 w-6 items-center justify-center rounded-lg border transition-all ${
                              isPreviewing
                                ? 'border-rose-500/30 bg-rose-500/15 text-rose-400'
                                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]'
                            }`}
                          >
                            {isPreviewing ? <Pause size={11} /> : <Play size={11} />}
                          </button>

                          {/* Remove Turn */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSegment(seg.id)}
                            title="Delete turn"
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-rose-500/30 hover:text-rose-400"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Dialogue Content */}
                      <textarea
                        rows={2}
                        value={seg.text}
                        onChange={(e) => handleUpdateSegmentText(seg.id, e.target.value)}
                        placeholder="Enter dialogue line here..."
                        className="w-full min-h-[64px] resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm font-normal leading-relaxed text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
                      />

                      {/* Turn Pause Gap Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mr-1">
                            Pause:
                          </span>
                          {[40, 100, 180, 260, 400].map((ms) => (
                            <button
                              key={ms}
                              type="button"
                              onClick={() => handleUpdatePause(seg.id, ms)}
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                seg.pauseAfterMs === ms
                                  ? 'bg-[var(--accent)] text-white shadow-2xs'
                                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
                              }`}
                            >
                              {ms}ms
                            </button>
                          ))}
                        </div>
                        <span className="font-mono text-[10px] text-[var(--muted)]">
                          {seg.text.length} chars
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {segments.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/20 p-8 text-center">
                  <p className="text-sm font-medium text-[var(--text)]">
                    No dialogue turns in timeline
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Click "Auto-Direct" on the left, or add a turn manually.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddSegment}
                    className="mt-3 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--accent)]"
                  >
                    <Plus size={13} /> Add Turn
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. SLEEK PRO FLOATING AUDIO PLAYER (CLEAN, MINIMAL, TRUE LIVE WAVES)   */}
      {/* ===================================================================== */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-3xl">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 shadow-xl backdrop-blur-xl ring-1 ring-white/5">
          {/* Left: Play/Pause Button + Current Speaker Profile */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all shadow-xs ${
                isPlaying
                  ? 'bg-rose-500 text-white shadow-rose-500/30'
                  : 'bg-[var(--accent)] text-white shadow-[var(--accent)]/30 hover:scale-105 active:scale-95'
              }`}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} className="translate-x-0.5" />}
            </button>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeVoiceStyle.waveColor }}
                />
                <span className="text-xs font-semibold text-[var(--text)] truncate max-w-[130px]">
                  {isPlaying && activeSegment
                    ? activeSegment.speakerName
                    : 'Master Audio'}
                </span>
              </div>
              <span className="text-[10px] text-[var(--muted)] font-mono truncate">
                {isPlaying
                  ? isPausing
                    ? `Pause (${pauseDurationActive}ms)`
                    : `Turn ${activeSegmentIndex + 1}/${segments.length}`
                  : `${segments.length} Turns • ${defaultPauseMs}ms`}
              </span>
            </div>
          </div>

          {/* Center: True Live Frequency Waves / Flat Pause Line */}
          <div className="flex-1 min-w-[140px] max-w-xs mx-2 flex items-center justify-center">
            {isPausing ? (
              // Distinct Flat Pause Gap Silence Line with active countdown/duration
              <div className="flex items-center gap-2 py-0.5 px-2.5 rounded-lg bg-[var(--surface-elevated)] border border-dashed border-amber-500/40">
                <span className="h-1 w-1 rounded-full bg-amber-400" />
                <span className="text-[10px] font-mono font-semibold text-amber-400">
                  PAUSE {pauseDurationActive}ms
                </span>
                <span className="h-1 w-1 rounded-full bg-amber-400" />
              </div>
            ) : isPlaying ? (
              // True Live Audio Spectrum Bars responding directly to AudioContext frequency data
              <div className="flex items-center gap-1 h-7">
                {waveHeights.map((h, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full transition-all duration-75"
                    style={{
                      height: `${h}px`,
                      backgroundColor: activeVoiceStyle.waveColor,
                      boxShadow: `0 0 6px ${activeVoiceStyle.waveColor}30`,
                    }}
                  />
                ))}
              </div>
            ) : (
              // Idle state: multi-colored sequence indicator
              <div className="flex items-center gap-1 w-full justify-center">
                {segments.slice(0, 8).map((s, idx) => {
                  const style = getVoiceStyling(s.voiceId)
                  return (
                    <span
                      key={s.id || idx}
                      className="h-1 w-3.5 rounded-full transition-all"
                      style={{ backgroundColor: `${style.waveColor}50` }}
                      title={`${s.speakerName} (${s.voiceId})`}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: Minimal Icon Actions (Copy, Export) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyScript}
              title="Copy Script Text"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>

            <button
              type="button"
              disabled={exporting || segments.length === 0}
              onClick={handleDownloadAudio}
              title="Export Audio"
              className="flex h-8 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-xs font-medium text-white shadow-xs hover:opacity-95 disabled:opacity-50 transition-all"
            >
              <Download size={13} />
              <span>{exporting ? 'Saving…' : 'Export'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
