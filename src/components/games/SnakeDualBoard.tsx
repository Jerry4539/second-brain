import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Trophy,
  Users,
  Bot,
  RotateCcw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { GameDifficulty, PlayerConfig } from '../../lib/games/types'
import { saveGameSession } from '../../lib/games/db'
import {
  playEatDotSound,
  playCrashSound,
  playVictoryFanfare,
} from '../../lib/games/soundEffects'

const GRID_COLS = 36
const GRID_ROWS = 24
const TILE_SIZE = 20

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Point {
  x: number
  y: number
}

interface DotItem {
  id: string
  x: number
  y: number
  type: 'energy' | 'golden' | 'speed' | 'freeze'
  points: number
  growth: number
  color: string
  pulse: number
}

interface Snake {
  body: Point[]
  dir: Direction
  nextDir: Direction
  name: string
  color: string
  glowColor: string
  score: number
  alive: boolean
  frozenUntil: number
  speedBoostUntil: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
}

interface Props {
  difficulty: GameDifficulty
  config: PlayerConfig
  onGameOver?: () => void
  onRestart?: () => void
}

export function SnakeDualBoard({
  difficulty,
  config,
  onGameOver,
  onRestart,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mode: 'pvp' (2 players on 1 keyboard) or 'ai' (Player vs Second Brain)
  const [gameMode, setGameMode] = useState<'pvp' | 'ai'>('pvp')
  const [matchDuration, setMatchDuration] = useState<number>(60) // in seconds
  const [timeLeft, setTimeLeft] = useState<number>(60)
  const [paused, setPaused] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Scores & lengths
  const [p1Length, setP1Length] = useState(4)
  const [p2Length, setP2Length] = useState(4)
  const [p1Score, setP1Score] = useState(0)
  const [p2Score, setP2Score] = useState(0)
  const [roundWinner, setRoundWinner] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [winReason, setWinReason] = useState<string>('')

  // H2H Score tally
  const [p1Wins, setP1Wins] = useState(0)
  const [p2Wins, setP2Wins] = useState(0)

  // Game internal state refs
  const p1Ref = useRef<Snake>({
    body: [],
    dir: 'RIGHT',
    nextDir: 'RIGHT',
    name: config.playerName || 'Player 1',
    color: '#00f0ff',
    glowColor: 'rgba(0, 240, 255, 0.6)',
    score: 0,
    alive: true,
    frozenUntil: 0,
    speedBoostUntil: 0,
  })

  const p2Ref = useRef<Snake>({
    body: [],
    dir: 'LEFT',
    nextDir: 'LEFT',
    name: gameMode === 'pvp' ? 'Player 2' : config.botName || 'Second Brain',
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.6)',
    score: 0,
    alive: true,
    frozenUntil: 0,
    speedBoostUntil: 0,
  })

  const dotsRef = useRef<DotItem[]>([])
  const particlesRef = useRef<Particle[]>([])

  // Spawn random dots avoiding snake bodies
  const spawnDot = useCallback((): DotItem | null => {
    const occupied = new Set<string>()
    p1Ref.current.body.forEach((p) => occupied.add(`${p.x},${p.y}`))
    p2Ref.current.body.forEach((p) => occupied.add(`${p.x},${p.y}`))
    dotsRef.current.forEach((d) => occupied.add(`${d.x},${d.y}`))

    for (let attempts = 0; attempts < 100; attempts++) {
      const x = Math.floor(Math.random() * (GRID_COLS - 4)) + 2
      const y = Math.floor(Math.random() * (GRID_ROWS - 4)) + 2
      if (!occupied.has(`${x},${y}`)) {
        const rand = Math.random()
        let type: DotItem['type'] = 'energy'
        let points = 10
        let growth = 1
        let color = '#ec4899' // Pink/Red

        if (rand > 0.85) {
          type = 'golden'
          points = 40
          growth = 3
          color = '#fbbf24' // Gold
        } else if (rand > 0.7) {
          type = 'speed'
          points = 20
          growth = 2
          color = '#38bdf8' // Cyan
        } else if (rand > 0.55) {
          type = 'freeze'
          points = 15
          growth = 1
          color = '#a855f7' // Purple
        }

        return {
          id: crypto.randomUUID(),
          x,
          y,
          type,
          points,
          growth,
          color,
          pulse: 0,
        }
      }
    }
    return null
  }, [])

  // Initialize Game
  const initGame = useCallback(() => {
    // P1 starts at left facing right
    p1Ref.current = {
      body: [
        { x: 8, y: 12 },
        { x: 7, y: 12 },
        { x: 6, y: 12 },
        { x: 5, y: 12 },
      ],
      dir: 'RIGHT',
      nextDir: 'RIGHT',
      name: config.playerName || 'Player 1',
      color: '#00f0ff',
      glowColor: 'rgba(0, 240, 255, 0.7)',
      score: 0,
      alive: true,
      frozenUntil: 0,
      speedBoostUntil: 0,
    }

    // P2 starts at right facing left
    p2Ref.current = {
      body: [
        { x: 27, y: 12 },
        { x: 28, y: 12 },
        { x: 29, y: 12 },
        { x: 30, y: 12 },
      ],
      dir: 'LEFT',
      nextDir: 'LEFT',
      name: gameMode === 'pvp' ? 'Player 2' : config.botName || 'Second Brain',
      color: '#f97316',
      glowColor: 'rgba(249, 115, 22, 0.7)',
      score: 0,
      alive: true,
      frozenUntil: 0,
      speedBoostUntil: 0,
    }

    dotsRef.current = []
    for (let i = 0; i < 5; i++) {
      const d = spawnDot()
      if (d) dotsRef.current.push(d)
    }

    particlesRef.current = []
    setTimeLeft(matchDuration)
    setP1Length(4)
    setP2Length(4)
    setP1Score(0)
    setP2Score(0)
    setRoundWinner(null)
    setWinReason('')
    setGameOver(false)
  }, [config.playerName, config.botName, gameMode, matchDuration, spawnDot])

  useEffect(() => {
    initGame()
  }, [initGame])

  const persistResult = useCallback(
    (res: 'win' | 'loss' | 'draw') => {
      saveGameSession({
        id: crypto.randomUUID(),
        gameType: 'snake',
        difficulty,
        result: res,
        stateJson: JSON.stringify({
          mode: gameMode,
          p1Length: p1Ref.current.body.length,
          p2Length: p2Ref.current.body.length,
        }),
      }).catch(() => {})
    },
    [difficulty, gameMode]
  )

  // End game on time expiration: Longest snake wins!
  const handleTimeUp = useCallback(() => {
    const l1 = p1Ref.current.body.length
    const l2 = p2Ref.current.body.length

    let winText = ''
    let winnerName = ''
    if (l1 > l2) {
      winnerName = p1Ref.current.name
      winText = `Time Expired! ${winnerName} is LONGEST (${l1} vs ${l2} tiles)!`
      setP1Wins((w) => w + 1)
      persistResult('win')
    } else if (l2 > l1) {
      winnerName = p2Ref.current.name
      winText = `Time Expired! ${winnerName} is LONGEST (${l2} vs ${l1} tiles)!`
      setP2Wins((w) => w + 1)
      persistResult('loss')
    } else {
      winText = `Epic Tie! Both snakes finished with length ${l1}!`
      persistResult('draw')
    }

    setRoundWinner(winnerName || 'Tie')
    setWinReason(winText)
    setGameOver(true)
    if (soundEnabled) playVictoryFanfare()
    if (onGameOver) onGameOver()
  }, [soundEnabled, onGameOver, persistResult])

  // Countdown Match Timer
  useEffect(() => {
    if (gameOver || paused) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [gameOver, paused, handleTimeUp])

  // Keyboard controls:
  // Player 1: WASD
  // Player 2: Arrow Keys (in PvP)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const p1 = p1Ref.current
      const p2 = p2Ref.current

      // Player 1 Controls (WASD)
      if (e.code === 'KeyW' && p1.dir !== 'DOWN') p1.nextDir = 'UP'
      if (e.code === 'KeyS' && p1.dir !== 'UP') p1.nextDir = 'DOWN'
      if (e.code === 'KeyA' && p1.dir !== 'RIGHT') p1.nextDir = 'LEFT'
      if (e.code === 'KeyD' && p1.dir !== 'LEFT') p1.nextDir = 'RIGHT'

      // Player 2 Controls (Arrow Keys) in 2-Player mode
      if (gameMode === 'pvp') {
        if (e.code === 'ArrowUp' && p2.dir !== 'DOWN') p2.nextDir = 'UP'
        if (e.code === 'ArrowDown' && p2.dir !== 'UP') p2.nextDir = 'DOWN'
        if (e.code === 'ArrowLeft' && p2.dir !== 'RIGHT') p2.nextDir = 'LEFT'
        if (e.code === 'ArrowRight' && p2.dir !== 'LEFT') p2.nextDir = 'RIGHT'
      } else {
        // In AI mode, allow arrow keys to control Player 1 too!
        if (e.code === 'ArrowUp' && p1.dir !== 'DOWN') p1.nextDir = 'UP'
        if (e.code === 'ArrowDown' && p1.dir !== 'UP') p1.nextDir = 'DOWN'
        if (e.code === 'ArrowLeft' && p1.dir !== 'RIGHT') p1.nextDir = 'LEFT'
        if (e.code === 'ArrowRight' && p1.dir !== 'LEFT') p1.nextDir = 'RIGHT'
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameMode])

  // AI Decision Logic for Snake 2
  const computeAIMove = useCallback(() => {
    const ai = p2Ref.current
    if (!ai.alive || ai.body.length === 0) return
    const head = ai.body[0]

    // Target nearest dot
    let nearestDot: DotItem | null = null
    let minDist = Infinity
    dotsRef.current.forEach((d) => {
      const dist = Math.abs(d.x - head.x) + Math.abs(d.y - head.y)
      if (dist < minDist) {
        minDist = dist
        nearestDot = d
      }
    })

    const target = nearestDot ?? { x: GRID_COLS / 2, y: GRID_ROWS / 2 }

    const candidateDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    const validMoves: { dir: Direction; score: number }[] = []

    candidateDirs.forEach((dir) => {
      // Don't reverse onto own neck
      if (
        (dir === 'UP' && ai.dir === 'DOWN') ||
        (dir === 'DOWN' && ai.dir === 'UP') ||
        (dir === 'LEFT' && ai.dir === 'RIGHT') ||
        (dir === 'RIGHT' && ai.dir === 'LEFT')
      ) {
        return
      }

      let nx = head.x
      let ny = head.y
      if (dir === 'UP') ny -= 1
      if (dir === 'DOWN') ny += 1
      if (dir === 'LEFT') nx -= 1
      if (dir === 'RIGHT') nx += 1

      // 1. Check Wall Collision
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return

      // 2. Check Self Collision
      const hitsSelf = ai.body.some((seg) => seg.x === nx && seg.y === ny)
      if (hitsSelf) return

      // 3. Check Collision with Player 1 Body
      const hitsP1 = p1Ref.current.body.some((seg) => seg.x === nx && seg.y === ny)
      if (hitsP1) return

      // Score this move: closer to target is better
      const distToTarget = Math.abs(target.x - nx) + Math.abs(target.y - ny)
      // Bonus if moving away from walls
      const wallDist = Math.min(nx, GRID_COLS - 1 - nx, ny, GRID_ROWS - 1 - ny)
      validMoves.push({ dir, score: -distToTarget + wallDist * 0.2 })
    })

    if (validMoves.length > 0) {
      validMoves.sort((a, b) => b.score - a.score)
      ai.nextDir = validMoves[0].dir
    }
  }, [])

  // Main Tick loop
  useEffect(() => {
    if (gameOver || paused) return

    const tickRate = 120 // ms per step
    const interval = setInterval(() => {
      if (gameMode === 'ai') computeAIMove()
      stepGame()
    }, tickRate)

    return () => clearInterval(interval)
  })

  function stepGame() {
    const p1 = p1Ref.current
    const p2 = p2Ref.current
    const now = Date.now()

    if (!p1.alive || !p2.alive) return

    // Apply next directions
    p1.dir = p1.nextDir
    p2.dir = p2.nextDir

    const p1Frozen = now < p1.frozenUntil
    const p2Frozen = now < p2.frozenUntil

    // 1. Calculate New Heads
    let p1Head = { ...p1.body[0] }
    if (!p1Frozen) {
      if (p1.dir === 'UP') p1Head.y -= 1
      if (p1.dir === 'DOWN') p1Head.y += 1
      if (p1.dir === 'LEFT') p1Head.x -= 1
      if (p1.dir === 'RIGHT') p1Head.x += 1
    }

    let p2Head = { ...p2.body[0] }
    if (!p2Frozen) {
      if (p2.dir === 'UP') p2Head.y -= 1
      if (p2.dir === 'DOWN') p2Head.y += 1
      if (p2.dir === 'LEFT') p2Head.x -= 1
      if (p2.dir === 'RIGHT') p2Head.x += 1
    }

    // 2. CHECK CONDITION: DO NOT BANG THE WALL
    const p1HitWall =
      p1Head.x < 0 || p1Head.x >= GRID_COLS || p1Head.y < 0 || p1Head.y >= GRID_ROWS
    const p2HitWall =
      p2Head.x < 0 || p2Head.x >= GRID_COLS || p2Head.y < 0 || p2Head.y >= GRID_ROWS

    // 3. CHECK CONDITION: DO NOT TOUCH EACH OTHER & SELF
    const p1HitSelf = p1.body.some((p) => p.x === p1Head.x && p.y === p1Head.y)
    const p2HitSelf = p2.body.some((p) => p.x === p2Head.x && p.y === p2Head.y)

    // Touch opponent's body
    const p1HitP2Body = p2.body.some((p) => p.x === p1Head.x && p.y === p1Head.y)
    const p2HitP1Body = p1.body.some((p) => p.x === p2Head.x && p.y === p2Head.y)

    // Head-to-head collision
    const headToHead = p1Head.x === p2Head.x && p1Head.y === p2Head.y

    // Resolve Collisions
    if (p1HitWall || p1HitSelf || p1HitP2Body || headToHead) {
      p1.alive = false
      createExplosion(p1Head.x, p1Head.y, p1.color)
    }
    if (p2HitWall || p2HitSelf || p2HitP1Body || headToHead) {
      p2.alive = false
      createExplosion(p2Head.x, p2Head.y, p2.color)
    }

    if (!p1.alive || !p2.alive) {
      if (soundEnabled) playCrashSound()

      // The longest surviving snake wins
      const l1 = p1.body.length
      const l2 = p2.body.length

      if (!p1.alive && p2.alive) {
        setRoundWinner(p2.name)
        setWinReason(
          p1HitWall
            ? `${p1.name} hit the wall! ${p2.name} wins (Length: ${l2})!`
            : `${p1.name} crashed into ${p2.name}! ${p2.name} wins (Length: ${l2})!`
        )
        setP2Wins((w) => w + 1)
        persistResult('loss')
      } else if (!p2.alive && p1.alive) {
        setRoundWinner(p1.name)
        setWinReason(
          p2HitWall
            ? `${p2.name} hit the wall! ${p1.name} wins (Length: ${l1})!`
            : `${p2.name} crashed into ${p1.name}! ${p1.name} wins (Length: ${l1})!`
        )
        setP1Wins((w) => w + 1)
        persistResult('win')
      } else {
        // Both crashed simultaneously! Longest wins!
        if (l1 > l2) {
          setRoundWinner(p1.name)
          setWinReason(`Both crashed! ${p1.name} was LONGEST (${l1} vs ${l2}) and takes the win!`)
          setP1Wins((w) => w + 1)
          persistResult('win')
        } else if (l2 > l1) {
          setRoundWinner(p2.name)
          setWinReason(`Both crashed! ${p2.name} was LONGEST (${l2} vs ${l1}) and takes the win!`)
          setP2Wins((w) => w + 1)
          persistResult('loss')
        } else {
          setRoundWinner('Tie')
          setWinReason(`Double Crash! Both had equal length of ${l1}. It's a draw!`)
          persistResult('draw')
        }
      }

      setGameOver(true)
      if (soundEnabled) playVictoryFanfare()
      if (onGameOver) onGameOver()
      return
    }

    // 4. Move Snakes forward
    if (!p1Frozen) p1.body.unshift(p1Head)
    if (!p2Frozen) p2.body.unshift(p2Head)

    // 5. Check Eating Dots (Growth condition)
    let p1Grew = false
    let p2Grew = false

    dotsRef.current = dotsRef.current.filter((dot) => {
      // P1 eats dot
      if (!p1Frozen && dot.x === p1Head.x && dot.y === p1Head.y) {
        p1Grew = true
        p1.score += dot.points
        if (soundEnabled) playEatDotSound(dot.type === 'golden', dot.type === 'speed')
        createExplosion(dot.x, dot.y, dot.color)

        if (dot.type === 'freeze') p2.frozenUntil = now + 1400
        if (dot.type === 'speed') p1.speedBoostUntil = now + 2500

        // Extra growth for special dots
        for (let g = 1; g < dot.growth; g++) {
          p1.body.push({ ...p1.body[p1.body.length - 1] })
        }
        return false
      }

      // P2 eats dot
      if (!p2Frozen && dot.x === p2Head.x && dot.y === p2Head.y) {
        p2Grew = true
        p2.score += dot.points
        if (soundEnabled) playEatDotSound(dot.type === 'golden', dot.type === 'speed')
        createExplosion(dot.x, dot.y, dot.color)

        if (dot.type === 'freeze') p1.frozenUntil = now + 1400
        if (dot.type === 'speed') p2.speedBoostUntil = now + 2500

        for (let g = 1; g < dot.growth; g++) {
          p2.body.push({ ...p2.body[p2.body.length - 1] })
        }
        return false
      }

      return true
    })

    // If not growing, pop tail
    if (!p1Grew && !p1Frozen) p1.body.pop()
    if (!p2Grew && !p2Frozen) p2.body.pop()

    // Replenish dots
    while (dotsRef.current.length < 5) {
      const d = spawnDot()
      if (d) dotsRef.current.push(d)
      else break
    }

    setP1Length(p1.body.length)
    setP2Length(p2.body.length)
    setP1Score(p1.score)
    setP2Score(p2.score)
  }

  function createExplosion(tileX: number, tileY: number, color: string) {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2
    const py = tileY * TILE_SIZE + TILE_SIZE / 2
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 4 + 1
      particlesRef.current.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
      })
    }
  }

  // Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    function render() {
      drawArena(ctx!)
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  })

  function drawArena(ctx: CanvasRenderingContext2D) {
    const width = GRID_COLS * TILE_SIZE
    const height = GRID_ROWS * TILE_SIZE

    ctx.clearRect(0, 0, width, height)

    // Arena Dark Base
    ctx.fillStyle = '#090b10'
    ctx.fillRect(0, 0, width, height)

    // Grid matrix
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.lineWidth = 1
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath()
      ctx.moveTo(c * TILE_SIZE, 0)
      ctx.lineTo(c * TILE_SIZE, height)
      ctx.stroke()
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * TILE_SIZE)
      ctx.lineTo(width, r * TILE_SIZE)
      ctx.stroke()
    }

    // Outer Lethal Barrier Glow
    ctx.strokeStyle = '#ef4444'
    ctx.shadowColor = '#ef4444'
    ctx.shadowBlur = 10
    ctx.lineWidth = 3
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3)
    ctx.shadowBlur = 0

    // Draw Dots
    dotsRef.current.forEach((dot) => {
      ctx.save()
      dot.pulse = (dot.pulse + 0.08) % (Math.PI * 2)
      const scale = 1 + Math.sin(dot.pulse) * 0.15
      const cx = dot.x * TILE_SIZE + TILE_SIZE / 2
      const cy = dot.y * TILE_SIZE + TILE_SIZE / 2

      ctx.fillStyle = dot.color
      ctx.shadowColor = dot.color
      ctx.shadowBlur = 12

      ctx.beginPath()
      if (dot.type === 'golden') {
        // Star diamond
        ctx.arc(cx, cy, (TILE_SIZE / 2.3) * scale, 0, Math.PI * 2)
      } else {
        ctx.arc(cx, cy, (TILE_SIZE / 2.8) * scale, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.restore()
    })

    // Draw Snake 1 (Player 1)
    drawSnake(ctx, p1Ref.current)

    // Draw Snake 2 (Player 2 or AI)
    drawSnake(ctx, p2Ref.current)

    // Draw and Update Particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.x += p.vx
      p.y += p.vy
      p.alpha -= 0.035
      if (p.alpha <= 0) return false

      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return true
    })
  }

  function drawSnake(ctx: CanvasRenderingContext2D, snake: Snake) {
    if (!snake.alive) return
    const body = snake.body
    if (body.length === 0) return

    ctx.save()
    ctx.shadowColor = snake.glowColor
    ctx.shadowBlur = 8

    // Draw Body Segments
    body.forEach((seg, idx) => {
      const isHead = idx === 0
      const px = seg.x * TILE_SIZE
      const py = seg.y * TILE_SIZE

      ctx.fillStyle = isHead ? '#ffffff' : snake.color
      ctx.beginPath()
      ctx.roundRect(px + 1.5, py + 1.5, TILE_SIZE - 3, TILE_SIZE - 3, isHead ? 6 : 4)
      ctx.fill()

      // Cute Eyes on Head
      if (isHead) {
        ctx.fillStyle = '#090b10'
        let eye1X = px + 6,
          eye1Y = py + 6,
          eye2X = px + 14,
          eye2Y = py + 6
        if (snake.dir === 'LEFT' || snake.dir === 'RIGHT') {
          eye1X = px + (snake.dir === 'RIGHT' ? 13 : 5)
          eye2X = eye1X
          eye1Y = py + 5
          eye2Y = py + 13
        }
        ctx.fillRect(eye1X - 1.5, eye1Y - 1.5, 3, 3)
        ctx.fillRect(eye2X - 1.5, eye2Y - 1.5, 3, 3)
      }
    })
    ctx.restore()
  }

  const p1Leading = p1Length > p2Length
  const p2Leading = p2Length > p1Length

  return (
    <div className="flex flex-col gap-3 w-full max-w-5xl mx-auto h-full overflow-hidden select-none">
      {/* Top Bento Row: Dual Player Stats & Match Countdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        {/* Player 1 Bento Card */}
        <div
          className={`rounded-2xl border p-3.5 shadow-[var(--shadow-sm)] flex flex-col justify-between transition-all ${
            p1Leading
              ? 'border-cyan-500/50 bg-cyan-950/20'
              : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              <span className="font-bold text-sm text-[var(--text)]">
                {config.playerName || 'Player 1'}
              </span>
            </div>
            {p1Leading && (
              <Badge tone="success">
                <Crown size={12} className="mr-1 text-amber-400" /> Leading
              </Badge>
            )}
          </div>

          <div className="mt-2.5 flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-[var(--muted)]">
                Snake Length
              </span>
              <span className="font-mono text-2xl font-black text-cyan-400">{p1Length}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--muted)]">Score: {p1Score}</span>
              <div className="text-[10px] font-mono text-[var(--muted)] mt-0.5">Keys: [ W A S D ]</div>
            </div>
          </div>

          {/* Length visual bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${Math.min(100, (p1Length / 35) * 100)}%` }}
            />
          </div>
        </div>

        {/* Center Match Status Bento Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] flex flex-col items-center justify-between text-center">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            {gameMode === 'pvp' ? <Users size={14} /> : <Bot size={14} />}
            <span className="font-semibold text-[var(--text)]">
              {gameMode === 'pvp' ? '1v1 Local 2-Player' : 'Player vs Second Brain'}
            </span>
          </div>

          <div className="my-1 flex items-baseline gap-1">
            <span className="font-mono text-4xl font-black tracking-tight text-[var(--text)]">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] font-semibold text-[var(--muted)] uppercase">Time</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-500 font-bold">P1: {p1Wins}W</span>
            <span className="text-[var(--muted)]">•</span>
            <span className="text-amber-500 font-bold">P2: {p2Wins}W</span>
          </div>
        </div>

        {/* Player 2 Bento Card */}
        <div
          className={`rounded-2xl border p-3.5 shadow-[var(--shadow-sm)] flex flex-col justify-between transition-all ${
            p2Leading
              ? 'border-orange-500/50 bg-orange-950/20'
              : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
              <span className="font-bold text-sm text-[var(--text)]">
                {gameMode === 'pvp' ? 'Player 2' : config.botName || 'Second Brain'}
              </span>
            </div>
            {p2Leading && (
              <Badge tone="warning">
                <Crown size={12} className="mr-1 text-amber-400" /> Leading
              </Badge>
            )}
          </div>

          <div className="mt-2.5 flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-[var(--muted)]">
                Snake Length
              </span>
              <span className="font-mono text-2xl font-black text-orange-400">{p2Length}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--muted)]">Score: {p2Score}</span>
              <div className="text-[10px] font-mono text-[var(--muted)] mt-0.5">
                {gameMode === 'pvp' ? 'Keys: [ ↑ ← ↓ → ]' : 'Controlled by AI'}
              </div>
            </div>
          </div>

          {/* Length visual bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-150"
              style={{ width: `${Math.min(100, (p2Length / 35) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Arena & Side Legend Bento */}
      <div className="relative flex-1 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-card)] overflow-hidden flex items-center justify-center min-h-[360px]">
        <canvas
          ref={canvasRef}
          width={GRID_COLS * TILE_SIZE}
          height={GRID_ROWS * TILE_SIZE}
          className="w-full h-full max-h-[500px] object-contain rounded-2xl"
        />

        {/* Game Over / Victory Modal */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in zoom-in-95">
            <div className="max-w-md w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 mb-3">
                <Trophy size={32} />
              </div>
              <h3 className="text-2xl font-black text-[var(--text)]">
                {roundWinner === 'Tie' ? "It's a Tie!" : `${roundWinner} Wins!`}
              </h3>
              <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">{winReason}</p>

              <div className="mt-4 flex items-center justify-center gap-6 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                <div>
                  <span className="text-[var(--muted)] block">P1 Final Length</span>
                  <span className="font-mono text-lg font-bold text-cyan-400">{p1Length}</span>
                </div>
                <div className="h-6 w-px bg-[var(--border)]" />
                <div>
                  <span className="text-[var(--muted)] block">P2 Final Length</span>
                  <span className="font-mono text-lg font-bold text-orange-400">{p2Length}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <Button onClick={initGame}>
                  <RotateCcw size={14} />
                  Play Again
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bento Row: Dot Legend & Match Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
        {/* Dot Power-Up Legend */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-pink-500 shadow-xs" />
              <span>Dot (+1)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-xs" />
              <span className="flex items-center gap-0.5">
                <Sparkles size={11} className="text-amber-400" /> Star (+3)
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-xs" />
              <span className="flex items-center gap-0.5">
                <Zap size={11} className="text-cyan-400" /> Speed (+2)
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500 shadow-xs" />
              <span>Freeze (+1)</span>
            </span>
          </div>
        </div>

        {/* Quick Match Options */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs flex items-center justify-between gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
            <button
              type="button"
              onClick={() => {
                setGameMode('pvp')
                initGame()
              }}
              className={`rounded-lg px-2.5 py-0.5 font-medium transition-all ${
                gameMode === 'pvp'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              2 Players (1v1)
            </button>
            <button
              type="button"
              onClick={() => {
                setGameMode('ai')
                initGame()
              }}
              className={`rounded-lg px-2.5 py-0.5 font-medium transition-all ${
                gameMode === 'ai'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              vs AI
            </button>
          </div>

          {/* Time Limit */}
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)] text-[11px]">Match:</span>
            {([60, 90, 120] as const).map((dur) => (
              <button
                key={dur}
                type="button"
                onClick={() => {
                  setMatchDuration(dur)
                  initGame()
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                  matchDuration === dur
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {dur}s
              </button>
            ))}
          </div>

          {/* Audio & Pause Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="rounded-lg border border-[var(--border)] p-1 text-[var(--muted)] hover:text-[var(--text)]"
              title="Toggle Audio"
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              className="rounded-lg border border-[var(--border)] p-1 text-[var(--muted)] hover:text-[var(--text)]"
              title="Pause"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                initGame()
                if (onRestart) onRestart()
              }}
              className="rounded-lg border border-[var(--border)] p-1 text-[var(--muted)] hover:text-[var(--text)]"
              title="Restart"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
