import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './db'

export interface ImageEngineStatus {
  available: boolean
  busy: boolean
  warm_model?: string | null
}

export interface ImageModelImportInfo {
  name: string
  size_bytes: number
  format: string
  architecture: string | null
}

export function imageEngineStatus(): Promise<ImageEngineStatus> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ available: false, busy: false, warm_model: null })
  }
  return invoke('image_engine_status')
}

export function stopImageEngine(): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve()
  return invoke('stop_image_engine')
}

export function importImageModel(path: string): Promise<ImageModelImportInfo> {
  return invoke('import_image_model', { path })
}

export function scanImageModelFolder(folder: string): Promise<string[]> {
  return invoke('scan_image_model_folder', { folder })
}

export function readImageDataUrl(path: string): Promise<string> {
  return invoke('read_image_data_url', { path })
}

export function cancelImageGeneration(requestId: string): Promise<void> {
  return invoke('cancel_image_generation', { requestId })
}

export interface GenerateImageRequest {
  modelPath: string
  prompt: string
  negativePrompt?: string
  width: number
  height: number
  steps: number
  seed?: number
  cfgScale?: number
  samplingMethod?: string
}

/** Runs one sd-cli generation to completion and resolves with the output PNG path. */
export function generateImage(
  request: GenerateImageRequest,
): { requestId: string; result: Promise<string>; cancel: () => void } {
  const requestId = crypto.randomUUID()
  const result = invoke<string>('generate_image', {
    requestId,
    modelPath: request.modelPath,
    prompt: request.prompt,
    negativePrompt: request.negativePrompt ?? null,
    width: request.width,
    height: request.height,
    steps: request.steps,
    seed: request.seed ?? null,
    cfgScale: request.cfgScale ?? null,
    samplingMethod: request.samplingMethod ?? null,
  })
  return { requestId, result, cancel: () => cancelImageGeneration(requestId) }
}
