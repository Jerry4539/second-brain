import type { GameDifficulty, GameEngine, GamePlayer, LudoColor, PlayerConfig } from './types'

export type { LudoColor }

export interface LudoToken {
  id: number // 0, 1, 2, 3
  color: LudoColor
  stepCount: number // -1 = yard, 0..50 = track, 51 = entry, 52..56 = home stretch, 57 = home goal
}

export interface LudoPlayerInfo {
  id: string
  name: string
  color: LudoColor
  isAI: boolean
}

export interface LudoState {
  players: LudoPlayerInfo[]
  tokens: Record<LudoColor, LudoToken[]>
  currentTurnColor: LudoColor
  diceValue: number | null
  diceRolled: boolean
  consecutiveSixes: number
  winner: LudoColor | null
  difficulty: GameDifficulty
  moveLog: string[]
  playerCount: 2 | 4
}

// 52-tile circuit starting coordinates on a 15x15 board (0-indexed: row 0..14, col 0..14)
// Starting from Red Start at index 0 and moving clockwise
export const TRACK_COORDINATES: Array<{ r: number; c: number }> = [
  /* 0..4: Red track going up */
  { r: 13, c: 6 }, // 0: Red Start (Safe)
  { r: 12, c: 6 },
  { r: 11, c: 6 },
  { r: 10, c: 6 },
  { r: 9, c: 6 },
  /* 5..10: Heading west towards blue base */
  { r: 8, c: 5 },
  { r: 8, c: 4 },
  { r: 8, c: 3 },
  { r: 8, c: 2 }, // 8: Safe Star
  { r: 8, c: 1 },
  { r: 8, c: 0 },
  /* 11..12: Turning north */
  { r: 7, c: 0 },
  { r: 6, c: 0 },
  /* 13..17: Heading east past blue start */
  { r: 6, c: 1 }, // 13: Blue Start (Safe)
  { r: 6, c: 2 },
  { r: 6, c: 3 },
  { r: 6, c: 4 },
  { r: 6, c: 5 },
  /* 18..23: Heading north towards top */
  { r: 5, c: 6 },
  { r: 4, c: 6 },
  { r: 3, c: 6 },
  { r: 2, c: 6 }, // 21: Safe Star
  { r: 1, c: 6 },
  { r: 0, c: 6 },
  /* 24..25: Turning east at top */
  { r: 0, c: 7 },
  { r: 0, c: 8 },
  /* 26..30: Heading south past yellow start */
  { r: 1, c: 8 }, // 26: Yellow Start (Safe)
  { r: 2, c: 8 },
  { r: 3, c: 8 },
  { r: 4, c: 8 },
  { r: 5, c: 8 },
  /* 31..36: Heading east towards green base */
  { r: 6, c: 9 },
  { r: 6, c: 10 },
  { r: 6, c: 11 },
  { r: 6, c: 12 }, // 34: Safe Star
  { r: 6, c: 13 },
  { r: 6, c: 14 },
  /* 37..38: Turning south */
  { r: 7, c: 14 },
  { r: 8, c: 14 },
  /* 39..43: Heading west past green start */
  { r: 8, c: 13 }, // 39: Green Start (Safe)
  { r: 8, c: 12 },
  { r: 8, c: 11 },
  { r: 8, c: 10 },
  { r: 8, c: 9 },
  /* 44..49: Heading south towards bottom */
  { r: 9, c: 8 },
  { r: 10, c: 8 },
  { r: 11, c: 8 },
  { r: 12, c: 8 }, // 47: Safe Star
  { r: 13, c: 8 },
  { r: 14, c: 8 },
  /* 50..51: Turning west at bottom */
  { r: 14, c: 7 },
  { r: 14, c: 6 },
]

