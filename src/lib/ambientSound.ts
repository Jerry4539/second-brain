// Pure offline ambient sound generator using Web Audio API
// Generates gentle rain, night wind, and zen binaural drones on the fly without external audio files.

let audioCtx: AudioContext | null = null
let currentSource: AudioNode | null = null
let gainNode: GainNode | null = null

export type AmbientSoundType = 'rain' | 'wind' | 'zen' | 'none'

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function stopAmbientSound() {
  if (currentSource) {
    try {
      if ('stop' in currentSource && typeof currentSource.stop === 'function') {
        currentSource.stop()
      }
      currentSource.disconnect()
    } catch {
      // Ignore disconnect errors on stopped nodes
    }
    currentSource = null
  }
}

export function playAmbientSound(type: AmbientSoundType, volume = 0.25) {
  stopAmbientSound()
  if (type === 'none') return

  const ctx = getAudioContext()

  gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(volume, ctx.currentTime)
  gainNode.connect(ctx.destination)

  if (type === 'rain') {
    // Generate pink noise filtered for rain
    const bufferSize = ctx.sampleRate * 2
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }

    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer
    whiteNoise.loop = true

    // Low-pass filter to sound like gentle rain
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1000, ctx.currentTime)

    whiteNoise.connect(filter)
    filter.connect(gainNode)
    whiteNoise.start()
    currentSource = whiteNoise
  } else if (type === 'wind') {
    // Night wind: filtered noise with oscillating center frequency
    const bufferSize = ctx.sampleRate * 2
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.15
    }

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    noise.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(350, ctx.currentTime)
    filter.Q.setValueAtTime(2.5, ctx.currentTime)

    // LFO to slowly sweep wind frequency
    const lfo = ctx.createOscillator()
    lfo.frequency.setValueAtTime(0.2, ctx.currentTime)
    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(180, ctx.currentTime)
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    noise.connect(filter)
    filter.connect(gainNode)
    noise.start()
    currentSource = noise
  } else if (type === 'zen') {
    // Deep grounding binaural drone: 108Hz + 112Hz harmonic tone
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const subOsc = ctx.createOscillator()

    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(108, ctx.currentTime)

    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(112, ctx.currentTime)

    subOsc.type = 'triangle'
    subOsc.frequency.setValueAtTime(54, ctx.currentTime)

    const subGain = ctx.createGain()
    subGain.gain.setValueAtTime(0.4, ctx.currentTime)
    subOsc.connect(subGain)

    osc1.connect(gainNode)
    osc2.connect(gainNode)
    subGain.connect(gainNode)

    osc1.start()
    osc2.start()
    subOsc.start()

    currentSource = osc1
  }
}

export function setAmbientVolume(vol: number) {
  if (gainNode && audioCtx) {
    gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), audioCtx.currentTime)
  }
}
