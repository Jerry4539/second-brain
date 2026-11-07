import Database from '@tauri-apps/plugin-sql'

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}

interface DbLike {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>
  execute(query: string, bindValues?: unknown[]): Promise<unknown>
}

const BROWSER_DB_KEY = 'secondbrain_browser_fallback_db_v1'

interface BrowserDbStore {
  settings: Record<string, string>
  models: ModelRecord[]
  conversations: ConversationRecord[]
  messages: MessageRecord[]
  images: ImageRecord[]
  games: GameRecord[]
  addons: AddonRecord[]
  favorites: { id: string; item_type: string; item_id: string; created_at: string }[]
}

function loadBrowserStore(): BrowserDbStore {
  try {
    const raw = localStorage.getItem(BROWSER_DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BrowserDbStore>
      return {
        settings: parsed.settings ?? {},
        models: parsed.models ?? [],
        conversations: parsed.conversations ?? [],
        messages: parsed.messages ?? [],
        images: parsed.images ?? [],
        games: parsed.games ?? [],
        addons: parsed.addons ?? [],
        favorites: parsed.favorites ?? [],
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    settings: {},
    models: [],
    conversations: [],
    messages: [],
    images: [],
    games: [],
    addons: [],
    favorites: [],
  }
}

function saveBrowserStore(store: BrowserDbStore) {
  try {
    localStorage.setItem(BROWSER_DB_KEY, JSON.stringify(store))
  } catch {
    // ignore storage errors
  }
}

function createBrowserFallbackDb(): DbLike {
  return {
    async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
      const store = loadBrowserStore()
      const q = query.trim().toLowerCase()
      if (q.includes('from settings')) {
        const key = String(bindValues[0] ?? '')
        const val = store.settings[key]
        return (val !== undefined ? [{ value: val }] : []) as unknown as T
      }
      if (q.includes('from models')) {
        if (q.includes('where path =')) {
          const p = String(bindValues[0] ?? '')
          return store.models.filter((m) => m.path === p) as unknown as T
        }
        if (q.includes('where kind =')) {
          const k = String(bindValues[0] ?? '')
          return store.models.filter((m) => m.kind === k) as unknown as T
        }
        return store.models as unknown as T
      }
      if (q.includes('from conversations')) {
        return store.conversations as unknown as T
      }
      if (q.includes('from messages')) {
        const cid = String(bindValues[0] ?? '')
        return store.messages.filter((m) => m.conversation_id === cid) as unknown as T
      }
      if (q.includes('from images')) {
        const limit = Number(bindValues[0] ?? 24)
        return store.images.slice(0, limit) as unknown as T
      }
      if (q.includes('from favorites')) {
        return store.favorites
          .filter((f) => f.item_type === 'conversation')
          .map((f) => ({ item_id: f.item_id })) as unknown as T
      }
      if (q.includes('from addons')) {
        return store.addons as unknown as T
      }
      if (q.includes('from games')) {
        return store.games as unknown as T
      }
      return [] as unknown as T
    },
    async execute(query: string, bindValues: unknown[] = []): Promise<unknown> {
      const store = loadBrowserStore()
      const q = query.trim().toLowerCase()
      const now = new Date().toISOString()

      if (q.startsWith('insert into settings')) {
        store.settings[String(bindValues[0])] = String(bindValues[1] ?? '')
      } else if (q.startsWith('insert into conversations')) {
        store.conversations.unshift({
          id: String(bindValues[0]),
          title: String(bindValues[1] ?? 'New chat'),
          model_id: (bindValues[2] as string | null) ?? null,
          created_at: now,
          updated_at: now,
          temperature: null,
          top_p: null,
          max_tokens: null,
        })
      } else if (q.startsWith('update conversations set updated_at')) {
        const c = store.conversations.find((x) => x.id === String(bindValues[0]))
        if (c) c.updated_at = now
      } else if (q.startsWith('update conversations set title')) {
        const c = store.conversations.find((x) => x.id === String(bindValues[1]))
        if (c) c.title = String(bindValues[0])
      } else if (q.startsWith('update conversations set temperature')) {
        const c = store.conversations.find((x) => x.id === String(bindValues[3]))
        if (c) {
          c.temperature = (bindValues[0] as number | null) ?? null
          c.top_p = (bindValues[1] as number | null) ?? null
          c.max_tokens = (bindValues[2] as number | null) ?? null
        }
      } else if (q.startsWith('delete from conversations')) {
        const cid = String(bindValues[0])
        store.conversations = store.conversations.filter((x) => x.id !== cid)
        store.messages = store.messages.filter((m) => m.conversation_id !== cid)
      } else if (q.startsWith('insert into messages')) {
        store.messages.push({
          id: String(bindValues[0]),
          conversation_id: String(bindValues[1]),
          role: bindValues[2] as MessageRecord['role'],
          content: String(bindValues[3] ?? ''),
          created_at: now,
        })
      } else if (q.startsWith('delete from messages where conversation_id')) {
        const cid = String(bindValues[0])
        store.messages = store.messages.filter((m) => m.conversation_id !== cid)
      } else if (q.startsWith('delete from messages where id = (')) {
        const cid = String(bindValues[0])
        const convMsgs = store.messages.filter((m) => m.conversation_id === cid)
        const last = convMsgs[convMsgs.length - 1]
        if (last) {
          store.messages = store.messages.filter((m) => m.id !== last.id)
        }
      } else if (q.startsWith('delete from messages where id =')) {
        const mid = String(bindValues[0])
        store.messages = store.messages.filter((m) => m.id !== mid)
      } else if (q.startsWith('insert or ignore into favorites')) {
        const id = String(bindValues[0])
        const itemId = String(bindValues[1])
        if (!store.favorites.some((f) => f.item_type === 'conversation' && f.item_id === itemId)) {
          store.favorites.unshift({ id, item_type: 'conversation', item_id: itemId, created_at: now })
        }
      } else if (q.startsWith('delete from favorites')) {
        const itemId = String(bindValues[0])
        store.favorites = store.favorites.filter(
          (f) => !(f.item_type === 'conversation' && f.item_id === itemId),
        )
      }

      saveBrowserStore(store)
      return { rowsAffected: 1 }
    },
  }
}

let dbPromise: Promise<DbLike> | null = null

export function getDb(): Promise<DbLike> {
  if (!isTauriRuntime()) {
    return Promise.resolve(createBrowserFallbackDb())
  }
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:secondbrain.db').catch((err) => {
      dbPromise = null
      throw err
    })
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

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM messages WHERE id = $1', [id])
}

export async function deleteMessagesByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getDb()
  for (const id of ids) {
    await db.execute('DELETE FROM messages WHERE id = $1', [id])
  }
}

export async function clearConversationMessages(conversationId: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM messages WHERE conversation_id = $1', [conversationId])
}

export async function listFavoriteConversationIds(): Promise<string[]> {
  const db = await getDb()
  const rows = await db.select<{ item_id: string }[]>(
    "SELECT item_id FROM favorites WHERE item_type = 'conversation' ORDER BY created_at DESC",
    [],
  )
  return rows.map((r) => r.item_id)
}

export async function toggleFavoriteConversation(
  conversationId: string,
  makeFavorite: boolean,
): Promise<void> {
  const db = await getDb()
  if (makeFavorite) {
    await db.execute(
      "INSERT OR IGNORE INTO favorites (id, item_type, item_id) VALUES ($1, 'conversation', $2)",
      [crypto.randomUUID(), conversationId],
    )
  } else {
    await db.execute(
      "DELETE FROM favorites WHERE item_type = 'conversation' AND item_id = $1",
      [conversationId],
    )
  }
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

