import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  Check,
  Copy,
  Download,
  Expand,
  ExternalLink,
  ImagePlus,
  RefreshCw,
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
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  function handleCopyPrompt(e?: React.MouseEvent) {
    e?.stopPropagation()
    navigator.clipboard.writeText(prompt)
    setCopiedPrompt(true)
    showToast('Prompt copied', 'success')
    setTimeout(() => setCopiedPrompt(false), 1800)
  }

  function handleReveal(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (filePath) {
      revealItemInDir(filePath).catch(() => {
        showToast('Could not open file location', 'warning')
      })
    }
  }

  function handleSendToCreate(e?: React.MouseEvent) {
    e?.stopPropagation()
    navigate('/create', { state: { initialPrompt: prompt } })
  }

  if (generating) {
    return (
      <div className="my-1 w-full max-w-[320px]">
        <ImageGenerationHud isInline />
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-2 max-w-sm rounded-2xl border border-red-500/25 bg-red-500/8 p-3.5 text-xs">
        <div className="mb-1 flex items-center gap-2 font-semibold text-red-400">
          <ImagePlus size={15} />
          <span>Could not generate image</span>
        </div>
        <p className="leading-relaxed text-[var(--text)]/80">{error}</p>
        {onRegenerate && (
          <Button
            variant="secondary"
            className="mt-2.5 h-7 px-2.5 text-xs"
            onClick={onRegenerate}
          >
            <RefreshCw size={11} className="mr-1.5" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  if (!dataUrl) {
    return null
  }

  return (
    <div className="my-1.5 w-full max-w-[340px]">
      {/* Minimal Edge-to-Edge Artwork Frame */}
      <div
        onClick={() => setFullscreenOpen(true)}
        role="button"
        tabIndex={0}
        className="group relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-elevated)]/30 shadow-sm transition-all duration-200 hover:border-[var(--border)]"
      >
        <img
          src={dataUrl}
          alt={prompt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
        />

        {/* Sleek Floating Pill Toolbar on Hover */}
        <div className="
          absolute bottom-3 right-3 flex items-center gap-1 rounded-full
          border border-white/15 bg-black/65 px-2 py-1 text-white
          opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200
          group-hover:opacity-100
        ">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFullscreenOpen(true)
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
            title="Expand image"
          >
            <Expand size={13} />
          </button>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
            title="Copy prompt"
          >
            {copiedPrompt ? (
              <Check size={13} className="text-emerald-400" />
            ) : (
              <Copy size={13} />
            )}
          </button>
          {filePath && (
            <button
              type="button"
              onClick={handleReveal}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              title="Reveal file on disk"
            >
              <Download size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSendToCreate}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
            title="Open in Create Studio"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* Fullscreen Lightbox Dialog */}
      {fullscreenOpen && (
        <Dialog
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          title="Generated Image"
        >
          <div className="space-y-3">
            <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl bg-black">
              <img
                src={dataUrl}
                alt={prompt}
                className="max-h-[68vh] w-auto rounded-xl object-contain"
              />
            </div>
            <div className="rounded-xl bg-[var(--surface-elevated)]/60 p-3 text-xs leading-relaxed text-[var(--text)]/90">
              {prompt}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => handleCopyPrompt()}>
                <Copy size={13} className="mr-1.5" />
                Copy Prompt
              </Button>
              {filePath && (
                <Button variant="secondary" onClick={() => handleReveal()}>
                  <Download size={13} className="mr-1.5" />
                  Save / Reveal
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
