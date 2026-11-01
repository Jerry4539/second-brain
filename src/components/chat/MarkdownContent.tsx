import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

interface MarkdownContentProps {
  content: string
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[#18181b] text-zinc-100 shadow-md">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#202024] px-4 py-1.5 text-xs text-zinc-400">
        <span className="font-mono lowercase">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors hover:bg-zinc-700 hover:text-zinc-100"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInlineFormatting(text: string): ReactNode[] {
  // Parses inline code `...`, bold/italic ***...***, bold **...**, and italic *...*
  const parts: ReactNode[] = []
  const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_([^_]+)_)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-xs text-[var(--accent)] font-medium"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('***') && token.endsWith('***')) {
      parts.push(
        <strong key={match.index} className="font-bold italic text-[var(--text)]">
          {token.slice(3, -3)}
        </strong>
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-[var(--text)]">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      parts.push(
        <em key={match.index} className="italic text-[var(--text)]/90">
          {token.slice(1, -1)}
        </em>
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  if (!content) return null

  // Split into code blocks vs regular text
  const tokens: ReactNode[] = []
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const regularText = content.slice(lastIndex, match.index)
      tokens.push(renderTextBlocks(regularText, lastIndex))
    }

    const language = match[1].trim()
    const code = match[2].trimEnd()
    tokens.push(<CodeBlock key={`cb-${match.index}`} language={language} code={code} />)

    lastIndex = codeBlockRegex.lastIndex
  }

  if (lastIndex < content.length) {
    const regularText = content.slice(lastIndex)
    tokens.push(renderTextBlocks(regularText, lastIndex))
  }

  return <div className="space-y-2 text-sm leading-relaxed">{tokens}</div>
}

function renderTextBlocks(raw: string, keyOffset: number): ReactNode {
  const paragraphs = raw.split(/\n\s*\n/)

  return (
    <div key={`block-${keyOffset}`} className="space-y-3">
      {paragraphs.map((p, pIndex) => {
        const trimmed = p.trim()
        if (!trimmed) return null

        // Heading 1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={pIndex} className="mt-4 mb-2 text-lg font-bold text-[var(--text)]">
              {renderInlineFormatting(trimmed.slice(2))}
            </h1>
          )
        }
        // Heading 2
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={pIndex} className="mt-3 mb-1.5 text-base font-semibold text-[var(--text)]">
              {renderInlineFormatting(trimmed.slice(3))}
            </h2>
          )
        }
        // Heading 3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={pIndex} className="mt-2 mb-1 text-sm font-semibold text-[var(--text)]">
              {renderInlineFormatting(trimmed.slice(4))}
            </h3>
          )
        }
        // Blockquote
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={pIndex}
              className="my-2 border-l-4 border-[var(--accent)]/50 bg-[var(--surface)]/50 py-1 pl-3.5 pr-2 italic text-[var(--muted)] rounded-r-lg"
            >
              {renderInlineFormatting(trimmed.slice(2))}
            </blockquote>
          )
        }
        // Bullet list
        if (trimmed.split('\n').every((line) => line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
          const items = trimmed.split('\n').map((line) => line.trim().replace(/^[-*]\s+/, ''))
          return (
            <ul key={pIndex} className="my-2 ml-5 list-disc space-y-1 text-[var(--text)]">
              {items.map((item, i) => (
                <li key={i}>{renderInlineFormatting(item)}</li>
              ))}
            </ul>
          )
        }
        // Numbered list
        if (trimmed.split('\n').every((line) => /^\d+\.\s+/.test(line.trim()))) {
          const items = trimmed.split('\n').map((line) => line.trim().replace(/^\d+\.\s+/, ''))
          return (
            <ol key={pIndex} className="my-2 ml-5 list-decimal space-y-1 text-[var(--text)]">
              {items.map((item, i) => (
                <li key={i}>{renderInlineFormatting(item)}</li>
              ))}
            </ol>
          )
        }

        // Regular paragraph with single line breaks handled as <br />
        const lines = trimmed.split('\n')
        return (
          <p key={pIndex} className="leading-relaxed text-[var(--text)]">
            {lines.map((line, lIndex) => (
              <span key={lIndex}>
                {renderInlineFormatting(line)}
                {lIndex < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
