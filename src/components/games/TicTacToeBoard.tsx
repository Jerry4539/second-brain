import { useEffect, useState } from 'react'
import {
  ticTacToeEngine,
  type TicTacToeState,
} from '../../lib/games/ticTacToe'
import type { GameDifficulty, PlayerConfig } from '../../lib/games/types'
import { saveGameSession } from '../../lib/games/db'
import { RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'

interface Props {
  difficulty: GameDifficulty
  config?: Partial<PlayerConfig>
  onGameOver?: (result: 'win' | 'loss' | 'draw') => void
  onRestart?: () => void
}

export function TicTacToeBoard({ difficulty, config, onGameOver, onRestart }: Props) {
  const playerName = config?.playerName || 'Player'
  const botName = config?.botName || 'Second Brain'

  const [state, setState] = useState<TicTacToeState>(() =>
    ticTacToeEngine.initialize(difficulty),
  )
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [scores, setScores] = useState({ player: 0, ai: 0, draws: 0 })

  // Handle difficulty change or reset
  useEffect(() => {
    setState(ticTacToeEngine.initialize(difficulty))
  }, [difficulty])

  // Handle AI turn
  useEffect(() => {
    if (state.currentTurn === 'ai' && state.winner === null) {
      let cancelled = false
      setIsAiThinking(true)

      ticTacToeEngine.getAIMove(state, state.difficulty).then((move) => {
        if (!cancelled && move !== -1) {
          const nextState = ticTacToeEngine.applyMove(state, move)
          setState(nextState)
          setIsAiThinking(false)

          if (nextState.winner !== null) {
            handleResult(nextState.winner)
          }
        }
      })

      return () => {
        cancelled = true
        setIsAiThinking(false)
      }
    }
  }, [state])

  function handleCellClick(index: number) {
    if (state.board[index] !== null || state.currentTurn !== 'player' || state.winner !== null) {
      return
    }

    const nextState = ticTacToeEngine.applyMove(state, index)
    setState(nextState)

    if (nextState.winner !== null) {
      handleResult(nextState.winner)
    }
  }

  function handleResult(winner: 'player' | 'ai' | 'draw') {
    const result = winner === 'player' ? 'win' : winner === 'ai' ? 'loss' : 'draw'

    setScores((prev) => ({
      ...prev,
      player: winner === 'player' ? prev.player + 1 : prev.player,
      ai: winner === 'ai' ? prev.ai + 1 : prev.ai,
      draws: winner === 'draw' ? prev.draws + 1 : prev.draws,
    }))

    saveGameSession({
      id: crypto.randomUUID(),
      gameType: 'tic-tac-toe',
      difficulty: state.difficulty,
      result,
      stateJson: JSON.stringify(state.board),
    })
    onGameOver?.(result)
  }

  function handleReset() {
    setState(ticTacToeEngine.initialize(difficulty))
    onRestart?.()
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-5 w-full h-full select-none overflow-hidden">
      {/* 1. Left Bento Tile: Styled Framed Board matching Image 2 */}
      <div className="relative p-6 rounded-3xl border-2 border-rose-300/40 dark:border-rose-900/40 bg-rose-500/5 dark:bg-rose-950/20 shadow-xl shrink-0">
        <div className="relative grid grid-cols-3 w-[260px] h-[260px] md:w-[290px] md:h-[290px] bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-inner overflow-hidden">
          {state.board.map((cell, idx) => {
            const isWinningCell = state.winningLine?.includes(idx)
            const row = Math.floor(idx / 3)
            const col = idx % 3

            // Divider borders replicating the clean blue lines in Image 2
            const borderRight = col < 2 ? 'border-r-2 border-sky-300 dark:border-sky-600/60' : ''
            const borderBottom = row < 2 ? 'border-b-2 border-sky-300 dark:border-sky-600/60' : ''

            return (
              <button
                key={idx}
                type="button"
                disabled={cell !== null || state.currentTurn !== 'player' || state.winner !== null}
                onClick={() => handleCellClick(idx)}
                className={`flex items-center justify-center text-4xl font-black transition-all duration-150 ${borderRight} ${borderBottom} ${
                  cell === null && state.currentTurn === 'player' && state.winner === null
                    ? 'hover:bg-rose-500/10 cursor-pointer active:scale-95'
                    : 'cursor-default'
                } ${
                  isWinningCell
                    ? cell === 'X'
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-amber-500/20 text-amber-500'
                    : cell === 'X'
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-sky-500 dark:text-sky-400'
                }`}
              >
                {cell}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Right Bento Hub: Title, Scoreboard, Status, Controls */}
      <div className="flex flex-col justify-between w-full md:w-[280px] h-full min-h-0 max-h-[360px] gap-3">
        {/* Sub-Tile A: Header */}
        <div className="flex flex-col items-start p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            Classic Arena
          </span>
          <h2 className="text-xl font-black tracking-tight text-[var(--text)] font-mono">
            tic-tac-toe
          </h2>
          <div className="h-0.5 w-10 bg-rose-400 dark:bg-rose-500 rounded-full mt-1" />
        </div>

        {/* Sub-Tile B: Scoreboard */}
        <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col gap-2 text-xs font-semibold">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="text-[var(--text)] truncate max-w-[120px]">{playerName} (X)</span>
            </div>
            <span className="text-rose-500 font-bold">{scores.player}</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/60">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 inline-block" />
              <span className="text-[var(--text)] truncate max-w-[120px]">{botName} (O)</span>
            </div>
            <span className="text-sky-500 font-bold">{scores.ai}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1 border-t border-[var(--border)]/40">
            <span>Tied Matches:</span>
            <span>{scores.draws}</span>
          </div>
        </div>

        {/* Sub-Tile C: Status & Action */}
        <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col gap-2">
          <div className="text-xs">
            {state.winner === null ? (
              state.currentTurn === 'player' ? (
                <div className="flex items-center gap-2 text-[var(--text)] font-semibold">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Your turn (X)
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-medium">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                  {isAiThinking ? `${botName} is calculating...` : `${botName} is thinking...`}
                </div>
              )
            ) : (
              <div className="font-bold text-sm text-[var(--text)]">
                {state.winner === 'player'
                  ? `${playerName} wins!`
                  : state.winner === 'ai'
                    ? `${botName} wins!`
                    : 'Match Draw!'}
              </div>
            )}
          </div>

          <Button variant="secondary" className="w-full text-xs py-1.5" onClick={handleReset}>
            <RotateCcw size={13} />
            {state.winner !== null ? 'Play Again' : 'Reset Round'}
          </Button>
        </div>
      </div>
    </div>
  )
}
