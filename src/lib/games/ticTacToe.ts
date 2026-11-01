import type { GameDifficulty, GameEngine, GamePlayer } from './types'

export type CellValue = 'X' | 'O' | null

export interface TicTacToeState {
  board: CellValue[]
  currentTurn: GamePlayer
  winner: GamePlayer | 'draw' | null
  winningLine: number[] | null
  difficulty: GameDifficulty
  moveLog: string[]
}

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function checkWin(board: CellValue[], mark: 'X' | 'O'): number[] | null {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo
    if (board[a] === mark && board[b] === mark && board[c] === mark) {
      return combo
    }
  }
  return null
}

function minimax(
  board: CellValue[],
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number,
): { score: number; move: number } {
  const aiWin = checkWin(board, 'O')
  if (aiWin) return { score: 10 - depth, move: -1 }

  const playerWin = checkWin(board, 'X')
  if (playerWin) return { score: depth - 10, move: -1 }

  const emptyIndices: number[] = []
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) emptyIndices.push(i)
  }

  if (emptyIndices.length === 0) return { score: 0, move: -1 }

  if (isMaximizing) {
    let maxEval = -Infinity
    let bestMove = emptyIndices[0]
    for (const idx of emptyIndices) {
      board[idx] = 'O'
      const evaluation = minimax(board, depth + 1, false, alpha, beta).score
      board[idx] = null
      if (evaluation > maxEval) {
        maxEval = evaluation
        bestMove = idx
      }
      alpha = Math.max(alpha, evaluation)
      if (beta <= alpha) break
    }
    return { score: maxEval, move: bestMove }
  } else {
    let minEval = Infinity
    let bestMove = emptyIndices[0]
    for (const idx of emptyIndices) {
      board[idx] = 'X'
      const evaluation = minimax(board, depth + 1, true, alpha, beta).score
      board[idx] = null
      if (evaluation < minEval) {
        minEval = evaluation
        bestMove = idx
      }
      beta = Math.min(beta, evaluation)
      if (beta <= alpha) break
    }
    return { score: minEval, move: bestMove }
  }
}

export const ticTacToeEngine: GameEngine<TicTacToeState, number> = {
  id: 'tic-tac-toe',
  name: 'Tic-Tac-Toe',

  initialize(difficulty: GameDifficulty): TicTacToeState {
    return {
      board: Array(9).fill(null),
      currentTurn: 'player',
      winner: null,
      winningLine: null,
      difficulty,
      moveLog: ['Game started. You are X, Second Brain is O.'],
    }
  },

  getLegalMoves(state: TicTacToeState): number[] {
    if (state.winner !== null) return []
    const moves: number[] = []
    for (let i = 0; i < 9; i++) {
      if (state.board[i] === null) moves.push(i)
    }
    return moves
  },

  applyMove(state: TicTacToeState, move: number): TicTacToeState {
    if (state.board[move] !== null || state.winner !== null) {
      return state
    }

    const mark: 'X' | 'O' = state.currentTurn === 'player' ? 'X' : 'O'
    const newBoard = [...state.board]
    newBoard[move] = mark

    const row = Math.floor(move / 3) + 1
    const col = (move % 3) + 1
    const actor = state.currentTurn === 'player' ? 'You' : 'Second Brain'
    const logEntry = `${actor} placed ${mark} at row ${row}, col ${col}`

    const winLine = checkWin(newBoard, mark)
    if (winLine) {
      return {
        ...state,
        board: newBoard,
        winner: state.currentTurn,
        winningLine: winLine,
        moveLog: [logEntry, `${actor} wins the game!`, ...state.moveLog],
      }
    }

    const isDraw = newBoard.every((cell) => cell !== null)
    if (isDraw) {
      return {
        ...state,
        board: newBoard,
        winner: 'draw',
        winningLine: null,
        moveLog: [logEntry, 'Game ended in a draw.', ...state.moveLog],
      }
    }

    return {
      ...state,
      board: newBoard,
      currentTurn: state.currentTurn === 'player' ? 'ai' : 'player',
      moveLog: [logEntry, ...state.moveLog],
    }
  },

  isGameOver(state: TicTacToeState): boolean {
    return state.winner !== null
  },

  getWinner(state: TicTacToeState): GamePlayer | 'draw' | null {
    return state.winner
  },

  async getAIMove(state: TicTacToeState, difficulty: GameDifficulty): Promise<number> {
    const legalMoves = this.getLegalMoves(state)
    if (legalMoves.length === 0) return -1

    // Artificial thinking delay (350-550ms) to feel like a real match
    await new Promise((r) => setTimeout(r, 400))

    if (difficulty === 'easy') {
      // 100% random legal move
      return legalMoves[Math.floor(Math.random() * legalMoves.length)]
    }

    if (difficulty === 'medium') {
      // 1. Can AI win immediately?
      for (const move of legalMoves) {
        const testBoard = [...state.board]
        testBoard[move] = 'O'
        if (checkWin(testBoard, 'O')) return move
      }

      // 2. Can Player win immediately? Block them!
      for (const move of legalMoves) {
        const testBoard = [...state.board]
        testBoard[move] = 'X'
        if (checkWin(testBoard, 'X')) return move
      }

      // 3. Take center if available
      if (state.board[4] === null) return 4

      // 4. Otherwise pick with 60% optimal / 40% random
      if (Math.random() > 0.4) {
        const result = minimax([...state.board], 0, true, -Infinity, Infinity)
        if (result.move !== -1) return result.move
      }

      return legalMoves[Math.floor(Math.random() * legalMoves.length)]
    }

    // Hard difficulty: Optimal Minimax
    const result = minimax([...state.board], 0, true, -Infinity, Infinity)
    return result.move !== -1 ? result.move : legalMoves[0]
  },
}
