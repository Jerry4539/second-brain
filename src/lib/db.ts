import Database from '@tauri-apps/plugin-sql'

let dbPromise: Promise<Database> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:secondbrain.db')
  }
  return dbPromise
}

export interface ModelRecord {
  id: string
  name: string
  path: string
  format: string
  size_bytes: number | null
  quantization: string | null
  architecture: string | null
  status: string
  is_default: number
  created_at: string
  kind: 'text' | 'image'
}

export interface ConversationRecord {
  id: string
  title: string
  model_id: string | null
  created_at: string
  updated_at: string
  temperature: number | null
  top_p: number | null
  max_tokens: number | null
}

export interface MessageRecord {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface ImageRecord {
  id: string
  prompt: string
  negative_prompt: string | null
  file_path: string
  seed: number | null
  steps: number | null
  model_id: string | null
  is_favorite: number
  created_at: string
  width: number | null
  height: number | null
}

export interface GameRecord {
  id: string
  game_type: string
  difficulty: string
  result: string | null
  state_json: string | null
  created_at: string
  updated_at: string
}

export interface AddonRecord {
  id: string
  name: string
  version: string
  type: string
  entry: string
  enabled: number
  installed_at: string
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM settings WHERE key = $1',
    [key],
  )
  return rows[0]?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ' +
      'ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}

export interface NewModel {
  id: string
  name: string
  path: string
  sizeBytes: number | null
  quantization: string | null
  architecture: string | null
  kind?: 'text' | 'image'
  format?: string
}

export async function listModels(kind?: 'text' | 'image'): Promise<ModelRecord[]> {
  const db = await getDb()
  if (kind) {
    return db.select<ModelRecord[]>(
      'SELECT * FROM models WHERE kind = $1 ORDER BY is_default DESC, created_at DESC',
      [kind],
    )
  }
  return db.select<ModelRecord[]>(
    'SELECT * FROM models ORDER BY is_default DESC, created_at DESC',
  )
}

export async function findModelByPath(path: string): Promise<ModelRecord | null> {
  const db = await getDb()
  const rows = await db.select<ModelRecord[]>(
    'SELECT * FROM models WHERE path = $1',
    [path],
  )
  return rows[0] ?? null
}

export async function insertModel(model: NewModel): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO models (id, name, path, size_bytes, quantization, architecture, kind, format)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      model.id,
      model.name,
      model.path,
      model.sizeBytes,
      model.quantization,
      model.architecture,
      model.kind ?? 'text',
      model.format ?? 'gguf',
    ],
  )
}

export async function deleteModel(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM models WHERE id = $1', [id])
}

export async function setDefaultModel(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE models SET is_default = 0', [])
  await db.execute('UPDATE models SET is_default = 1 WHERE id = $1', [id])
}

export interface NewImage {
  id: string
  prompt: string
  negativePrompt: string | null
  filePath: string
  seed: number | null
  steps: number | null
  modelId: string | null
  width: number | null
  height: number | null
}

export async function listImages(limit = 24): Promise<ImageRecord[]> {
  const db = await getDb()
  return db.select<ImageRecord[]>(
    'SELECT * FROM images ORDER BY created_at DESC LIMIT $1',
    [limit],
  )
}

export async function insertImage(image: NewImage): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO images (id, prompt, negative_prompt, file_path, seed, steps, model_id, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      image.id,
      image.prompt,
      image.negativePrompt,
      image.filePath,
      image.seed,
      image.steps,
      image.modelId,
      image.width,
      image.height,
    ],
  )
}

export async function toggleFavoriteImage(id: string, isFavorite: boolean): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE images SET is_favorite = $1 WHERE id = $2', [
    isFavorite ? 1 : 0,
    id,
  ])
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM images WHERE id = $1', [id])
}

export interface ConversationSettings {
  temperature: number | null
  topP: number | null
  maxTokens: number | null
}

export async function listConversations(): Promise<ConversationRecord[]> {
  const db = await getDb()
  return db.select<ConversationRecord[]>(
    'SELECT * FROM conversations ORDER BY updated_at DESC',
  )
}

export async function createConversation(
  id: string,
  title: string,
  modelId: string | null,
): Promise<void> {
  const db = await getDb()
  await db.execute(
    'INSERT INTO conversations (id, title, model_id) VALUES ($1, $2, $3)',
    [id, title, modelId],
  )
}

export async function touchConversation(id: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    "UPDATE conversations SET updated_at = datetime('now') WHERE id = $1",
    [id],
  )
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE conversations SET title = $1 WHERE id = $2', [
    title,
    id,
  ])
}

export async function updateConversationSettings(
  id: string,
  settings: ConversationSettings,
): Promise<void> {
  const db = await getDb()
  await db.execute(
    'UPDATE conversations SET temperature = $1, top_p = $2, max_tokens = $3 WHERE id = $4',
    [settings.temperature, settings.topP, settings.maxTokens, id],
  )
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM conversations WHERE id = $1', [id])
}

export async function listMessages(conversationId: string): Promise<MessageRecord[]> {
  const db = await getDb()
  return db.select<MessageRecord[]>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId],
  )
}

export async function addMessage(
  id: string,
  conversationId: string,
  role: MessageRecord['role'],
  content: string,
): Promise<void> {
  const db = await getDb()
  await db.execute(
    'INSERT INTO messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
    [id, conversationId, role, content],
  )
}

export async function deleteLastMessage(conversationId: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    `DELETE FROM messages WHERE id = (
       SELECT id FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1
     )`,
    [conversationId],
  )
}

export async function listAddons(): Promise<AddonRecord[]> {
  const db = await getDb()
  return db.select<AddonRecord[]>(
    'SELECT * FROM addons ORDER BY installed_at DESC',
  )
}

export async function insertAddon(addon: {
  id: string
  name: string
  version: string
  type: string
  entry: string
  enabled?: number
}): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO addons (id, name, version, type, entry, enabled, installed_at)
     VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       version = excluded.version,
       type = excluded.type,
       entry = excluded.entry,
       enabled = excluded.enabled,
       installed_at = excluded.installed_at`,
    [
      addon.id,
      addon.name,
      addon.version,
      addon.type,
      addon.entry,
      addon.enabled ?? 1,
    ],
  )
}

export async function toggleAddon(id: string, enabled: boolean): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE addons SET enabled = $1 WHERE id = $2', [
    enabled ? 1 : 0,
    id,
  ])
}

export async function deleteAddon(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM addons WHERE id = $1', [id])
}

