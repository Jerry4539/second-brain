// Pure offline retro audio synthesizer for games using Web Audio API

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new AudioContextClass()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

export function playEatDotSound(isSpecial = false, isSpeed = false) {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = isSpecial ? 'triangle' : isSpeed ? 'sawtooth' : 'sine'
  const freq = isSpecial ? 880 : isSpeed ? 660 : 440
  osc.frequency.setValueAtTime(freq, now)
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08)

  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.12)
}

export function playCrashSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime

  // White noise burst
  const bufferSize = ctx.sampleRate * 0.25
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06))
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(800, now)
  filter.frequency.exponentialRampToValueAtTime(100, now + 0.25)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  noise.start(now)
}

export function playBoostSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.3)

  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.35)
}

export function playLapSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(523.25, now) // C5
  osc.frequency.setValueAtTime(659.25, now + 0.08) // E5
  osc.frequency.setValueAtTime(783.99, now + 0.16) // G5

  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.3)
}

export function playVictoryFanfare() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime

  const notes = [440, 554.37, 659.25, 880]
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = now + idx * 0.1
    const dur = 0.25

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, start)

    gain.gain.setValueAtTime(0.2, start)
    gain.gain.exponentialRampToValueAtTime(0.01, start + dur)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(start)
    osc.stop(start + dur)
  })
}