// Colored home paths (stepCount 52..56) leading to center goal (57)
export const HOME_PATHS: Record<LudoColor, Array<{ r: number; c: number }>> = {
  red: [
    { r: 13, c: 7 }, // Step 52
    { r: 12, c: 7 }, // Step 53
    { r: 11, c: 7 }, // Step 54
    { r: 10, c: 7 }, // Step 55
    { r: 9, c: 7 }, // Step 56
  ],
  blue: [
    { r: 7, c: 1 },
    { r: 7, c: 2 },
    { r: 7, c: 3 },
    { r: 7, c: 4 },
    { r: 7, c: 5 },
  ],
  yellow: [
    { r: 1, c: 7 },
    { r: 2, c: 7 },
    { r: 3, c: 7 },
    { r: 4, c: 7 },
    { r: 5, c: 7 },
  ],
  green: [
    { r: 7, c: 13 },
    { r: 7, c: 12 },
    { r: 7, c: 11 },
    { r: 7, c: 10 },
    { r: 7, c: 9 },
  ],
}

// Center goal coordinates (stepCount 57)
export const GOAL_COORDINATES: Record<LudoColor, { r: number; c: number }> = {
  red: { r: 8, c: 7 },
  blue: { r: 7, c: 6 },
  yellow: { r: 6, c: 7 },
  green: { r: 7, c: 8 },
}

// Token base yard slots (4 round holding positions inside each corner base)
export const YARD_SLOTS: Record<LudoColor, Array<{ r: number; c: number }>> = {
  blue: [
    { r: 1.5, c: 1.5 },
    { r: 1.5, c: 3.5 },
    { r: 3.5, c: 1.5 },
    { r: 3.5, c: 3.5 },
  ],
  yellow: [
    { r: 1.5, c: 10.5 },
    { r: 1.5, c: 12.5 },
    { r: 3.5, c: 10.5 },
    { r: 3.5, c: 12.5 },
  ],
  red: [
    { r: 10.5, c: 1.5 },
    { r: 10.5, c: 3.5 },
    { r: 12.5, c: 1.5 },
    { r: 12.5, c: 3.5 },
  ],
  green: [
    { r: 10.5, c: 10.5 },
    { r: 10.5, c: 12.5 },
    { r: 12.5, c: 10.5 },
    { r: 12.5, c: 12.5 },
  ],
}

export const COLOR_OFFSETS: Record<LudoColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  green: 39,
}

export const SAFE_TRACK_TILES = [0, 8, 13, 21, 26, 34, 39, 47]
export const TOTAL_TRACK_TILES = 52
export const HOME_GOAL_STEPS = 57

export function getTrackTileIndex(color: LudoColor, stepCount: number): number | null {
  if (stepCount < 0 || stepCount >= 52) return null
  return (COLOR_OFFSETS[color] + stepCount) % TOTAL_TRACK_TILES
}

export function isSafeTrackTile(tileIndex: number): boolean {
  return SAFE_TRACK_TILES.includes(tileIndex)
}

export function getTokenCoordinates(token: LudoToken): { r: number; c: number } {
  if (token.stepCount === -1) {
    return YARD_SLOTS[token.color][token.id]
  }
  if (token.stepCount === HOME_GOAL_STEPS) {
    return GOAL_COORDINATES[token.color]
  }
  if (token.stepCount >= 52) {
    const homeIdx = token.stepCount - 52
    return HOME_PATHS[token.color][homeIdx]
  }
  const trackIdx = getTrackTileIndex(token.color, token.stepCount)!
  return TRACK_COORDINATES[trackIdx]
}

