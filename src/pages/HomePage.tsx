import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Gamepad2,
  ImagePlus,
  MessageSquare,
  Palette,
  Sparkles,
} from 'lucide-react'
import { chooseWithFallback } from '../lib/decisionEngine'
import { useToast } from '../lib/toast'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const ACTIVITIES = [
  {
    to: '/canvas',
    title: 'Canvas',
    desc: 'Draw freely and relax with ambient sounds.',
    icon: Palette,
    color: 'text-[var(--accent)]',
    bg: 'bg-[var(--accent)]/10',
  },
  {
    to: '/chat',
    title: 'Chat',
    desc: 'Talk with your private offline AI.',
    icon: MessageSquare,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
  },
  {
    to: '/create',
    title: 'Create',
    desc: 'Generate artwork from text prompts.',
    icon: ImagePlus,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    to: '/play',
    title: 'Play',
    desc: 'Play Tic-Tac-Toe and Ludo board games.',
    icon: Gamepad2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
]

export function HomePage() {
  const [choosing, setChoosing] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSurpriseMe() {
    setChoosing(true)
    try {
      const hour = new Date().getHours()
      const { choice } = await chooseWithFallback(
        { hour, greeting: getGreeting() },
        'Which activity would be best right now?',
        ACTIVITIES.map((a) => ({ key: a.to, description: a.desc })),
      )
      const picked = ACTIVITIES.find((a) => a.to === choice) ?? ACTIVITIES[0]
      showToast(`Opening ${picked.title}`, 'info')
      navigate(picked.to)
    } finally {
      setChoosing(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            {getGreeting()}
          </h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            What would you like to do?
          </p>
        </div>

        <button
          type="button"
          onClick={handleSurpriseMe}
          disabled={choosing}
          className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--text)] shadow-[var(--shadow-sm)] hover:border-[var(--accent)] transition-all shrink-0"
        >
          <Sparkles
            size={13}
            className={`text-[var(--accent)] ${choosing ? 'animate-spin' : ''}`}
          />
          <span>{choosing ? 'Picking…' : 'Surprise me'}</span>
        </button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ACTIVITIES.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} ${item.color}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text)]">
                    {item.title}
                  </h3>
                </div>

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--muted)] group-hover:text-[var(--text)] transition-colors border border-[var(--border)]">
                  <ArrowUpRight size={14} />
                </div>
              </div>

              <p className="text-xs text-[var(--muted)]">
                {item.desc}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
