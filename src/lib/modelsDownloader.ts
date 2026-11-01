import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface DownloadProgress {
  id: string
  downloadedBytes: number
  totalBytes: number | null
  percentage: number
}

interface RawProgressPayload {
  id: string
  downloaded_bytes: number
  total_bytes: number | null
}

export async function startModelDownload(
  id: string,
  url: string,
  filename: string,
): Promise<string> {
  return await invoke<string>('download_model', {
    id,
    url,
    filename,
  })
}

export async function cancelModelDownload(id: string): Promise<void> {
  await invoke('cancel_model_download', { id })
}

export async function onDownloadProgress(
  callback: (progress: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return await listen<RawProgressPayload>('model-download:progress', (event) => {
    const { id, downloaded_bytes, total_bytes } = event.payload
    const percentage =
      total_bytes && total_bytes > 0
        ? Math.min(100, Math.round((downloaded_bytes / total_bytes) * 100))
        : 0

    callback({
      id,
      downloadedBytes: downloaded_bytes,
      totalBytes: total_bytes,
      percentage,
    })
  })
}