export const ludoEngine: GameEngine<LudoState, number> = {
  id: 'ludo',
  name: 'Ludo',

  initialize(difficulty: GameDifficulty, config?: Partial<PlayerConfig>): LudoState {
    const pName = config?.playerName || 'Player'
    const bName = config?.botName || 'Second Brain'
    const pColor: LudoColor = config?.playerColor || 'red'
    const count = config?.playerCount || 2

    const allColors: LudoColor[] = ['red', 'blue', 'yellow', 'green']
    let activeColors: LudoColor[] = []

    if (count === 2) {
      // In 2-player, play opposite colors for balance
      const opposite: Record<LudoColor, LudoColor> = {
        red: 'yellow',
        yellow: 'red',
        blue: 'green',
        green: 'blue',
      }
      activeColors = [pColor, opposite[pColor]]
    } else {
      activeColors = allColors
    }

    const players: LudoPlayerInfo[] = activeColors.map((color, idx) => {
      if (color === pColor) {
        return { id: 'player', name: pName, color, isAI: false }
      }
      const botLabel = count === 2 ? bName : `${bName} ${idx + 1}`
      return { id: `bot_${color}`, name: botLabel, color, isAI: true }
    })

    const createTokens = (c: LudoColor): LudoToken[] => [
      { id: 0, color: c, stepCount: -1 },
      { id: 1, color: c, stepCount: -1 },
      { id: 2, color: c, stepCount: -1 },
      { id: 3, color: c, stepCount: -1 },
    ]

    const tokens: Record<LudoColor, LudoToken[]> = {
      red: createTokens('red'),
      blue: createTokens('blue'),
      yellow: createTokens('yellow'),
      green: createTokens('green'),
    }

    return {
      players,
      tokens,
      currentTurnColor: activeColors[0],
      diceValue: null,
      diceRolled: false,
      consecutiveSixes: 0,
      winner: null,
      difficulty,
      moveLog: [`Match started. ${pName} (${pColor.toUpperCase()}) rolls first.`],
      playerCount: count,
    }
  },

  getLegalMoves(state: LudoState, _player?: GamePlayer): number[] {
    if (state.winner !== null || !state.diceRolled || state.diceValue === null) {
      return []
    }

    const dice = state.diceValue
    const colorTokens = state.tokens[state.currentTurnColor] || []
    const legal: number[] = []

    colorTokens.forEach((token) => {
      if (token.stepCount === -1) {
        // Can only exit yard on rolling a 6
        if (dice === 6) legal.push(token.id)
      } else if (token.stepCount < HOME_GOAL_STEPS) {
        // Can move if stepCount + dice <= 57 (exact roll required for goal)
        if (token.stepCount + dice <= HOME_GOAL_STEPS) {
          legal.push(token.id)
        }
      }
    })

    return legal
  },

  applyMove(state: LudoState, tokenId: number): LudoState {
    if (!state.diceRolled || state.diceValue === null || state.winner !== null) {
      return state
    }

    const dice = state.diceValue
    const currentColor = state.currentTurnColor
    const curPlayer = state.players.find((p) => p.color === currentColor)!
    const colorTokens = [...state.tokens[currentColor]]

    const tokenIdx = colorTokens.findIndex((t) => t.id === tokenId)
    if (tokenIdx === -1) return state

    const token = { ...colorTokens[tokenIdx] }
    let captured = false
    let logMsg = ''

    if (token.stepCount === -1) {
      token.stepCount = 0
      logMsg = `${curPlayer.name} released Token ${tokenId + 1} from base.`
    } else {
      token.stepCount += dice
      if (token.stepCount === HOME_GOAL_STEPS) {
        logMsg = `${curPlayer.name} guided Token ${tokenId + 1} into HOME GOAL!`
      } else if (token.stepCount >= 52) {
        logMsg = `${curPlayer.name} advanced Token ${tokenId + 1} onto the home path.`
      } else {
        const destTile = getTrackTileIndex(currentColor, token.stepCount)!
        logMsg = `${curPlayer.name} moved Token ${tokenId + 1} forward ${dice} spaces.`

        // Check capture against other active players if tile is not safe
        if (!isSafeTrackTile(destTile)) {
          for (const otherPlayer of state.players) {
            if (otherPlayer.color === currentColor) continue

            const otherTokens = state.tokens[otherPlayer.color]
            const victimIdx = otherTokens.findIndex((ot) => {
              if (ot.stepCount < 0 || ot.stepCount >= 52) return false
              return getTrackTileIndex(otherPlayer.color, ot.stepCount) === destTile
            })

            if (victimIdx !== -1) {
              const updatedOtherTokens = [...otherTokens]
              updatedOtherTokens[victimIdx] = {
                ...updatedOtherTokens[victimIdx],
                stepCount: -1,
              }
              state.tokens[otherPlayer.color] = updatedOtherTokens
              captured = true
              logMsg += ` Captured ${otherPlayer.name}'s token!`
              break
            }
          }
        }
      }
    }

    colorTokens[tokenIdx] = token
    const newTokens = { ...state.tokens, [currentColor]: colorTokens }

    // Check winner: all 4 tokens have reached HOME_GOAL_STEPS (57)
    const hasWon = colorTokens.every((t) => t.stepCount === HOME_GOAL_STEPS)
    if (hasWon) {
      return {
        ...state,
        tokens: newTokens,
        winner: currentColor,
        diceRolled: false,
        diceValue: null,
        moveLog: [`${curPlayer.name} has won the match!`, logMsg, ...state.moveLog],
      }
    }

    // Bonus roll logic:
    // Bonus roll granted if rolled 6 (and not 3 in a row) OR captured an opponent!
    const getsBonus = (dice === 6 && state.consecutiveSixes < 2) || captured

    let nextColor = currentColor
    if (!getsBonus) {
      // Rotate to next active player in clockwise order
      const playerIdx = state.players.findIndex((p) => p.color === currentColor)
      const nextIdx = (playerIdx + 1) % state.players.length
      nextColor = state.players[nextIdx].color
    }

    return {
      ...state,
      tokens: newTokens,
      currentTurnColor: nextColor,
      diceRolled: false,
      diceValue: null,
      consecutiveSixes: dice === 6 ? state.consecutiveSixes + 1 : 0,
      moveLog: [logMsg, ...state.moveLog],
    }
  },

  isGameOver(state: LudoState): boolean {
    return state.winner !== null
  },

  getWinner(state: LudoState): GamePlayer | null {
    if (!state.winner) return null
    const winningPlayer = state.players.find((p) => p.color === state.winner)
    return winningPlayer?.isAI ? 'ai' : 'player'
  },

  async getAIMove(state: LudoState, difficulty: GameDifficulty): Promise<number> {
    const legalMoves = this.getLegalMoves(state)
    if (legalMoves.length === 0) return -1

    // Natural tactical thinking pause (350ms to 500ms)
    await new Promise((r) => setTimeout(r, 420))

    if (difficulty === 'easy' || legalMoves.length === 1) {
      return legalMoves[Math.floor(Math.random() * legalMoves.length)]
    }

    const dice = state.diceValue ?? 1
    const color = state.currentTurnColor
    const tokens = state.tokens[color]

    let bestMove = legalMoves[0]
    let bestScore = -Infinity

    for (const tokenId of legalMoves) {
      const token = tokens.find((t) => t.id === tokenId)!
      let score = 0

      // Priority 1: Exiting base on 6
      if (token.stepCount === -1) {
        score += difficulty === 'hard' ? 85 : 45
      } else {
        const nextStep = token.stepCount + dice

        // Priority 2: Entering Home Goal (exact roll)
        if (nextStep === HOME_GOAL_STEPS) {
          score += 300
        } else if (nextStep >= 52) {
          // Priority 3: Entering Safe Home Stretch
          score += 100 + nextStep
        } else {
          const nextTile = getTrackTileIndex(color, nextStep)!

          // Priority 4: Capture enemy token on unprotected track tile
          if (!isSafeTrackTile(nextTile)) {
            for (const opp of state.players) {
              if (opp.color === color) continue
              const canCapture = state.tokens[opp.color].some((ot) => {
                if (ot.stepCount < 0 || ot.stepCount >= 52) return false
                return getTrackTileIndex(opp.color, ot.stepCount) === nextTile
              })
              if (canCapture) {
                score += difficulty === 'hard' ? 220 : 120
                break
              }
            }
          }

          // Priority 5: Reaching Safe Star tile
          if (isSafeTrackTile(nextTile)) {
            score += difficulty === 'hard' ? 60 : 30
          }

          // Priority 6: Hard AI defensive danger check
          if (difficulty === 'hard' && !isSafeTrackTile(nextTile)) {
            for (const opp of state.players) {
              if (opp.color === color) continue
              const inDanger = state.tokens[opp.color].some((ot) => {
                if (ot.stepCount < 0 || ot.stepCount >= 52) return false
                const oppTile = getTrackTileIndex(opp.color, ot.stepCount)!
                const dist = (nextTile - oppTile + TOTAL_TRACK_TILES) % TOTAL_TRACK_TILES
                return dist >= 1 && dist <= 6
              })
              if (inDanger) {
                score -= 75
              }
            }
          }

          // Progress weight
          score += token.stepCount * 0.4
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestMove = tokenId
      }
    }

    return bestMove
  },
}
