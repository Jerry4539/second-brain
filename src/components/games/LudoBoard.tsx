import { useEffect, useState, useRef, useMemo } from 'react'
import {
  ludoEngine,
  type LudoState,
  type LudoToken,
  type LudoColor,
  getTokenCoordinates,
} from '../../lib/games/ludo'
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

const COLOR_CLASSES: Record<
  LudoColor,
  {
    bg: string
    border: string
    text: string
    ring: string
    tokenBg: string
    tokenBorder: string
    accent: string
    lightBg: string
  }
> = {
  red: {
    bg: 'bg-red-500',
    border: 'border-red-500',
    text: 'text-red-500',
    ring: 'ring-red-400',
    tokenBg: 'bg-gradient-to-br from-red-400 to-red-600',
    tokenBorder: 'border-red-700',
    accent: '#ef4444',
    lightBg: 'bg-red-500/10',
  },
  blue: {
    bg: 'bg-sky-500',
    border: 'border-sky-500',
    text: 'text-sky-500',
    ring: 'ring-sky-400',
    tokenBg: 'bg-gradient-to-br from-sky-400 to-sky-600',
    tokenBorder: 'border-sky-700',
    accent: '#0ea5e9',
    lightBg: 'bg-sky-500/10',
  },
  yellow: {
    bg: 'bg-amber-400',
    border: 'border-amber-400',
    text: 'text-amber-500',
    ring: 'ring-amber-300',
    tokenBg: 'bg-gradient-to-br from-amber-300 to-amber-500',
    tokenBorder: 'border-amber-600',
    accent: '#f59e0b',
    lightBg: 'bg-amber-400/10',
  },
  green: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-500',
    text: 'text-emerald-500',
    ring: 'ring-emerald-400',
    tokenBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    tokenBorder: 'border-emerald-700',
    accent: '#10b981',
    lightBg: 'bg-emerald-500/10',
  },
}

