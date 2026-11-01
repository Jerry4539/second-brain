import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Trophy,
  Zap,
  Gauge,
  RotateCcw,
  Flag,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Compass,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { GameDifficulty, PlayerConfig } from '../../lib/games/types'
import { saveGameSession } from '../../lib/games/db'
import {
  playCrashSound,
  playBoostSound,
  playLapSound,
  playVictoryFanfare,
} from '../../lib/games/soundEffects'

interface TrackDefinition {
  id: string
  name: string
  subtitle: string
  theme: 'cyber' | 'desert' | 'synth' | 'ice'
  trackColor: string
  innerColor: string
  barrierColor: string
  kerbColor1: string
  kerbColor2: string
  waypoints: { x: number; y: number }[]
  innerBoundary: { x: number; y: number }[]
  outerBoundary: { x: number; y: number }[]
  boostPads: { x: number; y: number; angle: number }[]
  spawn: { x: number; y: number; angle: number }
  aiSpawn: { x: number; y: number; angle: number }
}

const TRACKS: TrackDefinition[] = [
  {
    id: 'tokyo-neon',
    name: 'Neo-Tokyo Circuit',
    subtitle: 'Cyberpunk night streets with sharp 90° bends',
    theme: 'cyber',
    trackColor: '#1e2029',
    innerColor: '#0e1017',
    barrierColor: '#00f0ff',
    kerbColor1: '#ff0055',
    kerbColor2: '#00f0ff',
    spawn: { x: 380, y: 500, angle: -Math.PI / 2 },
    aiSpawn: { x: 420, y: 500, angle: -Math.PI / 2 },
    waypoints: [
      { x: 400, y: 480 },
      { x: 400, y: 220 },
      { x: 440, y: 150 },
      { x: 620, y: 140 },
      { x: 700, y: 220 },
      { x: 700, y: 350 },
      { x: 620, y: 440 },
      { x: 500, y: 350 },
      { x: 320, y: 350 },
      { x: 200, y: 430 },
      { x: 140, y: 320 },
      { x: 180, y: 180 },
      { x: 300, y: 130 },
      { x: 400, y: 130 },
      { x: 400, y: 480 },
    ],
    innerBoundary: [
      { x: 360, y: 230 },
      { x: 460, y: 190 },
      { x: 640, y: 220 },
      { x: 640, y: 330 },
      { x: 580, y: 370 },
      { x: 360, y: 280 },
    ],
    outerBoundary: [
      { x: 320, y: 540 },
      { x: 480, y: 540 },
      { x: 760, y: 360 },
      { x: 760, y: 180 },
      { x: 620, y: 80 },
      { x: 120, y: 80 },
      { x: 80, y: 320 },
      { x: 140, y: 500 },
      { x: 320, y: 540 },
    ],
    boostPads: [
      { x: 400, y: 300, angle: -Math.PI / 2 },
      { x: 670, y: 260, angle: Math.PI / 2 },
    ],
  },
  {
    id: 'desert-mirage',
    name: 'Desert Mirage Speedway',
    subtitle: 'High speed sweeping canyon sands and dunes',
    theme: 'desert',
    trackColor: '#4a3728',
    innerColor: '#2b1e15',
    barrierColor: '#f59e0b',
    kerbColor1: '#d97706',
    kerbColor2: '#fbbf24',
    spawn: { x: 400, y: 490, angle: 0 },
    aiSpawn: { x: 400, y: 530, angle: 0 },
    waypoints: [
      { x: 420, y: 510 },
      { x: 660, y: 510 },
      { x: 730, y: 430 },
      { x: 720, y: 230 },
      { x: 620, y: 130 },
      { x: 440, y: 130 },
      { x: 320, y: 220 },
      { x: 220, y: 200 },
      { x: 130, y: 300 },
      { x: 140, y: 440 },
      { x: 250, y: 510 },
      { x: 420, y: 510 },
    ],
    innerBoundary: [
      { x: 300, y: 430 },
      { x: 640, y: 430 },
      { x: 640, y: 220 },
      { x: 440, y: 210 },
      { x: 240, y: 320 },
    ],
    outerBoundary: [
      { x: 240, y: 570 },
      { x: 680, y: 570 },
      { x: 780, y: 430 },
      { x: 780, y: 180 },
      { x: 620, y: 70 },
      { x: 380, y: 70 },
      { x: 80, y: 240 },
      { x: 80, y: 460 },
    ],
    boostPads: [
      { x: 550, y: 510, angle: 0 },
      { x: 530, y: 130, angle: Math.PI },
    ],
  },
  {
    id: 'synthwave-grid',
    name: 'Cyber Synthwave Grid',
    subtitle: 'Futuristic highway with dynamic boost lanes',
    theme: 'synth',
    trackColor: '#241438',
    innerColor: '#120820',
    barrierColor: '#ec4899',
    kerbColor1: '#a855f7',
    kerbColor2: '#06b6d4',
    spawn: { x: 380, y: 500, angle: -Math.PI / 2 },
    aiSpawn: { x: 420, y: 500, angle: -Math.PI / 2 },
    waypoints: [
      { x: 400, y: 480 },
      { x: 400, y: 180 },
      { x: 520, y: 130 },
      { x: 680, y: 180 },
      { x: 710, y: 340 },
      { x: 620, y: 480 },
      { x: 480, y: 380 },
      { x: 320, y: 380 },
      { x: 180, y: 480 },
      { x: 120, y: 320 },
      { x: 170, y: 160 },
      { x: 310, y: 130 },
      { x: 400, y: 180 },
      { x: 400, y: 480 },
    ],
    innerBoundary: [
      { x: 350, y: 240 },
      { x: 450, y: 240 },
      { x: 620, y: 260 },
      { x: 560, y: 400 },
      { x: 260, y: 400 },
    ],
    outerBoundary: [
      { x: 320, y: 550 },
      { x: 480, y: 550 },
      { x: 760, y: 400 },
      { x: 760, y: 140 },
      { x: 620, y: 70 },
      { x: 180, y: 70 },
      { x: 70, y: 240 },
      { x: 120, y: 530 },
    ],
    boostPads: [
      { x: 400, y: 320, angle: -Math.PI / 2 },
      { x: 660, y: 410, angle: (3 * Math.PI) / 4 },
      { x: 150, y: 230, angle: -Math.PI / 3 },
    ],
  },
  {
    id: 'alpine-ice',
    name: 'Alpine Glacier Pass',
    subtitle: 'Slippery frozen curves & thrilling drifts',
    theme: 'ice',
    trackColor: '#1c2d3d',
    innerColor: '#0e1720',
    barrierColor: '#38bdf8',
    kerbColor1: '#e0f2fe',
    kerbColor2: '#0284c7',
    spawn: { x: 400, y: 490, angle: 0 },
    aiSpawn: { x: 400, y: 530, angle: 0 },
    waypoints: [
      { x: 420, y: 510 },
      { x: 650, y: 510 },
      { x: 720, y: 420 },
      { x: 710, y: 260 },
      { x: 620, y: 160 },
      { x: 480, y: 240 },
      { x: 360, y: 160 },
      { x: 200, y: 180 },
      { x: 130, y: 320 },
      { x: 180, y: 480 },
      { x: 300, y: 510 },
      { x: 420, y: 510 },
    ],
    innerBoundary: [
      { x: 340, y: 440 },
      { x: 630, y: 440 },
      { x: 630, y: 260 },
      { x: 480, y: 300 },
      { x: 260, y: 360 },
    ],
    outerBoundary: [
      { x: 240, y: 570 },
      { x: 700, y: 570 },
      { x: 780, y: 400 },
      { x: 770, y: 180 },
      { x: 600, y: 90 },
      { x: 200, y: 100 },
      { x: 70, y: 300 },
      { x: 120, y: 540 },
    ],
    boostPads: [
      { x: 550, y: 510, angle: 0 },
      { x: 250, y: 200, angle: -Math.PI / 4 },
    ],
  },
]

