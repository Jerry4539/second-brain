import { invoke } from '@tauri-apps/api/core'

export interface SystemSpecs {
  os: string
  arch: string
  cpu_brand: string
  cpu_cores: number
  total_ram_gb: number
  is_apple_silicon: boolean
  has_metal: boolean
  acceleration: string
  recommended_tier: 'nano' | 'compact' | 'pro'
  optimal_threads: number
}

let cachedSpecs: SystemSpecs | null = null

export async function getSystemSpecs(): Promise<SystemSpecs> {
  if (cachedSpecs) return cachedSpecs
  try {
    const specs = await invoke<SystemSpecs>('get_system_specs')
    cachedSpecs = specs
    return specs
  } catch {
    const isMac = navigator.userAgent.toLowerCase().includes('mac')
    const fallback: SystemSpecs = {
      os: isMac ? 'macos' : 'windows',
      arch: isMac ? 'aarch64' : 'x86_64',
      cpu_brand: isMac ? 'Apple Silicon' : 'Multi-Core CPU',
      cpu_cores: navigator.hardwareConcurrency || 8,
      total_ram_gb: 16,
      is_apple_silicon: isMac,
      has_metal: isMac,
      acceleration: isMac ? 'Apple Metal GPU + Unified Memory' : 'AVX2 Multi-Core CPU',
      recommended_tier: 'pro',
      optimal_threads: 4,
    }
    return fallback
  }
}

