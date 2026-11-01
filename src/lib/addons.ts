import { invoke } from '@tauri-apps/api/core'
import type { AddonRecord } from './db'
import {
  listAddons,
  insertAddon,
  toggleAddon,
  deleteAddon,
} from './db'

export interface AddonInfo {
  id: string
  name: string
  version: string
  addon_type: string
  entry: string
  description?: string
  author?: string
  icon?: string
  enabled: boolean
  installed_at: string
  path: string
}

export async function fetchInstalledAddons(): Promise<AddonRecord[]> {
  return listAddons()
}

export async function installAddonFromZip(zipPath: string): Promise<AddonInfo> {
  const info = await invoke<AddonInfo>('install_addon', { zipPath })
  await insertAddon({
    id: info.id,
    name: info.name,
    version: info.version,
    type: info.addon_type,
    entry: info.entry,
    enabled: 1,
  })
  return info
}

export async function installStarterAddon(starterId: string): Promise<AddonInfo> {
  const info = await invoke<AddonInfo>('install_starter_addon', { starterId })
  await insertAddon({
    id: info.id,
    name: info.name,
    version: info.version,
    type: info.addon_type,
    entry: info.entry,
    enabled: 1,
  })
  return info
}

export async function toggleAddonStatus(id: string, enabled: boolean): Promise<void> {
  await toggleAddon(id, enabled)
}

export async function uninstallAddonById(id: string): Promise<void> {
  await invoke('uninstall_addon', { id })
  await deleteAddon(id)
}

export async function getAddonDataUrl(id: string, relativePath: string): Promise<string> {
  return invoke<string>('read_addon_data_url', { id, relativePath })
}

export async function getAddonContent(id: string, relativePath: string): Promise<string> {
  return invoke<string>('read_addon_content', { id, relativePath })
}