interface Car {
  x: number
  y: number
  angle: number
  speed: number
  maxSpeed: number
  accel: number
  friction: number
  steerAngle: number
  color: string
  nitro: number
  isBoosting: boolean
  lap: number
  checkpointIdx: number
  lapStartTime: number
  bestLapTime: number | null
  finished: boolean
}

interface Props {
  difficulty: GameDifficulty
  config: PlayerConfig
  onGameOver?: () => void
  onRestart?: () => void
}

export function CarRaceBoard({ difficulty, config, onGameOver, onRestart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0)
  const [totalLaps, setTotalLaps] = useState<number>(3)
  const [carColor, setCarColor] = useState('#00f0ff')
  const [paused, setPaused] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Race state
  const [raceState, setRaceState] = useState<'countdown' | 'racing' | 'finished'>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null)
  const [playerLap, setPlayerLap] = useState(1)
  const [aiLap, setAiLap] = useState(1)
  const [playerSpeed, setPlayerSpeed] = useState(0)
  const [playerNitro, setPlayerNitro] = useState(100)
  const [playerPos, setPlayerPos] = useState<1 | 2>(1)
  const [lapTimes, setLapTimes] = useState<number[]>([])

  const currentTrack = TRACKS[selectedTrackIdx]

  // Key states
  const keysRef = useRef<{
    up: boolean
    down: boolean
    left: boolean
    right: boolean
    nitro: boolean
  }>({
    up: false,
    down: false,
    left: false,
    right: false,
    nitro: false,
  })

  // Physics refs
  const playerCarRef = useRef<Car>({
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    maxSpeed: 7.5,
    accel: 0.18,
    friction: 0.965,
    steerAngle: 0.045,
    color: '#00f0ff',
    nitro: 100,
    isBoosting: false,
    lap: 1,
    checkpointIdx: 0,
    lapStartTime: Date.now(),
    bestLapTime: null,
    finished: false,
  })

  const aiCarRef = useRef<Car>({
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    maxSpeed: difficulty === 'hard' ? 7.3 : difficulty === 'medium' ? 6.4 : 5.4,
    accel: difficulty === 'hard' ? 0.16 : 0.12,
    friction: 0.965,
    steerAngle: 0.045,
    color: '#ff0055',
    nitro: 100,
    isBoosting: false,
    lap: 1,
    checkpointIdx: 0,
    lapStartTime: Date.now(),
    bestLapTime: null,
    finished: false,
  })

  // Reset cars on track or config change
  const initCars = useCallback(() => {
    const track = TRACKS[selectedTrackIdx]
    playerCarRef.current = {
      x: track.spawn.x,
      y: track.spawn.y,
      angle: track.spawn.angle,
      speed: 0,
      maxSpeed: 7.5,
      accel: 0.18,
      friction: track.theme === 'ice' ? 0.985 : 0.965,
      steerAngle: 0.048,
      color: carColor,
      nitro: 100,
      isBoosting: false,
      lap: 1,
      checkpointIdx: 0,
      lapStartTime: Date.now(),
      bestLapTime: null,
      finished: false,
    }

    const aiMaxSpeed = difficulty === 'hard' ? 7.2 : difficulty === 'medium' ? 6.3 : 5.3
    aiCarRef.current = {
      x: track.aiSpawn.x,
      y: track.aiSpawn.y,
      angle: track.aiSpawn.angle,
      speed: 0,
      maxSpeed: aiMaxSpeed,
      accel: difficulty === 'hard' ? 0.16 : 0.12,
      friction: track.theme === 'ice' ? 0.985 : 0.965,
      steerAngle: 0.045,
      color: '#ff4d4d',
      nitro: 100,
      isBoosting: false,
      lap: 1,
      checkpointIdx: 0,
      lapStartTime: Date.now(),
      bestLapTime: null,
      finished: false,
    }

    setPlayerLap(1)
    setAiLap(1)
    setPlayerSpeed(0)
    setPlayerNitro(100)
    setPlayerPos(1)
    setWinner(null)
    setLapTimes([])
    setRaceState('countdown')
    setCountdown(3)
  }, [selectedTrackIdx, carColor, difficulty])

  useEffect(() => {
    initCars()
  }, [initCars])

  // Countdown timer
  useEffect(() => {
    if (raceState !== 'countdown') return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setRaceState('racing')
          playerCarRef.current.lapStartTime = Date.now()
          aiCarRef.current.lapStartTime = Date.now()
          return 0
        }
        return prev - 1
      })
    }, 900)
    return () => clearInterval(timer)
  }, [raceState])

  // Keyboard handlers
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (['ArrowUp', 'KeyW'].includes(e.code)) keysRef.current.up = true
      if (['ArrowDown', 'KeyS'].includes(e.code)) keysRef.current.down = true
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keysRef.current.left = true
      if (['ArrowRight', 'KeyD'].includes(e.code)) keysRef.current.right = true
      if (e.code === 'Space') {
        e.preventDefault()
        keysRef.current.nitro = true
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (['ArrowUp', 'KeyW'].includes(e.code)) keysRef.current.up = false
      if (['ArrowDown', 'KeyS'].includes(e.code)) keysRef.current.down = false
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keysRef.current.left = false
      if (['ArrowRight', 'KeyD'].includes(e.code)) keysRef.current.right = false
      if (e.code === 'Space') keysRef.current.nitro = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    function loop() {
      if (!paused && raceState === 'racing') {
        updatePlayer()
        updateAI()
        checkCheckpoints()
        checkBoostPads()
      }
      render(ctx!)
      animationId = requestAnimationFrame(loop)
    }

    animationId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationId)
  })

  function updatePlayer() {
    const car = playerCarRef.current
    if (car.finished) return

    const keys = keysRef.current

    // Nitro
    if (keys.nitro && car.nitro > 10) {
      car.isBoosting = true
      car.nitro = Math.max(0, car.nitro - 0.75)
      car.speed = Math.min(car.speed + 0.35, car.maxSpeed * 1.45)
      if (soundEnabled && Math.random() < 0.05) playBoostSound()
    } else {
      car.isBoosting = false
      car.nitro = Math.min(100, car.nitro + 0.15)
    }

    // Acceleration & Reverse
    if (keys.up) {
      car.speed = Math.min(car.speed + car.accel, car.maxSpeed)
    } else if (keys.down) {
      car.speed = Math.max(car.speed - car.accel * 1.4, -car.maxSpeed * 0.45)
    } else {
      car.speed *= car.friction
    }

    // Steering
    if (Math.abs(car.speed) > 0.1) {
      const dir = car.speed > 0 ? 1 : -1
      if (keys.left) car.angle -= car.steerAngle * dir
      if (keys.right) car.angle += car.steerAngle * dir
    }

    // Move
    car.x += Math.cos(car.angle) * car.speed
    car.y += Math.sin(car.angle) * car.speed

    // Boundary bounce
    const pad = 24
    if (car.x < pad || car.x > 840 - pad || car.y < pad || car.y > 600 - pad) {
      car.speed = -car.speed * 0.5
      car.x = Math.max(pad, Math.min(840 - pad, car.x))
      car.y = Math.max(pad, Math.min(600 - pad, car.y))
      if (soundEnabled) playCrashSound()
    }

    // Update telemetry state
    setPlayerSpeed(Math.round(Math.abs(car.speed) * 22))
    setPlayerNitro(Math.round(car.nitro))
  }

  function updateAI() {
    const ai = aiCarRef.current
    if (ai.finished) return

    const track = currentTrack
    const targetWp = track.waypoints[ai.checkpointIdx]
    if (!targetWp) return

    // Calculate angle to target waypoint
    const dx = targetWp.x - ai.x
    const dy = targetWp.y - ai.y
    const targetAngle = Math.atan2(dy, dx)

    let angleDiff = targetAngle - ai.angle
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2

    // Steer towards waypoint
    ai.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), ai.steerAngle)

    // Accelerate
    ai.speed = Math.min(ai.speed + ai.accel, ai.maxSpeed)
    ai.x += Math.cos(ai.angle) * ai.speed
    ai.y += Math.sin(ai.angle) * ai.speed

    // Waypoint reached?
    const distToWp = Math.hypot(dx, dy)
    if (distToWp < 70) {
      ai.checkpointIdx = (ai.checkpointIdx + 1) % track.waypoints.length
      if (ai.checkpointIdx === 0) {
        ai.lap += 1
        setAiLap(ai.lap)
        if (ai.lap > totalLaps) {
          ai.finished = true
          handleFinish('ai')
        }
      }
    }
  }

  function checkCheckpoints() {
    const p = playerCarRef.current
    if (p.finished) return

    const track = currentTrack
    const targetWp = track.waypoints[p.checkpointIdx]
    if (!targetWp) return

    const dist = Math.hypot(targetWp.x - p.x, targetWp.y - p.y)
    if (dist < 80) {
      p.checkpointIdx = (p.checkpointIdx + 1) % track.waypoints.length
      if (p.checkpointIdx === 0) {
        // Completed lap!
        const lapTime = (Date.now() - p.lapStartTime) / 1000
        p.lapStartTime = Date.now()
        setLapTimes((prev) => [...prev, lapTime])
        if (!p.bestLapTime || lapTime < p.bestLapTime) {
          p.bestLapTime = lapTime
        }
        if (soundEnabled) playLapSound()

        p.lap += 1
        setPlayerLap(p.lap)

        if (p.lap > totalLaps) {
          p.finished = true
          handleFinish('player')
        }
      }
    }

    // Determine current leader position
    const ai = aiCarRef.current
    const pProgress = p.lap * 100 + p.checkpointIdx
    const aiProgress = ai.lap * 100 + ai.checkpointIdx
    setPlayerPos(pProgress >= aiProgress ? 1 : 2)
  }

  function checkBoostPads() {
    const p = playerCarRef.current
    currentTrack.boostPads.forEach((pad) => {
      const dist = Math.hypot(pad.x - p.x, pad.y - p.y)
      if (dist < 32 && !p.isBoosting) {
        p.speed = p.maxSpeed * 1.55
        p.nitro = Math.min(100, p.nitro + 25)
        if (soundEnabled) playBoostSound()
      }
    })
  }

  function handleFinish(winningSide: 'player' | 'ai') {
    setRaceState('finished')
    setWinner(winningSide)
    if (soundEnabled && winningSide === 'player') {
      playVictoryFanfare()
    }

    saveGameSession({
      id: crypto.randomUUID(),
      gameType: 'car-race',
      difficulty,
      result: winningSide === 'player' ? 'win' : 'loss',
      stateJson: JSON.stringify({
        track: currentTrack.name,
        laps: totalLaps,
        winner: winningSide,
      }),
    }).catch(() => {})

    if (onGameOver) onGameOver()
  }

  // Canvas Renderer
  function render(ctx: CanvasRenderingContext2D) {
    const track = currentTrack
    ctx.clearRect(0, 0, 840, 600)

    // Base background
    ctx.fillStyle = track.innerColor
    ctx.fillRect(0, 0, 840, 600)

    // Grid lines for high-tech aesthetic
    ctx.strokeStyle = track.theme === 'synth' ? 'rgba(236, 72, 153, 0.08)' : 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x < 840; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 600)
      ctx.stroke()
    }
    for (let y = 0; y < 600; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(840, y)
      ctx.stroke()
    }

    // Outer Track Fill
    ctx.beginPath()
    track.waypoints.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y)
      else ctx.lineTo(pt.x, pt.y)
    })
    ctx.closePath()

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Neon Barrier Outer Glow
    ctx.strokeStyle = track.barrierColor
    ctx.lineWidth = 104
    ctx.stroke()

    // Kerbs (dashed colorful outline)
    ctx.strokeStyle = track.kerbColor1
    ctx.lineWidth = 98
    ctx.setLineDash([20, 20])
    ctx.stroke()

    ctx.strokeStyle = track.kerbColor2
    ctx.lineDashOffset = 20
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineDashOffset = 0

    // Asphalt Track Core
    ctx.strokeStyle = track.trackColor
    ctx.lineWidth = 90
    ctx.stroke()

    // Racing centerline dashes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 2
    ctx.setLineDash([16, 24])
    ctx.stroke()
    ctx.setLineDash([])

    // Finish Line
    const startWp = track.waypoints[0]
    ctx.save()
    ctx.translate(startWp.x, startWp.y)
    ctx.rotate(track.spawn.angle)
    for (let r = -40; r <= 40; r += 10) {
      for (let c = 0; c < 20; c += 10) {
        ctx.fillStyle = (r + c) % 20 === 0 ? '#ffffff' : '#000000'
        ctx.fillRect(r, c - 10, 10, 10)
      }
    }
    ctx.restore()

    // Speed Boost Pads
    track.boostPads.forEach((pad) => {
      ctx.save()
      ctx.translate(pad.x, pad.y)
      ctx.rotate(pad.angle)
      ctx.fillStyle = '#f59e0b'
      ctx.shadowColor = '#f59e0b'
      ctx.shadowBlur = 12

      // Chevron arrows
      for (let i = -12; i <= 12; i += 12) {
        ctx.beginPath()
        ctx.moveTo(-16, i + 6)
        ctx.lineTo(0, i - 6)
        ctx.lineTo(16, i + 6)
        ctx.lineWidth = 4
        ctx.strokeStyle = '#fbbf24'
        ctx.stroke()
      }
      ctx.restore()
    })

    // AI Car
    drawCar(ctx, aiCarRef.current, false)

    // Player Car
    drawCar(ctx, playerCarRef.current, true)

    // Mini-map in top-right corner
    drawMiniMap(ctx, track)
  }

  function drawCar(ctx: CanvasRenderingContext2D, car: Car, isPlayer: boolean) {
    ctx.save()
    ctx.translate(car.x, car.y)
    ctx.rotate(car.angle)

    // Nitro exhaust flames
    if (car.isBoosting || Math.abs(car.speed) > 7.5) {
      ctx.fillStyle = isPlayer ? '#00f0ff' : '#ff0055'
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 15
      ctx.beginPath()
      ctx.moveTo(-20, -6)
      ctx.lineTo(-32 - Math.random() * 8, 0)
      ctx.lineTo(-20, 6)
      ctx.closePath()
      ctx.fill()
    }

    // Car Body Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3

    // Tires
    ctx.fillStyle = '#111827'
    ctx.fillRect(-14, -14, 8, 5) // Front left
    ctx.fillRect(8, -14, 8, 5) // Front right
    ctx.fillRect(-14, 9, 8, 5) // Rear left
    ctx.fillRect(8, 9, 8, 5) // Rear right

    // Chassis
    ctx.fillStyle = car.color
    ctx.beginPath()
    ctx.roundRect(-18, -10, 36, 20, 4)
    ctx.fill()

    // Racing stripe
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-18, -2, 36, 4)

    // Cockpit / Windshield
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.roundRect(-6, -7, 14, 14, 2)
    ctx.fill()

    // Headlights
    ctx.fillStyle = '#fef08a'
    ctx.shadowColor = '#fef08a'
    ctx.shadowBlur = 8
    ctx.fillRect(16, -9, 3, 4)
    ctx.fillRect(16, 5, 3, 4)

    ctx.restore()
  }

  function drawMiniMap(ctx: CanvasRenderingContext2D, track: TrackDefinition) {
    const mx = 690
    const my = 20
    const mw = 130
    const mh = 95

    ctx.save()
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(mx, my, mw, mh, 8)
    ctx.fill()
    ctx.stroke()

    // Track path scaled
    ctx.beginPath()
    track.waypoints.forEach((pt, i) => {
      const rx = mx + (pt.x / 840) * (mw - 20) + 10
      const ry = my + (pt.y / 600) * (mh - 20) + 10
      if (i === 0) ctx.moveTo(rx, ry)
      else ctx.lineTo(rx, ry)
    })
    ctx.closePath()
    ctx.strokeStyle = track.barrierColor
    ctx.lineWidth = 3
    ctx.stroke()

    // Player dot
    const p = playerCarRef.current
    const px = mx + (p.x / 840) * (mw - 20) + 10
    const py = my + (p.y / 600) * (mh - 20) + 10
    ctx.fillStyle = carColor
    ctx.shadowColor = carColor
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(px, py, 4, 0, Math.PI * 2)
    ctx.fill()

    // AI dot
    const ai = aiCarRef.current
    const ax = mx + (ai.x / 840) * (mw - 20) + 10
    const ay = my + (ai.y / 600) * (mh - 20) + 10
    ctx.fillStyle = '#ff4d4d'
    ctx.shadowColor = '#ff4d4d'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-5xl mx-auto h-full overflow-hidden select-none">
      {/* Top Bento Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {/* Bento 1: Track Selector */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1 font-semibold text-[var(--text)]">
              <Compass size={14} className="text-[var(--accent)]" /> Track
            </span>
            <Badge tone="neutral">{selectedTrackIdx + 1}/4</Badge>
          </div>
          <select
            value={selectedTrackIdx}
            onChange={(e) => setSelectedTrackIdx(Number(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text)] focus:outline-none"
          >
            {TRACKS.map((t, idx) => (
              <option key={t.id} value={idx}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Bento 2: Telemetry (Speedometer & Nitro) */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1 font-semibold text-[var(--text)]">
              <Gauge size={14} className="text-cyan-400" /> Speed
            </span>
            <span className="font-mono text-sm font-bold text-[var(--text)]">{playerSpeed} MPH</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <Zap size={11} className="text-amber-400" /> Nitro
              </span>
              <span>{playerNitro}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-100"
                style={{ width: `${playerNitro}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bento 3: Race Position & Laps */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1 font-semibold text-[var(--text)]">
              <Flag size={14} className="text-emerald-400" /> Position
            </span>
            <span
              className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                playerPos === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {playerPos === 1 ? '1st P1' : '2nd P2'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">Lap:</span>
            <span className="font-mono font-bold text-[var(--text)]">
              {Math.min(playerLap, totalLaps)} / {totalLaps}
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono">
              (AI: {Math.min(aiLap, totalLaps)}/{totalLaps})
            </span>
          </div>
        </div>

        {/* Bento 4: Controls & Audio */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1 text-[11px] text-[var(--muted)]">
            <span>Controls:</span>
            <span className="font-mono text-[10px] text-[var(--text)]">WASD / ↑↓←→ + Space</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="rounded-xl border border-[var(--border)] p-1.5 text-[var(--muted)] hover:text-[var(--text)]"
              title="Toggle Audio"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              className="rounded-xl border border-[var(--border)] p-1.5 text-[var(--muted)] hover:text-[var(--text)]"
              title="Pause"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button
              type="button"
              onClick={() => {
                initCars()
                if (onRestart) onRestart()
              }}
              className="rounded-xl border border-[var(--border)] p-1.5 text-[var(--muted)] hover:text-[var(--text)]"
              title="Restart"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Race Canvas Arena */}
      <div className="relative flex-1 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-[var(--shadow-card)] overflow-hidden flex items-center justify-center min-h-[380px]">
        <canvas
          ref={canvasRef}
          width={840}
          height={600}
          className="w-full h-full max-h-[540px] object-contain rounded-2xl"
        />

        {/* Countdown overlay */}
        {raceState === 'countdown' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center animate-in fade-in">
            <span className="text-8xl font-black text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.7)] animate-pulse">
              {countdown > 0 ? countdown : 'GO!'}
            </span>
            <span className="mt-4 text-sm font-semibold tracking-widest uppercase text-cyan-400">
              Get Ready to Race
            </span>
          </div>
        )}

        {/* Victory / Finish Modal */}
        {raceState === 'finished' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in zoom-in-95">
            <div className="max-w-md w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 mb-3">
                <Trophy size={32} />
              </div>
              <h3 className="text-2xl font-black text-[var(--text)]">
                {winner === 'player' ? `${config.playerName} Wins!` : `${config.botName} Wins!`}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {winner === 'player'
                  ? 'Masterful driving! You took the checkered flag.'
                  : 'Second Brain outpaced you this round. Tune your nitro and try again!'}
              </p>

              {/* Lap times summary */}
              {lapTimes.length > 0 && (
                <div className="mt-4 rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-left">
                  <span className="font-semibold text-[var(--text)] block mb-1">Lap Telemetry:</span>
                  <div className="flex flex-col gap-1 font-mono text-[11px] text-[var(--muted)]">
                    {lapTimes.map((t, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>Lap {idx + 1}:</span>
                        <span className="font-bold text-[var(--text)]">{t.toFixed(2)}s</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-center gap-3">
                <Button onClick={initCars}>
                  <RotateCcw size={14} />
                  Race Again
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bento Row: Customization & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 shrink-0 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <span>Car Livery:</span>
          {(['#00f0ff', '#ff0055', '#10b981', '#f59e0b', '#8b5cf6'] as const).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => {
                setCarColor(col)
                playerCarRef.current.color = col
              }}
              style={{ backgroundColor: col }}
              className={`h-5 w-5 rounded-full transition-all ${
                carColor === col ? 'ring-2 ring-white scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span>Laps:</span>
          {([1, 3, 5] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setTotalLaps(l)
                initCars()
              }}
              className={`rounded-lg px-2.5 py-0.5 font-medium transition-all ${
                totalLaps === l ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-muted)] hover:text-[var(--text)]'
              }`}
            >
              {l} Laps
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