export function LudoBoard({ difficulty, config, onGameOver, onRestart }: Props) {
  const [state, setState] = useState<LudoState>(() =>
    ludoEngine.initialize(difficulty, config),
  )
  const [isRolling, setIsRolling] = useState(false)
  const [hoveredTokenId, setHoveredTokenId] = useState<number | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setState(ludoEngine.initialize(difficulty, config))
  }, [difficulty, config?.playerColor, config?.playerCount, config?.playerName, config?.botName])

  // Active player info
  const currentPlayer = useMemo(
    () => state.players.find((p) => p.color === state.currentTurnColor)!,
    [state.players, state.currentTurnColor],
  )

  const isPlayerTurn = !currentPlayer?.isAI
  const legalMoves = useMemo(() => {
    if (!state.diceRolled) return []
    return ludoEngine.getLegalMoves(state)
  }, [state])

  // AI automation loop
  useEffect(() => {
    if (state.winner !== null) return

    if (currentPlayer?.isAI) {
      if (!state.diceRolled) {
        aiTimerRef.current = setTimeout(() => {
          handleRollDice()
        }, 650)
      } else {
        const moves = ludoEngine.getLegalMoves(state)
        if (moves.length === 0) {
          // No moves available: pass turn
          aiTimerRef.current = setTimeout(() => {
            const playerIdx = state.players.findIndex((p) => p.color === state.currentTurnColor)
            const nextIdx = (playerIdx + 1) % state.players.length
            setState((prev) => ({
              ...prev,
              currentTurnColor: prev.players[nextIdx].color,
              diceRolled: false,
              diceValue: null,
              moveLog: [
                `${currentPlayer.name} rolled a ${prev.diceValue}. No moves available.`,
                ...prev.moveLog,
              ],
            }))
          }, 850)
        } else {
          // AI selects and executes move
          ludoEngine.getAIMove(state, state.difficulty).then((chosenTokenId) => {
            if (chosenTokenId !== -1) {
              aiTimerRef.current = setTimeout(() => {
                const nextState = ludoEngine.applyMove(state, chosenTokenId)
                setState(nextState)
                if (nextState.winner !== null) {
                  handleVictory(nextState.winner)
                }
              }, 400)
            }
          })
        }
      }
    }

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [state, currentPlayer])

  function handleRollDice() {
    if (isRolling || state.winner !== null) return
    if (isPlayerTurn && state.diceRolled) return

    setIsRolling(true)
    const rollDuration = 380

    setTimeout(() => {
      const rolled = Math.floor(Math.random() * 6) + 1
      setIsRolling(false)

      setState((prev) => {
        const tempState: LudoState = {
          ...prev,
          diceValue: rolled,
          diceRolled: true,
        }
        const available = ludoEngine.getLegalMoves(tempState)

        // If human player has no moves with this roll, auto pass after brief pause
        if (isPlayerTurn && available.length === 0) {
          setTimeout(() => {
            const playerIdx = prev.players.findIndex((p) => p.color === prev.currentTurnColor)
            const nextIdx = (playerIdx + 1) % prev.players.length
            setState((s) => ({
              ...s,
              currentTurnColor: s.players[nextIdx].color,
              diceRolled: false,
              diceValue: null,
              moveLog: [
                `${currentPlayer.name} rolled a ${rolled}. No legal moves.`,
                ...s.moveLog,
              ],
            }))
          }, 1100)
        }

        return {
          ...tempState,
          moveLog: [`${currentPlayer.name} rolled a ${rolled}.`, ...prev.moveLog],
        }
      })
    }, rollDuration)
  }

  function handleTokenClick(token: LudoToken) {
    if (!isPlayerTurn || !state.diceRolled || state.winner !== null) return
    if (token.color !== state.currentTurnColor) return
    if (!legalMoves.includes(token.id)) return

    const nextState = ludoEngine.applyMove(state, token.id)
    setState(nextState)
    setHoveredTokenId(null)

    if (nextState.winner !== null) {
      handleVictory(nextState.winner)
    }
  }

  function handleVictory(winningColor: LudoColor) {
    const winnerPlayer = state.players.find((p) => p.color === winningColor)
    const result = winnerPlayer?.isAI ? 'loss' : 'win'
    saveGameSession({
      id: crypto.randomUUID(),
      gameType: 'ludo',
      difficulty: state.difficulty,
      result,
      stateJson: JSON.stringify({
        winner: winningColor,
        players: state.players,
      }),
    })
    onGameOver?.(result)
  }

  function handleReset() {
    setState(ludoEngine.initialize(difficulty, config))
    setHoveredTokenId(null)
    onRestart?.()
  }

  // Pre-calculate token positions on the 15x15 board
  const allActiveTokens = useMemo(() => {
    const list: Array<{
      token: LudoToken
      r: number
      c: number
      isLegal: boolean
      player: (typeof state.players)[0]
    }> = []

    state.players.forEach((player) => {
      const colorTokens = state.tokens[player.color] || []
      colorTokens.forEach((token) => {
        const coords = getTokenCoordinates(token)
        const isLegal =
          isPlayerTurn &&
          state.currentTurnColor === player.color &&
          legalMoves.includes(token.id)

        list.push({
          token,
          r: coords.r,
          c: coords.c,
          isLegal,
          player,
        })
      })
    })

    return list
  }, [state, isPlayerTurn, legalMoves])

  // Count home tokens per player
  const homeCount = (color: LudoColor) =>
    (state.tokens[color] || []).filter((t: LudoToken) => t.stepCount === 57).length

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-3 w-full h-full select-none overflow-hidden">
      {/* 1. Primary Bento Tile: 15x15 Authentic Board Grid */}
      <div className="relative aspect-square h-full min-h-0 rounded-3xl border-2 border-[var(--border-strong)] bg-white shadow-2xl p-1 overflow-hidden shrink-0">
        {/* SVG Base & Grid Renderer */}
        <svg
          viewBox="0 0 15 15"
          className="w-full h-full rounded-2xl"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          {/* Background grid */}
          <rect width="15" height="15" fill="#ffffff" />

          {/* 1. Corner Bases (6x6 each) */}
          {/* Blue Base (Top-Left: 0,0 to 6,6) */}
          <rect x="0" y="0" width="6" height="6" fill="#0ea5e9" />
          <rect x="1" y="1" width="4" height="4" rx="0.5" fill="#ffffff" />
          <circle cx="2" cy="2" r="0.65" fill="#0ea5e9" />
          <circle cx="4" cy="2" r="0.65" fill="#0ea5e9" />
          <circle cx="2" cy="4" r="0.65" fill="#0ea5e9" />
          <circle cx="4" cy="4" r="0.65" fill="#0ea5e9" />

          {/* Yellow Base (Top-Right: 9,0 to 15,6) */}
          <rect x="9" y="0" width="6" height="6" fill="#facc15" />
          <rect x="10" y="1" width="4" height="4" rx="0.5" fill="#ffffff" />
          <circle cx="11" cy="2" r="0.65" fill="#facc15" />
          <circle cx="13" cy="2" r="0.65" fill="#facc15" />
          <circle cx="11" cy="4" r="0.65" fill="#facc15" />
          <circle cx="13" cy="4" r="0.65" fill="#facc15" />

          {/* Red Base (Bottom-Left: 0,9 to 6,15) */}
          <rect x="0" y="9" width="6" height="6" fill="#ef4444" />
          <rect x="1" y="10" width="4" height="4" rx="0.5" fill="#ffffff" />
          <circle cx="2" cy="11" r="0.65" fill="#ef4444" />
          <circle cx="4" cy="11" r="0.65" fill="#ef4444" />
          <circle cx="2" cy="13" r="0.65" fill="#ef4444" />
          <circle cx="4" cy="13" r="0.65" fill="#ef4444" />

          {/* Green Base (Bottom-Right: 9,9 to 15,15) */}
          <rect x="9" y="9" width="6" height="6" fill="#10b981" />
          <rect x="10" y="10" width="4" height="4" rx="0.5" fill="#ffffff" />
          <circle cx="11" cy="11" r="0.65" fill="#10b981" />
          <circle cx="13" cy="11" r="0.65" fill="#10b981" />
          <circle cx="11" cy="13" r="0.65" fill="#10b981" />
          <circle cx="13" cy="13" r="0.65" fill="#10b981" />

          {/* 2. Center Goal Triangles (6,6 to 9,9) */}
          {/* Top Yellow Triangle */}
          <polygon points="6,6 9,6 7.5,7.5" fill="#facc15" />
          {/* Right Green Triangle */}
          <polygon points="9,6 9,9 7.5,7.5" fill="#10b981" />
          {/* Bottom Red Triangle */}
          <polygon points="6,9 9,9 7.5,7.5" fill="#ef4444" />
          {/* Left Blue Triangle */}
          <polygon points="6,6 6,9 7.5,7.5" fill="#0ea5e9" />

          {/* 3. Colored Home Paths */}
          {/* Yellow Home Path: column 7, rows 1..5 */}
          {[1, 2, 3, 4, 5].map((r) => (
            <rect key={`y-home-${r}`} x="7" y={r} width="1" height="1" fill="#facc15" stroke="#e5e7eb" strokeWidth="0.04" />
          ))}
          {/* Yellow Start Tile: (1, 8) */}
          <rect x="8" y="1" width="1" height="1" fill="#facc15" stroke="#e5e7eb" strokeWidth="0.04" />

          {/* Green Home Path: row 7, cols 9..13 */}
          {[9, 10, 11, 12, 13].map((c) => (
            <rect key={`g-home-${c}`} x={c} y="7" width="1" height="1" fill="#10b981" stroke="#e5e7eb" strokeWidth="0.04" />
          ))}
          {/* Green Start Tile: (8, 13) */}
          <rect x="13" y="8" width="1" height="1" fill="#10b981" stroke="#e5e7eb" strokeWidth="0.04" />

          {/* Red Home Path: column 7, rows 9..13 */}
          {[9, 10, 11, 12, 13].map((r) => (
            <rect key={`r-home-${r}`} x="7" y={r} width="1" height="1" fill="#ef4444" stroke="#e5e7eb" strokeWidth="0.04" />
          ))}
          {/* Red Start Tile: (13, 6) */}
          <rect x="6" y="13" width="1" height="1" fill="#ef4444" stroke="#e5e7eb" strokeWidth="0.04" />

          {/* Blue Home Path: row 7, cols 1..5 */}
          {[1, 2, 3, 4, 5].map((c) => (
            <rect key={`b-home-${c}`} x={c} y="7" width="1" height="1" fill="#0ea5e9" stroke="#e5e7eb" strokeWidth="0.04" />
          ))}
          {/* Blue Start Tile: (6, 1) */}
          <rect x="1" y="6" width="1" height="1" fill="#0ea5e9" stroke="#e5e7eb" strokeWidth="0.04" />

          {/* 4. Track Grid lines for all path tiles */}
          {/* Top Arm: rows 0..5, cols 6..8 */}
          {Array.from({ length: 6 }).map((_, r) =>
            [6, 7, 8].map((c) => (
              <rect
                key={`top-arm-${r}-${c}`}
                x={c}
                y={r}
                width="1"
                height="1"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.04"
              />
            )),
          )}
          {/* Bottom Arm: rows 9..14, cols 6..8 */}
          {Array.from({ length: 6 }).map((_, i) => {
            const r = i + 9
            return [6, 7, 8].map((c) => (
              <rect
                key={`bot-arm-${r}-${c}`}
                x={c}
                y={r}
                width="1"
                height="1"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.04"
              />
            ))
          })}
          {/* Left Arm: rows 6..8, cols 0..5 */}
          {[6, 7, 8].map((r) =>
            Array.from({ length: 6 }).map((_, c) => (
              <rect
                key={`left-arm-${r}-${c}`}
                x={c}
                y={r}
                width="1"
                height="1"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.04"
              />
            )),
          )}
          {/* Right Arm: rows 6..8, cols 9..14 */}
          {[6, 7, 8].map((r) =>
            Array.from({ length: 6 }).map((_, i) => {
              const c = i + 9
              return (
                <rect
                  key={`right-arm-${r}-${c}`}
                  x={c}
                  y={r}
                  width="1"
                  height="1"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="0.04"
                />
              )
            }),
          )}

          {/* Center Goal Outer Border */}
          <rect x="6" y="6" width="3" height="3" fill="none" stroke="#94a3b8" strokeWidth="0.05" />

          {/* 5. Safe Stars on Board (8 safe stars) */}
          <g transform="translate(2.15, 8.15) scale(0.028)">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
            />
          </g>
          <g transform="translate(6.15, 2.15) scale(0.028)">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
            />
          </g>
          <g transform="translate(12.15, 6.15) scale(0.028)">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
            />
          </g>
          <g transform="translate(8.15, 12.15) scale(0.028)">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
            />
          </g>

          {/* 6. Board Entry Direction Arrows */}
          <g transform="translate(0.2, 6.25) scale(0.025)">
            <path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="#0ea5e9" strokeWidth="3" />
          </g>
          <g transform="translate(7.25, 0.2) scale(0.025)">
            <path d="M12 5v14M5 12l7 7 7-7" fill="none" stroke="#f59e0b" strokeWidth="3" />
          </g>
          <g transform="translate(13.8, 7.75) rotate(180) scale(0.025)">
            <path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="#10b981" strokeWidth="3" />
          </g>
          <g transform="translate(6.75, 14.2) rotate(270) scale(0.025)">
            <path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="#ef4444" strokeWidth="3" />
          </g>
        </svg>

        {/* 7. Interactive Token Overlay (Positioned on 15x15 board) */}
        {allActiveTokens.map(({ token, r, c, isLegal }) => {
          const colors = COLOR_CLASSES[token.color]
          const isSelected = hoveredTokenId === token.id && token.color === state.currentTurnColor

          const leftPercent = ((c + 0.1) / 15) * 100
          const topPercent = ((r + 0.1) / 15) * 100

          return (
            <button
              key={`${token.color}-${token.id}`}
              type="button"
              disabled={!isLegal}
              onClick={() => handleTokenClick(token)}
              onMouseEnter={() => setHoveredTokenId(token.id)}
              onMouseLeave={() => setHoveredTokenId(null)}
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                width: '5.3%',
                height: '5.3%',
              }}
              className={`absolute rounded-full border-2 flex items-center justify-center font-black text-[9px] shadow-lg transition-transform duration-200 select-none ${colors.tokenBg
                } ${colors.tokenBorder} text-white ${isLegal
                  ? 'cursor-pointer animate-bounce ring-4 ring-white z-30 scale-125'
                  : 'z-20'
                } ${isSelected ? 'scale-135' : ''}`}
            >
              {token.id + 1}
            </button>
          )
        })}
      </div>

      {/* 2. Side Bento Hub: Players, Dice, Match Feed */}
      <div className="flex flex-col justify-between w-full lg:w-[290px] h-full min-h-0 gap-3 shrink-0 overflow-hidden">
        {/* Bento Sub-Tile A: Players & Goal counters */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm flex flex-col gap-1.5 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Players & Goals
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {state.players.map((p) => {
              const isTurn = state.currentTurnColor === p.color && state.winner === null
              const colors = COLOR_CLASSES[p.color]
              const count = homeCount(p.color)

              return (
                <div
                  key={p.color}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all ${isTurn
                      ? `border-${colors.border} bg-[var(--surface-muted)] shadow-sm ring-2 ${colors.ring}`
                      : 'border-[var(--border)] bg-[var(--surface)]/70 opacity-75'
                    }`}
                >
                  <div
                    className={`h-3 w-3 rounded-full ${colors.bg} shrink-0 shadow-sm ${isTurn ? 'animate-pulse' : ''
                      }`}
                  />
                  <div className="flex flex-col overflow-hidden text-left">
                    <span className="truncate text-xs font-bold text-[var(--text)]">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      Goal: {count}/4
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bento Sub-Tile B: Dice & Roll Action */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm flex flex-col items-center justify-center gap-2.5 shrink-0">
          <div className="flex items-center gap-3 w-full justify-between">
            <button
              type="button"
              disabled={!isPlayerTurn || state.diceRolled || isRolling || state.winner !== null}
              onClick={handleRollDice}
              className={`relative h-14 w-14 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-all ${isPlayerTurn && !state.diceRolled && state.winner === null
                  ? 'cursor-pointer hover:scale-105 active:scale-95 border-amber-400 bg-amber-400/10 ring-4 ring-amber-400/20'
                  : 'cursor-default border-[var(--border)] bg-[var(--surface-muted)]'
                } ${isRolling ? 'animate-spin' : ''}`}
            >
              <DiceDots value={state.diceValue} />
            </button>

            <div className="flex flex-col text-left flex-1 min-w-0">
              <span className="text-[11px] text-[var(--muted)] truncate">
                {state.winner !== null
                  ? 'Match Finished'
                  : isPlayerTurn
                    ? state.diceRolled
                      ? 'Pulsing token can move'
                      : 'Your turn to roll'
                    : `${currentPlayer.name}'s turn`}
              </span>
              <span className="text-sm font-bold text-[var(--text)] truncate">
                {state.winner !== null ? (
                  `${state.players.find((p) => p.color === state.winner)?.name} Wins!`
                ) : isPlayerTurn && !state.diceRolled ? (
                  'Click to roll'
                ) : state.diceValue !== null ? (
                  `Rolled a ${state.diceValue}`
                ) : (
                  'Waiting to roll...'
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full">
            {isPlayerTurn && !state.diceRolled && state.winner === null && (
              <Button className="flex-1 text-xs py-1.5" onClick={handleRollDice}>
                Roll Dice
              </Button>
            )}

            <Button variant="secondary" className="text-xs py-1.5" onClick={handleReset}>
              <RotateCcw size={12} />
              Reset
            </Button>
          </div>
        </div>

        {/* Bento Sub-Tile C: Match Activity Feed */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-2.5 flex-1 min-h-[90px] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-[var(--muted)] mb-1 pb-1 border-b border-[var(--border)]/60">
            <span className="font-semibold uppercase tracking-wider">Match Log</span>
            <span className="capitalize font-medium text-[var(--text)]">Mode: {difficulty}</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 text-xs text-[var(--muted)] space-y-1">
            {state.moveLog.slice(0, 5).map((log, i) => (
              <div key={i} className="truncate py-0.5">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


// 3D dice pips (dots) component
function DiceDots({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <div className="flex flex-col items-center justify-center text-xs font-semibold text-[var(--muted)]">
        ROLL
      </div>
    )
  }

  const dot = (key: string) => (
    <div key={key} className="h-2 w-2 rounded-full bg-[var(--text)] shadow-sm" />
  )

  switch (value) {
    case 1:
      return <div className="flex items-center justify-center">{dot('center')}</div>
    case 2:
      return (
        <div className="flex h-10 w-10 justify-between p-1">
          <div className="self-start">{dot('tl')}</div>
          <div className="self-end">{dot('br')}</div>
        </div>
      )
    case 3:
      return (
        <div className="flex h-10 w-10 justify-between p-1">
          <div className="self-start">{dot('tl')}</div>
          <div className="self-center">{dot('c')}</div>
          <div className="self-end">{dot('br')}</div>
        </div>
      )
    case 4:
      return (
        <div className="flex h-10 w-10 flex-col justify-between p-1">
          <div className="flex justify-between">{[dot('tl'), dot('tr')]}</div>
          <div className="flex justify-between">{[dot('bl'), dot('br')]}</div>
        </div>
      )
    case 5:
      return (
        <div className="flex h-10 w-10 flex-col justify-between p-1">
          <div className="flex justify-between">{[dot('tl'), dot('tr')]}</div>
          <div className="flex justify-center">{dot('c')}</div>
          <div className="flex justify-between">{[dot('bl'), dot('br')]}</div>
        </div>
      )
    case 6:
      return (
        <div className="flex h-10 w-10 flex-col justify-between p-1">
          <div className="flex justify-between">{[dot('tl'), dot('tr')]}</div>
          <div className="flex justify-between">{[dot('ml'), dot('mr')]}</div>
          <div className="flex justify-between">{[dot('bl'), dot('br')]}</div>
        </div>
      )
    default:
      return <span className="text-xl font-bold">{value}</span>
  }
}
