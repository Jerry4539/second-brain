import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface EngineStatus {
  running: boolean
  model_path: string | null
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GenerationSettings {
  temperature?: number
  top_p?: number
  top_k?: number
  max_tokens?: number
  seed?: number
  messages?: ChatMessagePayload[]
  system_prompt?: string
}

export function startTextEngine(modelPath: string): Promise<void> {
  return invoke('start_text_engine', { modelPath })
}

export function stopTextEngine(): Promise<void> {
  return invoke('stop_text_engine')
}

export function textEngineStatus(): Promise<EngineStatus> {
  return invoke('text_engine_status')
}

export function cancelGeneration(requestId: string): Promise<void> {
  return invoke('cancel_generation', { requestId })
}

interface GenerateTextOptions {
  prompt: string
  settings?: GenerationSettings
  onToken: (token: string) => void
  onDone: () => void
  onError: (message: string) => void
}

/** Starts a streamed generation and wires up token/done/error events for this request only. */
export async function generateText({
  prompt,
  settings = {},
  onToken,
  onDone,
  onError,
}: GenerateTextOptions): Promise<{ requestId: string; cancel: () => void }> {
  const requestId = crypto.randomUUID()
  const unlisten: UnlistenFn[] = []

  unlisten.push(
    await listen<{ request_id: string; token: string }>(
      'text-engine:token',
      (event) => {
        if (event.payload.request_id === requestId) onToken(event.payload.token)
      },
    ),
  )
  unlisten.push(
    await listen<{ request_id: string }>('text-engine:done', (event) => {
      if (event.payload.request_id === requestId) {
        unlisten.forEach((fn) => fn())
        onDone()
      }
    }),
  )
  unlisten.push(
    await listen<{ request_id: string; message: string }>(
      'text-engine:error',
      (event) => {
        if (event.payload.request_id === requestId) {
          unlisten.forEach((fn) => fn())
          onError(event.payload.message)
        }
      },
    ),
  )

  invoke('generate_text', { requestId, prompt, settings }).catch((error) => {
    unlisten.forEach((fn) => fn())
    onError(String(error))
  })

  return { requestId, cancel: () => cancelGeneration(requestId) }
}
