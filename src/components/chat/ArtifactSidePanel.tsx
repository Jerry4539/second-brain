import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Code2,
  Copy,
  Download,
  Edit3,
  Eye,
  GripVertical,
  Layers,
  Maximize2,
  Minimize2,
  Table as TableIcon,
  WrapText,
  X,
} from 'lucide-react'
import type { ArtifactPayload } from './MarkdownContent'
import { highlightCodeLine, MarkdownContent } from './MarkdownContent'

interface ArtifactSidePanelProps {
  artifact: ArtifactPayload
  onClose: () => void
}

export function ArtifactSidePanel({ artifact, onClose }: ArtifactSidePanelProps) {
  const canPreview =
    artifact.kind === 'html' ||
    artifact.kind === 'svg' ||
    artifact.kind === 'table' ||
    artifact.kind === 'markdown'

  const [tab, setTab] = useState<'preview' | 'code'>(canPreview ? 'preview' : 'code')
  const [editableContent, setEditableContent] = useState(artifact.content)
  const [isEditingSource, setIsEditingSource] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wrapLines, setWrapLines] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [panelWidth, setPanelWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(580, Math.round(window.innerWidth * 0.46)) : 520,
  )
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startX: number; startWidth: number }>({
    startX: 0,
    startWidth: 520,
  })

  // Keep active tab and editable content synced when switching artifacts
  useEffect(() => {
    setTab(canPreview ? 'preview' : 'code')
    setEditableContent(artifact.content)
    setIsEditingSource(false)
  }, [artifact.id, artifact.content, canPreview])

  useEffect(() => {
    if (!isDragging) return

    function handleMouseMove(e: MouseEvent) {
      const deltaX = dragStartRef.current.startX - e.clientX
      const minW = 320
      const maxW = Math.round(window.innerWidth * 0.82)
      const nextWidth = Math.max(minW, Math.min(maxW, dragStartRef.current.startWidth + deltaX))
      setPanelWidth(nextWidth)
      if (isMaximized) setIsMaximized(false)
    }

    function handleMouseUp() {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, isMaximized])

  function handleStartResize(e: React.MouseEvent) {
    e.preventDefault()
    dragStartRef.current = {
      startX: e.clientX,
      startWidth: isMaximized ? Math.round(window.innerWidth * 0.72) : panelWidth,
    }
    setIsDragging(true)
  }

  function handleCopy() {
    const textToCopy =
      artifact.kind === 'table' && artifact.tableData
        ? [
            artifact.tableData.headers.join('\t'),
            ...artifact.tableData.rows.map((r) => r.join('\t')),
          ].join('\n')
        : editableContent
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    let ext = artifact.language || 'txt'
    let content = editableContent
    if (artifact.kind === 'html') ext = 'html'
    else if (artifact.kind === 'svg') ext = 'svg'
    else if (artifact.kind === 'markdown') ext = 'md'
    else if (artifact.kind === 'table' && artifact.tableData) {
      ext = 'csv'
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
      content = [
        artifact.tableData.headers.map(esc).join(','),
        ...artifact.tableData.rows.map((r) => r.map(esc).join(',')),
      ].join('\n')
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const lines = editableContent ? editableContent.split('\n') : []
  const effectiveStyleWidth = isMaximized ? '72vw' : `${panelWidth}px`

  return (
    <aside
      style={{ width: effectiveStyleWidth }}
      className="relative flex h-full max-w-[85vw] min-w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
    >
      {/* Interactive Drag-to-Resize Splitter Handle on Left Edge */}
      <div
        onMouseDown={handleStartResize}
        onDoubleClick={() => {
          setIsMaximized(false)
          setPanelWidth(Math.min(560, Math.round(window.innerWidth * 0.48)))
        }}
        title="Drag left or right to resize Canvas (Double-click to reset)"
        className={`group/resizer absolute top-0 bottom-0 left-0 z-30 flex w-2.5 cursor-col-resize items-center justify-center transition-colors ${
          isDragging ? 'bg-[var(--accent)]/30' : 'hover:bg-[var(--accent)]/20'
        }`}
      >
        <div
          className={`flex h-9 w-1.5 items-center justify-center rounded-full transition-all ${
            isDragging
              ? 'bg-[var(--accent)] scale-y-125'
              : 'bg-[var(--border)] group-hover/resizer:bg-[var(--accent)]'
          }`}
        >
          <GripVertical
            size={10}
            className="text-transparent group-hover/resizer:text-white/90"
          />
        </div>
      </div>

      {/* Artifact Header */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-elevated)]/60 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
            {artifact.kind === 'table' ? <TableIcon size={14} /> : <Layers size={14} />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-[var(--text)]">
              {artifact.title}
            </div>
            <div className="text-[10px] text-[var(--muted)] uppercase">
              {artifact.language ? `${artifact.language} • ` : ''}
              {artifact.kind} Artifact
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canPreview && (
            <div className="mr-1 flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tab === 'preview'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Eye size={11} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('code')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tab === 'code'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Code2 size={11} />
                <span>Source</span>
              </button>
            </div>
          )}

          {tab === 'code' && (
            <>
              <button
                type="button"
                onClick={() => setIsEditingSource((v) => !v)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                  isEditingSource
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                title={isEditingSource ? 'View syntax-highlighted source' : 'Edit source in Canvas'}
              >
                <Edit3 size={12} />
              </button>

              <button
                type="button"
                onClick={() => setWrapLines((v) => !v)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                  wrapLines
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                title={wrapLines ? 'Disable line wrapping' : 'Wrap long lines'}
              >
                <WrapText size={12} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex h-7 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            title="Copy artifact"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex h-7 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            title="Download artifact"
          >
            <Download size={12} />
          </button>

          <button
            type="button"
            onClick={() => setIsMaximized((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            title={isMaximized ? 'Restore split width' : 'Expand Canvas width'}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
            title="Close Artifact Canvas"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Artifact Body */}
      <div className={`min-h-0 flex-1 overflow-auto ${isDragging ? 'pointer-events-none select-none' : ''}`}>
        {tab === 'preview' ? (
          artifact.kind === 'html' || artifact.kind === 'svg' ? (
            <iframe
              title={artifact.title}
              sandbox="allow-scripts"
              srcDoc={
                artifact.kind === 'svg'
                  ? `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#111114;color:#fff;">${editableContent}</body></html>`
                  : editableContent
              }
              className="h-full w-full border-0 bg-white dark:bg-[#111114]"
            />
          ) : artifact.kind === 'table' && artifact.tableData ? (
            <div className="p-4">
              <MarkdownContent
                content={[
                  `| ${artifact.tableData.headers.join(' | ')} |`,
                  `| ${artifact.tableData.headers.map(() => '---').join(' | ')} |`,
                  ...artifact.tableData.rows.map((r) => `| ${r.join(' | ')} |`),
                ].join('\n')}
              />
            </div>
          ) : (
            <div className="p-5">
              <MarkdownContent content={editableContent} />
            </div>
          )
        ) : isEditingSource ? (
          <div className="flex h-full min-h-full flex-col bg-[#18181c] p-4">
            <textarea
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              spellCheck={false}
              className="min-h-[420px] w-full flex-1 resize-none bg-transparent font-mono text-[13px] leading-6 text-zinc-100 focus:outline-none selection:bg-[var(--accent)]/30"
            />
          </div>
        ) : (
          <div className="min-h-full bg-[#18181c] px-4 py-4 font-mono text-[13px] leading-6 text-zinc-100 selection:bg-[var(--accent)]/30">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.03]">
                    <td className="w-8 select-none pr-3.5 align-top text-right text-[11px] text-zinc-500">
                      {idx + 1}
                    </td>
                    <td
                      className={
                        wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                      }
                    >
                      {highlightCodeLine(line, artifact.language || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </aside>
  )
}

