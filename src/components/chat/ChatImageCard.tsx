import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  Copy,
  Download,
  Expand,
  ExternalLink,
  ImagePlus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ImageGenerationHud } from '../create/ImageGenerationHud'
import { useToast } from '../../lib/toast'

interface ChatImageCardProps {
  prompt: string
  dataUrl?: string | null
  filePath?: string | null
  generating?: boolean
  error?: string | null
  onRegenerate?: () => void
}

export function ChatImageCard({
  prompt,
  dataUrl,
  filePath,
  generating = false,
  error = null,
  onRegenerate,
}: ChatImageCardProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  function handleCopyPrompt() {
    navigator.clipboard.writeText(prompt)
    showToast('Prompt copied to clipboard', 'success')
  }

  function handleReveal() {
    if (filePath) {
      revealItemInDir(filePath).catch(() => {
        showToast('Could not open file location', 'warning')
      })
    }
  }

  function handleSendToCreate() {
    navigate('/create', { state: { initialPrompt: prompt } })
  }

  if (generating) {
    return (
      <div className="my-2 max-w-sm w-full">
        <ImageGenerationHud isInline />
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-2 max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs">
        <div className="flex items-center gap-2 font-semibold text-red-500 mb-1">
          <ImagePlus size={16} />
          <span>Image Generation Notice</span>
        </div>
        <p className="text-[var(--text)]/80 leading-relaxed">{error}</p>
        {onRegenerate && (
          <Button
            variant="secondary"
            className="mt-3 text-xs"
            onClick={onRegenerate}
          >
            <RefreshCw size={12} className="mr-1.5" />
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (!dataUrl) {
    return null
  }

  return (
    <div className="my-2.5 max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-[var(--shadow-card)]">
      {/* Image Preview Box */}
      <div className="group relative aspect-square w-full bg-[var(--surface-muted)] overflow-hidden flex items-center justify-center">
        <img
          src={dataUrl}
          alt={prompt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
        />

        {/* Hover Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2.5 p-4">
          <button
            type="button"
            onClick={() => setFullscreenOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md shadow-md transition-all active:scale-95"
            title="View Fullscreen"
          >
            <Expand size={16} />
          </button>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md shadow-md transition-all active:scale-95"
            title="Copy Prompt"
          >
            <Copy size={16} />
          </button>
          {filePath && (
            <button
              type="button"
              onClick={handleReveal}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md shadow-md transition-all active:scale-95"
              title="Reveal in Folder"
            >
              <Download size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSendToCreate}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md shadow-md transition-all active:scale-95"
            title="Open in Create Studio"
          >
            <ExternalLink size={16} />
          </button>
        </div>

        {/* AI Badge pill */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-white shadow-xs pointer-events-none">
          <Sparkles size={11} className="text-[var(--accent)]" />
          <span>Local Image Model</span>
        </div>
      </div>

      {/* Info Bar */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-[var(--text)] font-medium line-clamp-2 leading-snug">
            {prompt}
          </p>
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border)]/40 pt-2 text-[10px] text-[var(--muted)]">
          <span>512×512 PNG</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="hover:text-[var(--text)] transition-colors"
            >
              Copy prompt
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={handleSendToCreate}
              className="hover:text-[var(--text)] transition-colors text-[var(--accent)]"
            >
              Open Studio
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Dialog */}
      {fullscreenOpen && (
        <Dialog
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          title="Artwork Preview"
        >
          <div className="space-y-3">
            <div className="max-h-[70vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center">
              <img
                src={dataUrl}
                alt={prompt}
                className="max-h-[68vh] w-auto object-contain rounded-xl"
              />
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--text)]">
              <span className="block font-semibold text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                Prompt
              </span>
              {prompt}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={handleCopyPrompt}>
                <Copy size={13} className="mr-1.5" />
                Copy Prompt
              </Button>
              {filePath && (
                <Button variant="secondary" onClick={handleReveal}>
                  <Download size={13} className="mr-1.5" />
                  Reveal File
                </Button>
              )}
              <Button onClick={() => setFullscreenOpen(false)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
