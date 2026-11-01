import { useEffect, useState } from 'react'
import {
  Gamepad2,
  Hash,
  Dice5,
  Play,
  Trophy,
  Car,
  Users,
  Sparkles,
  Zap,
  Flame,
  ShieldAlert,
} from 'lucide-react'

import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { GameSandbox, type SupportedGameId } from '../components/games/GameSandbox'
import { getGameStats } from '../lib/games/db'
import type { GameStats } from '../lib/games/types'

interface GameDef {
  id: SupportedGameId
  name: string
  tagline: string
  icon: typeof Car
  badge: string
  badgeTone: 'success' | 'warning' | 'neutral'
  description: string
  rules: string
  highlights: string[]
  modes: string[]
  featured?: boolean
}

const games: GameDef[] = [
  {
    id: 'car-race',
    name: 'Apex Nitro: Multi-Track Grand Prix',
    tagline: 'High-speed top-down racing with Nitro boosts',
    icon: Car,
    badge: 'Multi-Track 3D Physics',
    badgeTone: 'warning',
    featured: true,
    description:
      'Compete against Second Brain on 4 unique circuits. Drift around hairpins, hit speed pads, charge your Nitro, and set lap records.',
    rules:
      'Steer with WASD or Arrow Keys. Press Space to ignite Nitro boost. Stay inside track barriers, pass through all checkpoints, and take the checkered flag first.',
    highlights: [
      '4 Tracks: Neo-Tokyo, Desert Dunes, Synthwave, Alpine Ice',
      'Realistic Drift & Barrier Collisions',
      'Nitro Boost Gauge & Radar Mini-Map',
    ],
    modes: ['1 Lap Sprint', '3 Laps GP', '5 Laps Endurance'],
  },
  {
    id: 'snake',
    name: 'Cyber Serpents: 2-Player Snake',
    tagline: 'Head-to-head neon arena — grow the longest to win!',
    icon: Flame,
    badge: '2-Player / Both Can Play',
    badgeTone: 'success',
    featured: true,
    description:
      'Play together on the same keyboard (P1: WASD vs P2: Arrow Keys) or challenge Second Brain AI. Eat dots to grow your snake, avoid electric walls, and trap your rival.',
    rules:
      'Condition 1: Eat dots to grow. Condition 2: Do NOT bang into boundary walls. Condition 3: Do NOT touch each other or yourself. Longest snake at time up wins!',
    highlights: [
      'Local 2-Player (Same Keyboard) or vs AI',
      'Power Dots: Gold (+3), Speed (+2), Freeze (+1)',
      'Timed Championship (60s/90s) & Sudden Death',
    ],
    modes: ['1v1 Local (WASD vs Arrows)', 'Player vs AI', 'Sudden Death'],
  },
  {
    id: 'ludo',
    name: 'Ludo Grand Arena',
    tagline: 'Classic board race with strategic tokens',
    icon: Dice5,
    badge: 'Classic Board',
    badgeTone: 'neutral',
    description:
      'Race, roll, and capture. Full board track, safe star tiles, and home goal against Second Brain.',
    rules:
      'Roll a 6 to bring tokens out of base. Capture enemy pieces to send them back. First to guide 4 tokens home wins.',
    highlights: ['2-Player or 4-Player Matches', 'Full Star Tile Safety Zones', 'AI Difficulty Engine'],
    modes: ['1v1 Match', '4-Player Free-for-All'],
  },
  {
    id: 'tic-tac-toe',
    name: 'Tactical Tic-Tac-Toe',
    tagline: 'Classic 3x3 battle of wits & minimax depth',
    icon: Hash,
    badge: 'Minimax Engine',
    badgeTone: 'neutral',
    description:
      'Classic 3x3 tactical battle. Easy, Medium, or Minimax Hard mode where Second Brain never blinks.',
    rules: 'Take turns placing X (You) and O (Second Brain). First to get 3 in a line wins.',
    highlights: ['Minimax AI Algorithm', 'Instant Quick Play', 'Difficulty Scaling'],
    modes: ['Easy', 'Medium', 'Hard (Unbeatable)'],
  },
]

