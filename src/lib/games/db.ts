import { getDb, type GameRecord } from '../db'
import type { GameDifficulty, GameResult, GameStats } from './types'

export async function saveGameSession(session: {
  id: string
  gameType: string
  difficulty: GameDifficulty
  result: GameResult
  stateJson?: string
}): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO games (id, game_type, difficulty, result, state_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       result = excluded.result,
       state_json = excluded.state_json,
       updated_at = datetime('now')`,
    [
      session.id,
      session.gameType,
      session.difficulty,
      session.result,
      session.stateJson ?? null,
    ],
  )
}

export async function listRecentGames(gameType?: string, limit = 10): Promise<GameRecord[]> {
  const db = await getDb()
  if (gameType) {
    return db.select<GameRecord[]>(
      'SELECT * FROM games WHERE game_type = $1 ORDER BY updated_at DESC LIMIT $2',
      [gameType, limit],
    )
  }
  return db.select<GameRecord[]>(
    'SELECT * FROM games ORDER BY updated_at DESC LIMIT $1',
    [limit],
  )
}

export async function getGameStats(gameType?: string): Promise<GameStats> {
  const db = await getDb()
  const rows = gameType
    ? await db.select<{ result: string | null; count: number }[]>(
        'SELECT result, COUNT(*) as count FROM games WHERE game_type = $1 GROUP BY result',
        [gameType],
      )
    : await db.select<{ result: string | null; count: number }[]>(
        'SELECT result, COUNT(*) as count FROM games GROUP BY result',
        [],
      )

  let wins = 0
  let losses = 0
  let draws = 0
  let total = 0

  for (const row of rows) {
    const c = Number(row.count) || 0
    total += c
    if (row.result === 'win') wins += c
    else if (row.result === 'loss') losses += c
    else if (row.result === 'draw') draws += c
  }

  return { total, wins, losses, draws }
}
