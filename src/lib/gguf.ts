import { invoke } from '@tauri-apps/api/core'

export interface GgufImportInfo {
  name: string
  size_bytes: number
  architecture: string | null
  quantization: string | null
  context_length: number | null
  estimated_ram_bytes: number
}

export function importGgufModel(path: string): Promise<GgufImportInfo> {
  return invoke('import_gguf_model', { path })
}

export function scanGgufFolder(folder: string): Promise<string[]> {
  return invoke('scan_gguf_folder', { folder })
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