export function PlayPage() {
  const [activeGame, setActiveGame] = useState<SupportedGameId | null>(null)
  const [stats, setStats] = useState<GameStats>({ total: 0, wins: 0, losses: 0, draws: 0 })

  useEffect(() => {
    getGameStats().then(setStats).catch(() => { })
  }, [activeGame])

  if (activeGame) {
    return (
      <div className="min-h-full w-full pb-6">
        <GameSandbox gameId={activeGame} onBack={() => setActiveGame(null)} />
      </div>
    )
  }

  const winPercentage = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Arcade & Games Hub"
        description="Offline arcade games and board classics against Second Brain or local 2-Player friends."
      />

      {/* Hero Bento Statistics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Bento 1: Total Matches */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Trophy size={15} className="text-amber-500" /> Career Matches
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-black text-[var(--text)]">{stats.total}</span>
            <span className="text-xs text-[var(--muted)]">played</span>
          </div>
        </div>

        {/* Bento 2: Wins */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="font-semibold text-emerald-500 flex items-center gap-1.5">
              <Sparkles size={15} className="text-emerald-500" /> Victories
            </span>
            <Badge tone="success">{winPercentage}% Win Rate</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-black text-emerald-500">{stats.wins}</span>
            <span className="text-xs text-[var(--muted)]">wins</span>
          </div>
        </div>

        {/* Bento 3: 2-Player & Arcade */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Users size={15} className="text-cyan-400" /> Multiplayer
            </span>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
              Same Keyboard
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
            Plug in or share your keyboard for instant 2-player head-to-head.
          </p>
        </div>

        {/* Bento 4: Offline Engine */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Zap size={15} className="text-[var(--accent)]" /> Audio & Physics
            </span>
            <span className="text-[10px] text-[var(--accent)] font-bold uppercase tracking-wider">
              100% Offline
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
            Web Audio synth sound effects and 60 FPS physics engines run entirely locally.
          </p>
        </div>
      </div>

      {/* Main Bento Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {games.map(
          ({
            id,
            name,
            tagline,
            icon: Icon,
            badge,
            badgeTone,
            description,
            rules,
            highlights,
            modes,
          }) => (
            <div
              key={id}
              className="group relative flex flex-col justify-between rounded-3xl border border-[var(--border)]
                bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] hover:border-[var(--border-strong)] hover:shadow-lg transition-all overflow-hidden"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] group-hover:scale-105 transition-transform shadow-xs">
                    <Icon size={26} />
                  </div>
                  <Badge tone={badgeTone}>{badge}</Badge>
                </div>

                <h3 className="text-xl font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                  {name}
                </h3>
                <p className="text-xs font-medium text-[var(--accent)] mt-0.5">{tagline}</p>
                <p className="mt-2.5 text-xs text-[var(--muted)] leading-relaxed">{description}</p>

                {/* Highlights Bento Pill List */}
                <div className="mt-4 flex flex-col gap-1.5">
                  {highlights.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[11px] text-[var(--text)] bg-[var(--surface-muted)]/70 px-2.5 py-1 rounded-xl"
                    >
                      <Sparkles size={11} className="text-[var(--accent)] shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                {/* Rules Banner */}
                <div className="mt-3.5 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)] leading-normal">
                  <span className="font-semibold text-[var(--text)] flex items-center gap-1 mb-1">
                    <ShieldAlert size={12} className="text-amber-500" /> Win Condition & Rules:
                  </span>
                  {rules}
                </div>
              </div>

              {/* Bottom Card Action Footer */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border)]/40">
                <div className="flex items-center gap-1 flex-wrap">
                  {modes.map((m, idx) => (
                    <span
                      key={idx}
                      className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                    >
                      {m}
                    </span>
                  ))}
                </div>

                <Button onClick={() => setActiveGame(id)} className="shadow-sm">
                  <Play size={14} className="fill-current" />
                  Play Now
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer Info Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <Gamepad2 size={16} className="text-[var(--accent)]" />
          <span>
            Real-time keyboard input, collision detectors, and AI pathfinding run with 0 network latency.
          </span>
        </div>
        <span className="font-mono text-[11px]">Second Brain Arcade v2.0</span>
      </div>
    </div>
  )
}
