import { Monitor, Moon, Sun } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { useTheme, type ThemeMode } from '../../lib/theme'
import { useToast } from '../../lib/toast'

const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light theme', icon: Sun },
  { mode: 'dark', label: 'Dark theme', icon: Moon },
  { mode: 'system', label: 'Match system theme', icon: Monitor },
]

export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const { showToast } = useToast()

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] p-1">
      {options.map(({ mode: optionMode, label, icon: Icon }) => (
        <IconButton
          key={optionMode}
          label={label}
          active={mode === optionMode}
          onClick={() => {
            setMode(optionMode)
            showToast(label, 'success')
          }}
        >
          <Icon size={16} />
        </IconButton>
      ))}
    </div>
  )
}
