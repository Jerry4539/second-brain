export type GameDifficulty = 'easy' | 'medium' | 'hard'
export type GamePlayer = 'player' | 'ai'
export type GameResult = 'win' | 'loss' | 'draw' | 'in_progress'
export type LudoColor = 'red' | 'green' | 'yellow' | 'blue'

export interface PlayerConfig {
  playerName: string
  botName: string
  playerColor?: LudoColor
  playerCount?: 2 | 4
}

export interface GameStats {
  total: number
  wins: number
  losses: number
  draws: number
}

export interface GameEngine<TState, TMove> {
  id: string
  name: string
  initialize(difficulty: GameDifficulty, config?: Partial<PlayerConfig>): TState
  getLegalMoves(state: TState, player?: GamePlayer): TMove[]
  applyMove(state: TState, move: TMove): TState
  isGameOver(state: TState): boolean
  getWinner(state: TState): GamePlayer | 'draw' | null
  getAIMove(state: TState, difficulty: GameDifficulty): Promise<TMove>
}

