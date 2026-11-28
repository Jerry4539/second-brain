import {
  AudioLines,
  Home,
  ImagePlus,
  MessageSquare,
  Palette,
  Settings,
  Cpu,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ size?: number | string; className?: string }>
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/create', label: 'Create', icon: ImagePlus },
  { to: '/canvas', label: 'Canvas', icon: Palette },
  { to: '/voice', label: 'Voice', icon: AudioLines },
  { to: '/models', label: 'Models', icon: Cpu },
  { to: '/settings', label: 'Settings', icon: Settings },
]
