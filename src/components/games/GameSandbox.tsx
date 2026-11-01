import { useState, useEffect } from 'react'
import { ArrowLeft, RotateCcw, User, Bot, Users, Palette, Settings2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { TicTacToeBoard } from './TicTacToeBoard'
import { LudoBoard } from './LudoBoard'
import { CarRaceBoard } from './CarRaceBoard'
import { SnakeDualBoard } from './SnakeDualBoard'
import type { GameDifficulty, GameStats, LudoColor, PlayerConfig } from '../../lib/games/types'
import { getGameStats } from '../../lib/games/db'
import { getSetting } from '../../lib/db'

export type SupportedGameId = 'tic-tac-toe' | 'ludo' | 'car-race' | 'snake'

interface Props {
  gameId: SupportedGameId
  onBack: () => void
}

export function GameSandbox({ gameId, onBack }: Props) {
  const [difficulty, setDifficulty] = useState<GameDifficulty>('medium')
  const [resetCount, setResetCount] = useState(0)
  const [stats, setStats] = useState<GameStats>({ total: 0, wins: 0, losses: 0, draws: 0 })
  const [showConfig, setShowConfig] = useState(false)

  // Player configuration
  const [playerName, setPlayerName] = useState('Player')
  const [botName, setBotName] = useState('Second Brain')
  const [playerColor, setPlayerColor] = useState<LudoColor>('red')
  const [playerCount, setPlayerCount] = useState<2 | 4>(2)

  const gameTitle =
    gameId === 'car-race'
      ? 'Apex Nitro: Grand Prix'
      : gameId === 'snake'
        ? 'Cyber Serpents: 2-Player Snake'
        : gameId === 'tic-tac-toe'
          ? 'Tic-Tac-Toe'
          : 'Ludo'

  // Load user name & bot name from SQLite settings
  useEffect(() => {
    async function loadDefaults() {
      try {
        const u = await getSetting('user_name')
        if (u && u.trim()) setPlayerName(u.trim())
        const b = await getSetting('bot_name')
        if (b && b.trim()) setBotName(b.trim())
      } catch {
        // Fallback to defaults
      }
    }
    loadDefaults()
  }, [])

  useEffect(() => {
    refreshStats()
  }, [gameId, resetCount])

  async function refreshStats() {
    try {
      const s = await getGameStats(gameId)
      setStats(s)
    } catch {
      // Ignore if db not initialized
    }
  }

  function handleGameOver() {
    refreshStats()
  }

  const activeConfig: PlayerConfig = {
    playerName,
    botName,
    playerColor,
    playerCount,
  }

  return (
    <div className="flex flex-col gap-2" style={{ height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
      {/* Sandbox Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-sm)] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to Games
          </Button>
          <div className="h-4 w-px bg-[var(--border)]" />
          <h2 className="text-base font-semibold text-[var(--text)]">{gameTitle}</h2>
          <span className="text-xs text-[var(--muted)]">
            {playerName} vs {botName}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Options toggle */}
          <Button
            variant={showConfig ? 'primary' : 'secondary'}
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings2 size={14} />
            Setup
          </Button>

          {/* Difficulty selector */}
          <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-muted)] p-1 text-xs">
            {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-lg px-2.5 py-1 font-medium capitalize transition-all ${
                  difficulty === d
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <Button variant="secondary" onClick={() => setResetCount((c) => c + 1)}>
            <RotateCcw size={14} />
            Restart
          </Button>
        </div>
      </div>

      {/* Setup / Customization Drawer */}
      {showConfig && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] animate-in fade-in duration-150">
          {/* Player Name Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
              <User size={13} />
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              maxLength={16}
              onChange={(e) => setPlayerName(e.target.value || 'Player')}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Bot Name Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
              <Bot size={13} />
              Opponent Name
            </label>
            <input
              type="text"
              value={botName}
              maxLength={16}
              onChange={(e) => setBotName(e.target.value || 'Second Brain')}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Ludo Specific: Color Picker */}
          {gameId === 'ludo' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Palette size={13} />
                Your Color
              </label>
              <div className="flex items-center gap-2 mt-0.5">
                {(
                  [
                    { color: 'red' as const, bg: 'bg-red-500' },
                    { color: 'blue' as const, bg: 'bg-sky-500' },
                    { color: 'yellow' as const, bg: 'bg-amber-400' },
                    { color: 'green' as const, bg: 'bg-emerald-500' },
                  ] as const
                ).map(({ color, bg }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setPlayerColor(color)}
                    className={`h-7 w-7 rounded-full ${bg} transition-transform ${
                      playerColor === color
                        ? 'ring-2 ring-offset-2 ring-[var(--text)] scale-110 shadow-md'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ludo Specific: Player Count */}
          {gameId === 'ludo' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Users size={13} />
                Match Format
              </label>
              <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-muted)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPlayerCount(2)}
                  className={`flex-1 rounded-lg py-1 font-medium transition-all ${
                    playerCount === 2
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  2 Players (1v1)
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerCount(4)}
                  className={`flex-1 rounded-lg py-1 font-medium transition-all ${
                    playerCount === 4
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  4 Players
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Arena */}
      <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-card)] min-h-0 overflow-hidden">
        {gameId === 'car-race' ? (
          <CarRaceBoard
            key={`race-${difficulty}-${playerName}-${botName}-${resetCount}`}
            difficulty={difficulty}
            config={activeConfig}
            onGameOver={handleGameOver}
            onRestart={() => setResetCount((c) => c + 1)}
          />
        ) : gameId === 'snake' ? (
          <SnakeDualBoard
            key={`snake-${difficulty}-${playerName}-${botName}-${resetCount}`}
            difficulty={difficulty}
            config={activeConfig}
            onGameOver={handleGameOver}
            onRestart={() => setResetCount((c) => c + 1)}
          />
        ) : gameId === 'tic-tac-toe' ? (
          <TicTacToeBoard
            key={`ttt-${difficulty}-${playerName}-${botName}-${resetCount}`}
            difficulty={difficulty}
            config={activeConfig}
            onGameOver={handleGameOver}
            onRestart={() => setResetCount((c) => c + 1)}
          />
        ) : (
          <LudoBoard
            key={`ludo-${difficulty}-${playerName}-${botName}-${playerColor}-${playerCount}-${resetCount}`}
            difficulty={difficulty}
            config={activeConfig}
            onGameOver={handleGameOver}
            onRestart={() => setResetCount((c) => c + 1)}
          />
        )}
      </div>

      {/* Persistent Record & Stats */}
      <div className="flex items-center justify-between px-3 text-xs text-[var(--muted)] shrink-0 py-0.5">
        <span>Session Record:</span>
        <div className="flex items-center gap-4">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            Wins: {stats.wins}
          </span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            Losses: {stats.losses}
          </span>
          {gameId === 'tic-tac-toe' && <span>Draws: {stats.draws}</span>}
          <span>Total matches: {stats.total}</span>
        </div>
      </div>
    </div>
  )
}
