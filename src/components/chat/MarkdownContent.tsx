import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  Check,
  Code2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Info,
  Lightbulb,
  Maximize2,
  Play,
  Sparkles,
  Table as TableIcon,
  WrapText,
} from 'lucide-react'

export interface ArtifactPayload {
  id: string
  title: string
  kind: 'html' | 'svg' | 'code' | 'table' | 'markdown'
  language?: string
  content: string
  tableData?: { headers: string[]; rows: string[][] }
}

interface MarkdownContentProps {
  content: string
  onOpenArtifact?: (artifact: ArtifactPayload) => void
}

const EXT_MAP: Record<string, string> = {
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  tsx: 'tsx',
  jsx: 'jsx',
  python: 'py',
  py: 'py',
  java: 'java',
  kotlin: 'kt',
  kt: 'kt',
  swift: 'swift',
  csharp: 'cs',
  cs: 'cs',
  rust: 'rs',
  rs: 'rs',
  html: 'html',
  svg: 'svg',
  css: 'css',
  json: 'json',
  sql: 'sql',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  markdown: 'md',
  md: 'md',
  yaml: 'yml',
  yml: 'yml',
  go: 'go',
  cpp: 'cpp',
  c: 'c',
  php: 'php',
  ruby: 'rb',
  rb: 'rb',
  dart: 'dart',
}

const LANG_DISPLAY_MAP: Record<string, string> = {
  '': 'Plain text',
  text: 'Plain text',
  plaintext: 'Plain text',
  plain: 'Plain text',
  prompt: 'Plain text',
  template: 'Plain text',
  markdown: 'Markdown',
  md: 'Markdown',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  swift: 'Swift',
  cs: 'C#',
  csharp: 'C#',
  rs: 'Rust',
  rust: 'Rust',
  html: 'HTML',
  svg: 'SVG',
  css: 'CSS',
  json: 'JSON',
  sql: 'SQL',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  yaml: 'YAML',
  yml: 'YAML',
  go: 'Go',
  cpp: 'C++',
  c: 'C',
  php: 'PHP',
  ruby: 'Ruby',
  rb: 'Ruby',
  dart: 'Dart',
}

const CODE_KEYWORDS = new Set([
  'import', 'package', 'from', 'export', 'default', 'as', 'public', 'private', 'protected',
  'internal', 'class', 'interface', 'enum', 'struct', 'impl', 'trait', 'type', 'namespace',
  'module', 'extends', 'implements', 'static', 'final', 'readonly', 'abstract', 'synchronized',
  'volatile', 'const', 'let', 'var', 'val', 'function', 'def', 'fn', 'func', 'pub', 'async',
  'await', 'return', 'yield', 'if', 'else', 'elif', 'for', 'while', 'do', 'loop', 'switch',
  'case', 'match', 'break', 'continue', 'try', 'catch', 'except', 'finally', 'throw', 'throws',
  'raise', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'where', 'select', 'insert',
  'into', 'values', 'update', 'set', 'join', 'inner', 'left', 'right', 'on', 'group', 'order',
  'by', 'having', 'limit', 'offset', 'distinct', 'create', 'table', 'drop', 'alter', 'with',
  'pass', 'lambda', 'global', 'nonlocal', 'assert', 'defer', 'go', 'chan', 'mut', 'ref', 'move',
])

const CODE_TYPES_AND_BUILTINS = new Set([
  'void', 'int', 'long', 'short', 'byte', 'float', 'double', 'boolean', 'bool', 'char', 'string',
  'str', 'number', 'bigint', 'symbol', 'any', 'unknown', 'never', 'object', 'usize', 'isize',
  'i8', 'i16', 'i32', 'i64', 'i128', 'u8', 'u16', 'u32', 'u64', 'u128', 'f32', 'f64',
  'String', 'System', 'Math', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character',
  'Object', 'Class', 'Thread', 'Runnable', 'Exception', 'RuntimeException', 'Throwable',
  'Array', 'List', 'ArrayList', 'LinkedList', 'Map', 'HashMap', 'TreeMap', 'Set', 'HashSet',
  'Optional', 'Stream', 'Collectors', 'Arrays', 'Collections', 'Scanner', 'StringBuilder',
  'Console', 'Promise', 'Date', 'RegExp', 'Error', 'JSON', 'Window', 'Document', 'HTMLElement',
  'React', 'Vec', 'Option', 'Result', 'Some', 'Ok', 'Err', 'Box', 'Rc', 'Arc', 'HashMap',
  'dict', 'list', 'tuple', 'set', 'frozenset', 'range', 'len', 'print', 'enumerate', 'zip',
])

const CODE_LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil', 'NaN', 'Infinity',
  'this', 'self', 'super', 'cls', 'out', 'err',
])

/**
 * Multi-language syntax highlighter for code lines (Java, JS/TS, Python, Rust, C/C++, Go, HTML, SQL, etc.)
 */
export function highlightCodeLine(line: string, language = ''): ReactNode {
  if (!line) return ' '
  const lang = language.trim().toLowerCase()
  const isHashCommentLang = [
    'py', 'python', 'sh', 'bash', 'shell', 'zsh', 'yaml', 'yml', 'rb', 'ruby', 'r', 'perl', 'dockerfile', 'toml',
  ].includes(lang)

  const tokenRegex = new RegExp(
    [
      // 1. Comments: //..., /*...*/, <!--...-->, --... (SQL), or #... (Python/Bash/YAML)
      isHashCommentLang
        ? '(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/|#.*$)'
        : '(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/|<!--.*-->|--\\s.*$)',
      // 2. Strings: "...", '...', `...`
      '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)',
      // 3. Annotations / Decorators: @Override, @Component
      '(@[a-zA-Z_]\\w*)',
      // 4. HTML / JSX Tags: <div, </div, />
      '(<\\/?[a-zA-Z][a-zA-Z0-9:-]*|\\/>)',
      // 5. Numbers: hex, binary, floats, ints
      '(\\b(?:0x[0-9a-fA-F]+|0b[01]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[fFdDlL]?)\\b)',
      // 6. Identifiers / Keywords / Types / Method Calls
      '(\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)',
      // 7. Operators & Punctuation
      '([{}()[\\].,:;+\\-*/%=<>!&|^~?]+)',
    ].join('|'),
    'g',
  )

  const parts: ReactNode[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      parts.push(line.slice(lastIdx, match.index))
    }

    const full = match[0]
    const [, comment, str, annotation, htmlTag, num, ident, punct] = match

    if (comment !== undefined) {
      parts.push(
        <span key={match.index} className="italic text-zinc-500">
          {full}
        </span>,
      )
    } else if (str !== undefined) {
      parts.push(
        <span key={match.index} className="text-emerald-400">
          {full}
        </span>,
      )
    } else if (annotation !== undefined) {
      parts.push(
        <span key={match.index} className="font-medium text-amber-300">
          {full}
        </span>,
      )
    } else if (htmlTag !== undefined) {
      parts.push(
        <span key={match.index} className="text-rose-400">
          {full}
        </span>,
      )
    } else if (num !== undefined) {
      parts.push(
        <span key={match.index} className="text-amber-300">
          {full}
        </span>,
      )
    } else if (ident !== undefined) {
      const afterText = line.slice(tokenRegex.lastIndex)
      const isFollowedByParen = /^\s*\(/.test(afterText)

      if (CODE_KEYWORDS.has(ident) || (lang === 'sql' && CODE_KEYWORDS.has(ident.toLowerCase()))) {
        parts.push(
          <span key={match.index} className="font-medium text-purple-400">
            {full}
          </span>,
        )
      } else if (CODE_LITERALS.has(ident)) {
        parts.push(
          <span key={match.index} className="font-medium text-orange-400">
            {full}
          </span>,
        )
      } else if (CODE_TYPES_AND_BUILTINS.has(ident)) {
        parts.push(
          <span key={match.index} className="text-sky-400">
            {full}
          </span>,
        )
      } else if (isFollowedByParen) {
        parts.push(
          <span key={match.index} className="text-blue-400">
            {full}
          </span>,
        )
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(ident)) {
        parts.push(
          <span key={match.index} className="text-sky-300">
            {full}
          </span>,
        )
      } else {
        parts.push(
          <span key={match.index} className="text-zinc-100">
            {full}
          </span>,
        )
      }
    } else if (punct !== undefined) {
      parts.push(
        <span key={match.index} className="text-zinc-400">
          {full}
        </span>,
      )
    } else {
      parts.push(full)
    }

    lastIdx = tokenRegex.lastIndex
  }

  if (lastIdx < line.length) {
    parts.push(line.slice(lastIdx))
  }

  return parts
}

interface ParsedEmailDraft {
  subject: string
  recipient: string
  body: string
}

/**
 * General-purpose semantic parser that extracts Subject, Recipient, and Body
 * from any email or letter draft without hardcoded topic rules.
 */
function parseEmailDraft(raw: string, forceEmail = false): ParsedEmailDraft | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const hasSalutation =
    /^(?:Subject:|To:|Recipients?:|Dear\s+|Hi\s+[A-Z]|Hello\s+[A-Z]|Respected\s+)/im.test(trimmed)
  const hasSignOff =
    /(?:^|\n)\s*(?:Regards|Best regards|Kind regards|Warm regards|Sincerely|Thank you|Thanks|Yours truly|Yours sincerely)[,!]?\s*(?:\n|$)/i.test(
      trimmed,
    )

  if (!forceEmail && (!hasSalutation || !hasSignOff)) {
    return null
  }

  const lines = trimmed.split('\n')
  let subject = ''
  let recipient = ''
  const bodyLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const subjMatch = line.match(/^(?:\*\*)?Subject(?:\*\*)?:\s*(.+)$/i)
    if (subjMatch && !subject && bodyLines.length === 0) {
      subject = subjMatch[1].replace(/^\*\*|\*\*$/g, '').trim()
      continue
    }
    const toMatch = line.match(/^(?:\*\*)?(?:To|Recipients?)(?:\*\*)?:\s*(.+)$/i)
    if (toMatch && !recipient && bodyLines.length === 0) {
      recipient = toMatch[1].replace(/^\*\*|\*\*$/g, '').trim()
      continue
    }
    bodyLines.push(lines[i])
  }

  const body = bodyLines
    .join('\n')
    .replace(/I hope this (?:email|message) finds you (?:well|in good spirits)[^.\n]*\./gi, 'I hope you are doing well.')
    .replace(/Dear\s+\[[^\]]+\],/gi, 'Dear Sir,')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!subject) {
    // Derive a clean subject line dynamically from the first meaningful sentence after the greeting
    const contentLine = bodyLines
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length > 12 &&
          !/^(?:Dear|Hi|Hello|Respected|I hope you are doing well|I hope this)/i.test(l),
      )
    if (contentLine) {
      const extracted = contentLine
        .replace(
          /^(?:I am writing to|I would like to kindly|I would like to|I'm reaching out to|Please accept this as)\s+/i,
          '',
        )
        .split(/[.,;!?]/)[0]
        .trim()
      const words = extracted.split(/\s+/).slice(0, 6)
      subject =
        words.length > 0
          ? words
              .map((w, idx) => (idx === 0 || w.length > 3 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
              .join(' ')
          : 'Message Draft'
    } else {
      subject = 'Message Draft'
    }
  }

  return { subject, recipient, body }
}

function EmailDraftCard({
  initialDraft,
  onOpenArtifact,
}: {
  initialDraft: ParsedEmailDraft
  onOpenArtifact?: (artifact: ArtifactPayload) => void
}) {
  const [subject, setSubject] = useState(initialDraft.subject)
  const [recipient, setRecipient] = useState(initialDraft.recipient)
  const [body, setBody] = useState(initialDraft.body)
  const [copied, setCopied] = useState(false)

  // Keep synced while tokens stream in
  useMemo(() => {
    setSubject(initialDraft.subject)
    setBody(initialDraft.body)
  }, [initialDraft.subject, initialDraft.body])

  function handleCopy() {
    const fullEmail = `Subject: ${subject}\n\n${body}`
    navigator.clipboard.writeText(fullEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleOpenMailClient() {
    const mailto = `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`
    window.open(mailto, '_blank')
  }

  const lineCount = Math.max(6, body.split('\n').length)

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-[#27272b] text-zinc-100 shadow-lg">
      {/* Minimal Header Bar: Subject Title + Copy / Canvas / Open in Mail Pill */}
      <div className="flex items-center justify-between gap-2 px-5 pt-3.5 pb-2.5">
        <div className="truncate text-[13px] font-medium text-zinc-300">{subject}</div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
            title="Copy draft"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          {onOpenArtifact && (
            <button
              type="button"
              onClick={() =>
                onOpenArtifact({
                  id: `email-${Date.now()}`,
                  title: subject,
                  kind: 'markdown',
                  content: `### ${subject}\n\n${body}`,
                })
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              title="Open in side Canvas"
            >
              <ExternalLink size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenMailClient}
            className="ml-1 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/[0.12]"
            title="Open in your default Mail app"
          >
            Open in Mail
          </button>
        </div>
      </div>

      {/* Directly Editable Recipients Row */}
      <div className="border-t border-b border-white/[0.08] px-5 py-2.5">
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Recipients"
          className="w-full bg-transparent text-[14px] text-zinc-200 placeholder-zinc-400 focus:outline-none"
        />
      </div>

      {/* Directly Editable Subject Row */}
      <div className="border-b border-white/[0.08] px-5 py-2.5">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full bg-transparent text-[15px] font-medium text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />
      </div>

      {/* Directly Editable Body Area (Click any word to write or edit naturally in-place) */}
      <div className="px-5 py-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={lineCount}
          spellCheck={true}
          className="w-full resize-none bg-transparent font-sans text-[15px] leading-7 text-zinc-100 focus:outline-none"
        />
      </div>
    </div>
  )
}

function CodeBlock({
  code,
  language,
  title,
  onOpenArtifact,
}: {
  code: string
  language: string
  title?: string
  onOpenArtifact?: (artifact: ArtifactPayload) => void
}) {
  const [copied, setCopied] = useState(false)
  const [editableCode, setEditableCode] = useState(code)
  const [isEditingCode, setIsEditingCode] = useState(false)

  useMemo(() => {
    setEditableCode(code)
  }, [code])

  const lines = editableCode.split('\n')
  const langLower = language.trim().toLowerCase()
  const isEmailTag = ['email', 'mail', 'letter'].includes(langLower)
  const isExplicitPlainText = [
    'text',
    'plaintext',
    'plain',
    'prompt',
    'template',
    'markdown',
    'md',
    'quote',
  ].includes(langLower)
  const parsedEmail = useMemo(
    () =>
      isEmailTag || !langLower || isExplicitPlainText
        ? parseEmailDraft(code, isEmailTag)
        : null,
    [code, isEmailTag, langLower, isExplicitPlainText],
  )
  const looksLikeCode =
    !isExplicitPlainText &&
    !isEmailTag &&
    (Boolean(langLower) ||
      /(?:^\s*(?:import|package|public|private|class|function|const|let|var|def|fn|#include|SELECT)\b|[{}();]{2,})/m.test(
        code,
      ))
  const isPlainTextOrPrompt = !looksLikeCode
  const [wrapLines, setWrapLines] = useState(isPlainTextOrPrompt)
  const isPreviewable = langLower === 'html' || langLower === 'svg'
  const baseLabel =
    LANG_DISPLAY_MAP[langLower] ||
    (langLower
      ? langLower.charAt(0).toUpperCase() + langLower.slice(1)
      : looksLikeCode
      ? 'Code'
      : 'Plain text')
  const headerLabel = title ? `${baseLabel} · ${title}` : baseLabel

  if (parsedEmail) {
    return <EmailDraftCard initialDraft={parsedEmail} onOpenArtifact={onOpenArtifact} />
  }

  function handleCopy() {
    navigator.clipboard.writeText(editableCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const ext = EXT_MAP[langLower] || 'txt'
    const blob = new Blob([editableCode], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snippet-${Date.now().toString().slice(-5)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleOpenCanvas() {
    if (!onOpenArtifact) return
    onOpenArtifact({
      id: `artifact-${Date.now()}`,
      title:
        title ||
        (isPreviewable
          ? `Interactive ${langLower.toUpperCase()} Preview`
          : `${headerLabel} Artifact (${lines.length} lines)`),
      kind: langLower === 'html' ? 'html' : langLower === 'svg' ? 'svg' : 'code',
      language: language || 'text',
      content: editableCode,
    })
  }

  return (
    <div className="my-4 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#252529] text-zinc-100 shadow-md">
      {/* Minimal Header Bar (`</> Plain text` / `</> Java` + Edit / Wrap / Copy / Canvas icons) */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#2c2c31] px-4 py-2.5 text-xs text-zinc-300 min-w-0">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <Code2 size={14} className="shrink-0 text-zinc-400" />
          <span className="truncate font-sans text-[12.5px] font-medium tracking-tight text-zinc-200">
            {headerLabel}
          </span>
          {!isPlainTextOrPrompt && lines.length > 1 && (
            <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {lines.length} lines
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onOpenArtifact && (isPreviewable || lines.length >= 4) && (
            <button
              type="button"
              onClick={handleOpenCanvas}
              className="mr-1 flex items-center gap-1 rounded-lg bg-[var(--accent)]/15 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/25"
              title="Open in side-by-side Artifact Canvas"
            >
              {isPreviewable ? <Play size={11} /> : <Maximize2 size={11} />}
              <span>{isPreviewable ? 'Run Preview' : 'Canvas'}</span>
            </button>
          )}

          {!isPlainTextOrPrompt && (
            <button
              type="button"
              onClick={() => setIsEditingCode((v) => !v)}
              className={`flex items-center gap-1 rounded-lg p-1.5 transition-colors ${
                isEditingCode
                  ? 'bg-white/10 text-zinc-100'
                  : 'text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
              }`}
              title={isEditingCode ? 'View syntax-highlighted code' : 'Edit code in card'}
            >
              <Edit3 size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setWrapLines((v) => !v)}
            className={`flex items-center gap-1 rounded-lg p-1.5 transition-colors ${
              wrapLines
                ? 'bg-white/10 text-zinc-100'
                : 'text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
            }`}
            title={wrapLines ? 'Disable line wrapping' : 'Wrap lines'}
          >
            <WrapText size={14} />
          </button>

          {!isPlainTextOrPrompt && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-zinc-100"
              title="Download file"
            >
              <Download size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body: Directly Editable Plain-Text / Prompt Card OR Syntax-Highlighted / Editable Code */}
      {isPlainTextOrPrompt || isEditingCode ? (
        <div className="w-full min-w-0 max-w-full px-5 py-4">
          <textarea
            value={editableCode}
            onChange={(e) => setEditableCode(e.target.value)}
            rows={Math.min(18, Math.max(3, lines.length))}
            spellCheck={isPlainTextOrPrompt}
            className="w-full max-w-full min-w-0 resize-y bg-transparent font-mono text-[13.5px] leading-7 text-zinc-100 focus:outline-none selection:bg-[var(--accent)]/30"
          />
        </div>
      ) : (
        <div className="w-full min-w-0 max-w-full max-h-[440px] overflow-x-auto overflow-y-auto px-4 py-3.5 font-mono text-[13px] leading-6 text-zinc-100 selection:bg-[var(--accent)]/30 scrollbar-thin">
          <table className="w-full min-w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-white/[0.03]">
                  <td className="w-8 shrink-0 select-none pr-3.5 align-top text-right text-[11px] text-zinc-500">
                    {idx + 1}
                  </td>
                  <td
                    className={
                      wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                    }
                  >
                    {highlightCodeLine(line, langLower)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function extractNumericValue(cell: string): number | null {
  const cleaned = cell.replace(/[,$%]/g, '').trim()
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const val = Number(match[1])
  return Number.isFinite(val) ? val : null
}

function InteractiveTable({
  headers,
  bodyRows,
  onOpenArtifact,
}: {
  headers: string[]
  bodyRows: string[][]
  onOpenArtifact?: (artifact: ArtifactPayload) => void
}) {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [copied, setCopied] = useState(false)

  // Detect if any column (index >= 1) has numeric values for bar chart rendering
  const numericColumnIndex = useMemo(() => {
    for (let c = 1; c < headers.length; c++) {
      const numericCount = bodyRows.filter((r) => extractNumericValue(r[c] ?? '') !== null).length
      if (numericCount >= Math.max(1, Math.ceil(bodyRows.length * 0.6))) {
        return c
      }
    }
    return -1
  }, [headers, bodyRows])

  const sortedRows = useMemo(() => {
    if (sortCol === null) return bodyRows
    return [...bodyRows].sort((a, b) => {
      const cellA = a[sortCol] ?? ''
      const cellB = b[sortCol] ?? ''
      const numA = extractNumericValue(cellA)
      const numB = extractNumericValue(cellB)
      if (numA !== null && numB !== null) {
        return sortAsc ? numA - numB : numB - numA
      }
      return sortAsc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA)
    })
  }, [bodyRows, sortCol, sortAsc])

  function handleSort(colIdx: number) {
    if (sortCol === colIdx) {
      setSortAsc((v) => !v)
    } else {
      setSortCol(colIdx)
      setSortAsc(true)
    }
  }

  function handleExportCsv() {
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`
    const csv = [
      headers.map(escapeCsv).join(','),
      ...sortedRows.map((r) => r.map(escapeCsv).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `table-data-${Date.now().toString().slice(-4)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCopyTable() {
    const tsv = [headers.join('\t'), ...sortedRows.map((r) => r.join('\t'))].join('\n')
    navigator.clipboard.writeText(tsv)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const maxChartVal = useMemo(() => {
    if (numericColumnIndex === -1) return 100
    const vals = sortedRows.map((r) => Math.abs(extractNumericValue(r[numericColumnIndex] ?? '') ?? 0))
    return Math.max(1, ...vals)
  }, [sortedRows, numericColumnIndex])

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
      {/* Interactive Table Header Bar (Only show toolbar when table has 2+ comparison rows) */}
      {bodyRows.length >= 2 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-elevated)]/70 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <TableIcon size={13} className="text-[var(--accent)]" />
            <span className="font-semibold text-[var(--text)]">Comparison Table</span>
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.2 text-[10px] font-medium text-[var(--muted)]">
              {bodyRows.length} items
            </span>
          </div>

          <div className="flex items-center gap-1">
            {numericColumnIndex !== -1 && (
              <button
                type="button"
                onClick={() => setViewMode((v) => (v === 'table' ? 'chart' : 'table'))}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
                title="Toggle visual bar chart"
              >
                <BarChart3 size={12} />
                <span>{viewMode === 'chart' ? 'Table View' : 'Chart View'}</span>
              </button>
            )}

            {onOpenArtifact && (
              <button
                type="button"
                onClick={() =>
                  onOpenArtifact({
                    id: `table-${Date.now()}`,
                    title: `${headers[0] || 'Data'} Comparison Table`,
                    kind: 'table',
                    content: '',
                    tableData: { headers, rows: sortedRows },
                  })
                }
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                title="Expand table in side Canvas"
              >
                <Maximize2 size={11} />
                <span>Canvas</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              title="Download as CSV"
            >
              <Download size={11} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTable}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'chart' && numericColumnIndex !== -1 ? (
        /* Visual Bar Chart Representation */
        <div className="space-y-2.5 p-4">
          <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">
            Visualizing <strong className="text-[var(--text)]">{headers[numericColumnIndex]}</strong> by{' '}
            <strong className="text-[var(--text)]">{headers[0]}</strong>
          </div>
          {sortedRows.map((row, idx) => {
            const label = row[0] ?? `Row ${idx + 1}`
            const rawVal = row[numericColumnIndex] ?? '0'
            const numVal = Math.abs(extractNumericValue(rawVal) ?? 0)
            const pct = Math.min(100, Math.max(4, Math.round((numVal / maxChartVal) * 100)))
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text)]">{label}</span>
                  <span className="font-mono text-[11px] font-semibold text-[var(--accent)]">
                    {rawVal}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Sortable Interactive Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/40 text-[var(--muted)]">
                {headers.map((h, i) => (
                  <th
                    key={i}
                    onClick={() => handleSort(i)}
                    className="cursor-pointer select-none px-3.5 py-2.5 font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-elevated)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{renderInlineFormatting(h)}</span>
                      <ArrowDownUp
                        size={11}
                        className={`shrink-0 ${
                          sortCol === i ? 'text-[var(--accent)] opacity-100' : 'opacity-35'
                        }`}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-[var(--border)]/50 last:border-0 transition-colors hover:bg-[var(--surface-elevated)]/40"
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-3.5 py-2.5 text-[var(--text)] ${
                        cIdx === 0 ? 'font-medium' : ''
                      }`}
                    >
                      {renderInlineFormatting(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function renderInlineFormatting(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex =
    /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_([^_]+)_|~~[^~]+~~|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g

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
          className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-xs font-medium text-[var(--accent)]"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('***') && token.endsWith('***')) {
      parts.push(
        <strong key={match.index} className="font-bold italic text-[var(--text)]">
          {token.slice(3, -3)}
        </strong>,
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-[var(--text)]">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push(
        <del key={match.index} className="text-[var(--muted)] line-through">
          {token.slice(2, -2)}
        </del>,
      )
    } else if (token.startsWith('[') && match[3] && match[4]) {
      parts.push(
        <a
          key={match.index}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--accent)] underline underline-offset-2 hover:opacity-80"
        >
          {match[3]}
        </a>,
      )
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      parts.push(
        <em key={match.index} className="italic text-[var(--text)]/90">
          {token.slice(1, -1)}
        </em>,
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

function renderCalloutBlock(rawQuote: string, key: number | string): ReactNode {
  const cleaned = rawQuote.trim()
  const lower = cleaned.toLowerCase()

  let variant: 'tip' | 'warning' | 'important' | 'info' = 'info'
  let badgeLabel = 'Key Note'
  let Icon = Info

  if (
    lower.startsWith('💡') ||
    lower.includes('pro tip') ||
    lower.includes('tip:') ||
    lower.includes('key takeaway')
  ) {
    variant = 'tip'
    badgeLabel = lower.includes('key takeaway') ? 'Key Takeaway' : 'Pro Tip'
    Icon = Lightbulb
  } else if (
    lower.startsWith('⚠️') ||
    lower.includes('security advisory') ||
    lower.includes('security alert') ||
    lower.includes('warning') ||
    lower.includes('caution')
  ) {
    variant = 'warning'
    badgeLabel = lower.includes('security') ? 'Security Advisory' : 'Warning'
    Icon = AlertTriangle
  } else if (
    lower.includes('important') ||
    lower.includes('attention') ||
    lower.includes('critical')
  ) {
    variant = 'important'
    badgeLabel = 'Important'
    Icon = Sparkles
  }

  const styleMap = {
    tip: 'border-amber-500/35 bg-amber-500/[0.07] text-[var(--text)]',
    warning: 'border-rose-500/35 bg-rose-500/[0.07] text-[var(--text)]',
    important: 'border-[var(--accent)]/40 bg-[var(--accent)]/[0.08] text-[var(--text)]',
    info: 'border-sky-500/35 bg-sky-500/[0.07] text-[var(--text)]',
  }

  const badgeColorMap = {
    tip: 'text-amber-400 bg-amber-500/15',
    warning: 'text-rose-400 bg-rose-500/15',
    important: 'text-[var(--accent)] bg-[var(--accent)]/15',
    info: 'text-sky-400 bg-sky-500/15',
  }

  // Strip redundant leading emoji/label if present so it doesn't repeat twice
  const bodyText = cleaned
    .replace(/^(?:💡|⚠️|ℹ️|🔥|✨)\s*/, '')
    .replace(/^(?:\*\*)?(?:Pro Tip|Tip|Warning|Caution|Important|Note|Key Takeaway|Security Advisory|Security Alert)(?:\*\*)?[:\s]+/i, '')

  const lines = bodyText.split('\n')

  return (
    <div
      key={key}
      className={`my-3.5 rounded-2xl border px-4 py-3.5 shadow-2xs ${styleMap[variant]}`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${badgeColorMap[variant]}`}
        >
          <Icon size={12} />
          <span>{badgeLabel}</span>
        </span>
      </div>
      <div className="text-[14.5px] leading-relaxed text-[var(--text)]/95">
        {lines.map((line, lIdx) => (
          <span key={lIdx}>
            {renderInlineFormatting(line)}
            {lIdx < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  )
}

function normalizeAllCapsParagraph(text: string): string {
  const letters = text.replace(/[^a-zA-Z]/g, '')
  if (letters.length < 25) return text
  const uppercaseLetters = text.replace(/[^A-Z]/g, '')
  if (uppercaseLetters.length / letters.length > 0.62) {
    const acronyms = new Set([
      'PHP', 'RCE', 'CVE', 'HTTP', 'HTTPS', 'SQL', 'HTML', 'CSS', 'JS', 'API',
      'REST', 'IP', 'DNS', 'URL', 'SSH', 'SSL', 'TLS', 'OS', 'RAM', 'CPU', 'GPU',
      'AI', 'LLM', 'GGUF', 'DDG', 'HN', 'TCP', 'UDP', 'JSON', 'XML', 'DoS', 'DDoS',
    ])
    return text
      .toLowerCase()
      .replace(/(^\s*|\.\s+|\n\s*|\?\s+|\!\s*)([a-z])/g, (_, prefix, ch) => prefix + ch.toUpperCase())
      .replace(/\b([a-z0-9_-]+)\b/gi, (match) => {
        const up = match.toUpperCase()
        if (acronyms.has(up)) return up
        return match
      })
  }
  return text
}

function parseFenceInfo(info: string): { language: string; title?: string } {
  const trimmed = info.trim()
  if (!trimmed) return { language: 'text' }

  // 1. Colon pattern: `css:style.css`
  const colonMatch = trimmed.match(/^([a-zA-Z0-9_+-]+):([^\n\r]+)$/)
  if (colonMatch) {
    return { language: colonMatch[1].toLowerCase(), title: colonMatch[2].trim() }
  }

  // 2. Parentheses, brackets, or comments: `css (Dark Mode)`, `css [theme]`, `css /* Dark Mode */`
  const parenMatch = trimmed.match(/^([a-zA-Z0-9_+-]+)\s*[\(\[\/\*]+([^\n\r\)\*\/]+)[\)\]\*\/]*$/)
  if (parenMatch) {
    return { language: parenMatch[1].toLowerCase(), title: parenMatch[2].trim() }
  }

  // 3. Space-separated title/filename: `html title="index.html"`, `css - Dark Mode`
  const spaceMatch = trimmed.match(/^([a-zA-Z0-9_+-]+)\s+(.+)$/)
  if (spaceMatch) {
    const rawTitle = spaceMatch[2].replace(/^(?:title=|-)\s*["']?|["']$/g, '').trim()
    return { language: spaceMatch[1].toLowerCase(), title: rawTitle || undefined }
  }

  return { language: trimmed.toLowerCase() }
}

function isPureCodeOrTags(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  // Pure HTML tags, voids, or comments (including </style>, </div>, </form>, </br></br>, <!-- ... -->)
  const isPureHtml = /^(?:<!--[\s\S]*?-->|<\/?[a-zA-Z0-9_-]+(?:\s+[^>]*)?>|\s*)+$/i.test(trimmed)
  if (isPureHtml) return true

  // Pure closing braces, brackets or CSS statements
  if (/^(?:[\s\}\);,]|(?:\/\*[\s\S]*?\*\/))+$/.test(trimmed)) return true

  // Raw CSS media block or style block fragments: e.g. / Dark Mode / \n @media ...
  if (/^[\s\S]*@media[^{]+\{[\s\S]*\}[\s\S]*$/m.test(trimmed) && /[{}:]/.test(trimmed)) {
    return true
  }

  return false
}

function detectUnfencedCode(paragraph: string): { isCode: boolean; language: string } {
  const trimmed = paragraph.trim()
  if (!trimmed) return { isCode: false, language: '' }

  // 0. Pure HTML tags (e.g. </style>, </div>, </form>, </br></br>) or pure tag sequences
  if (isPureCodeOrTags(trimmed)) {
    return { isCode: true, language: 'html' }
  }

  // 1. CSS / SCSS detection
  const hasMediaOrKeyframes = /@(?:media|keyframes|import|supports|font-face)\b/i.test(trimmed)
  const hasCssSelectorsWithBraces = /(?:^|\n)\s*(?:[.#a-zA-Z0-9:_-]+|\*|::-webkit-[a-z-]+|::-moz-[a-z-]+|@media[^{]+)\s*\{/m.test(trimmed)
  const hasCssProperties = /(?:[a-zA-Z_-]+|--[a-zA-Z0-9_-]+)\s*:\s*[^;{}]+[;}]/i.test(trimmed)
  const hasCssComment = /\/\*[\s\S]*?\*\//.test(trimmed)

  if (
    (hasMediaOrKeyframes && (hasCssProperties || hasCssSelectorsWithBraces)) ||
    (hasCssSelectorsWithBraces && hasCssProperties) ||
    (hasCssComment && (hasCssProperties || hasCssSelectorsWithBraces))
  ) {
    return { isCode: true, language: 'css' }
  }

  // 2. HTML / XML / SVG detection
  const hasHtmlDoctypeOrTags = /^<!DOCTYPE\s+html/i.test(trimmed) || /^<(?:html|head|body|div|style|script|svg|table|template|form|nav|header|footer)\b/i.test(trimmed)
  const hasClosingTags = /<\/[a-zA-Z0-9_-]+>/.test(trimmed)
  if (hasHtmlDoctypeOrTags || (hasClosingTags && /<[a-zA-Z0-9_-]+/.test(trimmed))) {
    return { isCode: true, language: 'html' }
  }

  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { isCode: false, language: '' }

  // 3. JavaScript / TypeScript detection
  const hasImportsOrExports = /^(?:import\s+.+from\s+['"]|export\s+(?:default\s+)?(?:const|let|var|function|class)\b)/m.test(trimmed)
  const hasJsDeclarations = /(?:const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed)
  const hasJsFunctions = /(?:function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(|\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/.test(trimmed)
  const hasJsApis = /(?:console\.(?:log|error|warn)|document\.(?:getElementById|querySelector|createElement)|window\.addEventListener)\b/.test(trimmed)

  if (
    (hasImportsOrExports || hasJsFunctions || hasJsDeclarations) &&
    (hasJsApis || lines.some((l) => l.endsWith(';') || l.endsWith('{') || l.endsWith('}')))
  ) {
    return { isCode: true, language: 'javascript' }
  }

  // 4. JSON detection
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return { isCode: true, language: 'json' }
    } catch {
      // not valid JSON
    }
  }

  // 5. Python detection
  const hasPyDefOrClass = /^(?:def\s+[a-zA-Z_]\w*\s*\(|class\s+[a-zA-Z_]\w*(?:\([^)]*\))?\s*:)/m.test(trimmed)
  const hasPyImports = /^(?:import\s+[a-zA-Z_]\w*|from\s+[a-zA-Z_]\w*\s+import\s+)/m.test(trimmed)
  if ((hasPyDefOrClass || hasPyImports) && lines.some((l) => l.endsWith(':'))) {
    return { isCode: true, language: 'python' }
  }

  // 6. SQL detection
  const hasSqlKeywords = /^(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|UPDATE\s+.+\s+SET|DELETE\s+FROM)\b/im.test(trimmed)
  if (hasSqlKeywords && (lines.some((l) => l.endsWith(';')) || lines.length >= 2)) {
    return { isCode: true, language: 'sql' }
  }

  // 7. General code block: multiple lines where majority end with semicolons or braces
  const codePunctuationLineCount = lines.filter((l) => /[{};]$/.test(l)).length
  if (lines.length >= 3 && codePunctuationLineCount / lines.length >= 0.6 && /[{}]/.test(trimmed)) {
    return { isCode: true, language: 'code' }
  }

  return { isCode: false, language: '' }
}

type IntermediateBlock =
  | { kind: 'code'; language: string; title?: string; code: string; index: number }
  | { kind: 'text'; text: string; index: number }

export function MarkdownContent({ content, onOpenArtifact }: MarkdownContentProps) {
  if (!content) return null

  // Matches ``` or ~~~ with optional leading whitespace, any info string on the opening line,
  // followed by code content, and closed by matching backticks or end of string.
  const codeBlockRegex =
    /(?:^|\n)[ \t]*([`~]{3,})[ \t]*([^\r\n]*)[\r\n]+([\s\S]*?)(?:(?:\r?\n)[ \t]*\1[ \t]*(?:\r?\n|$)|$)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  const rawBlocks: IntermediateBlock[] = []

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const regularText = content.slice(lastIndex, match.index)
      if (regularText.trim()) {
        rawBlocks.push({ kind: 'text', text: regularText, index: lastIndex })
      }
    }

    const fenceInfo = parseFenceInfo(match[2])
    const code = match[3].replace(/\n+$/, '')
    rawBlocks.push({
      kind: 'code',
      language: fenceInfo.language,
      title: fenceInfo.title,
      code,
      index: match.index,
    })

    lastIndex = codeBlockRegex.lastIndex
  }

  if (lastIndex < content.length) {
    const regularText = content.slice(lastIndex)
    if (regularText.trim()) {
      rawBlocks.push({ kind: 'text', text: regularText, index: lastIndex })
    }
  }

  // Post-process intermediate blocks:
  // If a text block consists of un-fenced code tags (e.g. </style>, </div>, </form>, </br></br>) or raw CSS/HTML snippets
  // and is adjacent to a code block, merge it directly into that code block so it never spills out as raw text!
  const consolidatedBlocks: IntermediateBlock[] = []
  for (let i = 0; i < rawBlocks.length; i++) {
    const cur = rawBlocks[i]
    if (cur.kind === 'text') {
      const codeCheck = detectUnfencedCode(cur.text)
      if (isPureCodeOrTags(cur.text) || codeCheck.isCode) {
        const prev = consolidatedBlocks[consolidatedBlocks.length - 1]
        const next = i + 1 < rawBlocks.length ? rawBlocks[i + 1] : null
        if (prev && prev.kind === 'code') {
          prev.code = (prev.code + '\n' + cur.text.trim()).trim()
          continue
        } else if (next && next.kind === 'code') {
          next.code = (cur.text.trim() + '\n' + next.code).trim()
          continue
        } else {
          consolidatedBlocks.push({
            kind: 'code',
            language: codeCheck.language || 'html',
            code: cur.text.trim(),
            index: cur.index,
          })
          continue
        }
      }
    }
    consolidatedBlocks.push(cur)
  }

  const tokens: ReactNode[] = consolidatedBlocks.map((b) => {
    if (b.kind === 'code') {
      return (
        <CodeBlock
          key={`cb-${b.index}`}
          language={b.language}
          title={b.title}
          code={b.code}
          onOpenArtifact={onOpenArtifact}
        />
      )
    }
    return renderTextBlocks(b.text, b.index, onOpenArtifact)
  })

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 text-[15px] leading-7 tracking-[-0.006em] text-[var(--text)]">
      {tokens}
    </div>
  )
}

function isMarkdownTable(lines: string[]): boolean {
  if (lines.length < 3) return false
  const first = lines[0].trim()
  const second = lines[1].trim()
  const third = lines[2].trim()
  return (
    first.includes('|') &&
    second.includes('|') &&
    /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(second) &&
    third.includes('|') &&
    !/^\|?[\s:-]+\|/.test(third)
  )
}

function renderMarkdownTable(
  lines: string[],
  key: number,
  onOpenArtifact?: (artifact: ArtifactPayload) => void,
): ReactNode {
  const parseRow = (row: string) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())

  const headers = parseRow(lines[0])
  const bodyRows = lines
    .slice(2)
    .filter((r) => r.trim().includes('|'))
    .map(parseRow)

  if (bodyRows.length === 0) {
    return null
  }

  return (
    <InteractiveTable
      key={key}
      headers={headers}
      bodyRows={bodyRows}
      onOpenArtifact={onOpenArtifact}
    />
  )
}

function renderTextBlocks(
  raw: string,
  keyOffset: number,
  onOpenArtifact?: (artifact: ArtifactPayload) => void,
): ReactNode {
  const rawParagraphs = raw.split(/\n\s*\n/)

  // Check if a contiguous sequence of un-fenced paragraphs forms an Email/Letter draft
  // (e.g. starts with `Subject:` or `Dear ...` and ends with `Regards,` / `Best regards,` / `Sincerely,`)
  const salutationIdx = rawParagraphs.findIndex((p) =>
    /^(?:\*\*)?(?:Subject:|To:|Dear\s+|Respected\s+|Hi\s+[A-Z]|Hello\s+[A-Z])/im.test(p.trim()),
  )
  if (salutationIdx !== -1) {
    let signOffIdx = -1
    for (let i = salutationIdx; i < rawParagraphs.length; i++) {
      if (
        /(?:^|\n)\s*(?:Regards|Best regards|Kind regards|Warm regards|Sincerely|Yours truly|Yours sincerely)[,!]?/i.test(
          rawParagraphs[i].trim(),
        )
      ) {
        signOffIdx = i
        // If the signature name is in the very next short paragraph, include it too
        if (
          i + 1 < rawParagraphs.length &&
          rawParagraphs[i].trim().split('\n').length === 1 &&
          rawParagraphs[i + 1].trim().length < 80
        ) {
          signOffIdx = i + 1
        }
        break
      }
    }

    if (signOffIdx !== -1 && signOffIdx >= salutationIdx) {
      const beforeEmail = rawParagraphs.slice(0, salutationIdx).join('\n\n').trim()
      const emailBlockText = rawParagraphs.slice(salutationIdx, signOffIdx + 1).join('\n\n').trim()
      const afterEmail = rawParagraphs.slice(signOffIdx + 1).join('\n\n').trim()
      const parsed = parseEmailDraft(emailBlockText, true)
      if (parsed) {
        return (
          <div key={`email-wrap-${keyOffset}`} className="space-y-4">
            {beforeEmail && renderTextBlocks(beforeEmail, keyOffset + 1, onOpenArtifact)}
            <EmailDraftCard initialDraft={parsed} onOpenArtifact={onOpenArtifact} />
            {afterEmail && renderTextBlocks(afterEmail, keyOffset + 500, onOpenArtifact)}
          </div>
        )
      }
    }
  }

  const paragraphs = rawParagraphs
  const renderedNodes: ReactNode[] = []
  let pIndex = 0

  while (pIndex < paragraphs.length) {
    const trimmed = paragraphs[pIndex].trim()
    if (!trimmed) {
      pIndex++
      continue
    }

    // Un-fenced code detection: auto-promote raw CSS/HTML/JS/code snippets into CodeBlock cards
    const codeCheck = detectUnfencedCode(trimmed)
    if (codeCheck.isCode) {
      const codeParts = [trimmed]
      let nextIdx = pIndex + 1
      while (nextIdx < paragraphs.length) {
        const nextTrimmed = paragraphs[nextIdx].trim()
        if (!nextTrimmed) {
          nextIdx++
          continue
        }
        const nextCodeCheck = detectUnfencedCode(nextTrimmed)
        const isCompatibleLang =
          nextCodeCheck.language === codeCheck.language ||
          codeCheck.language === 'code' ||
          nextCodeCheck.language === 'code' ||
          (['html', 'css', 'javascript', 'json'].includes(codeCheck.language) &&
            ['html', 'css', 'javascript', 'json'].includes(nextCodeCheck.language))

        if (nextCodeCheck.isCode && isCompatibleLang) {
          codeParts.push(nextTrimmed)
          nextIdx++
        } else {
          break
        }
      }
      renderedNodes.push(
        <CodeBlock
          key={`unfenced-code-${pIndex}`}
          language={codeCheck.language}
          code={codeParts.join('\n\n')}
          onOpenArtifact={onOpenArtifact}
        />,
      )
      pIndex = nextIdx
      continue
    }

    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      renderedNodes.push(<hr key={pIndex} className="my-5 border-[var(--border)]/80" />)
      pIndex++
      continue
    }

    // Single-line bold section heading (e.g., `**Image generation test prompt**` like ChatGPT)
    if (!trimmed.includes('\n') && /^\*\*[^*]{3,90}\*\*[:]?$/.test(trimmed)) {
      const cleanTitle = trimmed.replace(/^\*\*|\*\*[:]?$/g, '')
      renderedNodes.push(
        <h3
          key={pIndex}
          className="mt-5 mb-1.5 text-[16px] font-bold tracking-tight text-[var(--text)]"
        >
          {cleanTitle}
        </h3>,
      )
      pIndex++
      continue
    }

    if (trimmed.startsWith('# ')) {
      renderedNodes.push(
        <h1
          key={pIndex}
          className="mt-6 mb-2.5 text-xl font-bold tracking-tight text-[var(--text)]"
        >
          {renderInlineFormatting(trimmed.slice(2))}
        </h1>,
      )
      pIndex++
      continue
    }
    if (trimmed.startsWith('## ')) {
      renderedNodes.push(
        <h2
          key={pIndex}
          className="mt-5 mb-2 text-[17px] font-bold tracking-tight text-[var(--text)]"
        >
          {renderInlineFormatting(trimmed.slice(3))}
        </h2>,
      )
      pIndex++
      continue
    }
    if (trimmed.startsWith('### ')) {
      renderedNodes.push(
        <h3
          key={pIndex}
          className="mt-5 mb-1.5 text-[15.5px] font-bold tracking-tight text-[var(--text)]"
        >
          {renderInlineFormatting(trimmed.slice(4))}
        </h3>,
      )
      pIndex++
      continue
    }
    if (trimmed.startsWith('#### ')) {
      renderedNodes.push(
        <h4
          key={pIndex}
          className="mt-4 mb-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
        >
          {renderInlineFormatting(trimmed.slice(5))}
        </h4>,
      )
      pIndex++
      continue
    }

    // Blockquote `> ...` -> Elevated Attention / Callout Card (or Plain text card if it's a long prompt)
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n')
      // If it's a long descriptive prompt inside a blockquote (> 220 chars and starts with Create/Generate/Imagine/A ), render as Plain text box
      if (
        quoteText.length > 220 &&
        /^(?:Create|Generate|Imagine|A\s|An\s|Ultra-realistic|Cinematic|Photorealistic)/i.test(
          quoteText.trim(),
        )
      ) {
        renderedNodes.push(
          <CodeBlock
            key={`quote-prompt-${pIndex}`}
            language="text"
            code={quoteText}
            onOpenArtifact={onOpenArtifact}
          />,
        )
      } else {
        renderedNodes.push(renderCalloutBlock(quoteText, pIndex))
      }
      pIndex++
      continue
    }

    // Standalone Callout paragraph starting with `💡`, `⚠️`, `**Pro Tip:**`, `**Important:**`, `**Key Takeaway:**`
    if (
      /^(?:💡|⚠️|\*\*(?:Pro Tip|Important|Warning|Key Takeaway|Note|Security Alert|Security Advisory)\*\*[:]?|(?:Pro Tip|Important|Warning|Key Takeaway|Security Alert|Security Advisory)[:\s])/i.test(
        trimmed,
      )
    ) {
      renderedNodes.push(renderCalloutBlock(trimmed, pIndex))
      pIndex++
      continue
    }

    // Suppress orphaned "Summary Table:" headings if there's no valid multi-row table following
    if (/^(?:\*\*)?(?:Summary Table|Table)(?:\*\*)?[:]?$/i.test(trimmed)) {
      const nextP = paragraphs[pIndex + 1]?.trim() ?? ''
      if (!nextP || !isMarkdownTable(nextP.split('\n'))) {
        pIndex++
        continue
      }
    }

    // Auto-promote long quoted prompt paragraphs (`"Create an ultra-realistic..."`) into a ChatGPT `</> Plain text` card
    if (
      trimmed.length > 160 &&
      ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith('“') && trimmed.endsWith('”')))
    ) {
      const unquoted = trimmed.slice(1, -1).trim()
      renderedNodes.push(
        <CodeBlock
          key={`auto-prompt-${pIndex}`}
          language="text"
          code={unquoted}
          onOpenArtifact={onOpenArtifact}
        />,
      )
      pIndex++
      continue
    }

    const lines = trimmed.split('\n')

    if (isMarkdownTable(lines)) {
      renderedNodes.push(renderMarkdownTable(lines, pIndex, onOpenArtifact))
      pIndex++
      continue
    }

    if (lines.every((line) => /^[-*]\s+\[[ xX]\]\s+/.test(line.trim()))) {
      renderedNodes.push(
        <ul key={pIndex} className="my-3 space-y-2 text-[var(--text)]">
          {lines.map((line, i) => {
            const checked = /^[-*]\s+\[[xX]\]/.test(line.trim())
            const itemText = line.trim().replace(/^[-*]\s+\[[ xX]\]\s+/, '')
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    checked
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  {checked ? '✓' : ''}
                </span>
                <span className={checked ? 'text-[var(--muted)] line-through' : ''}>
                  {renderInlineFormatting(itemText)}
                </span>
              </li>
            )
          })}
        </ul>,
      )
      pIndex++
      continue
    }

    if (lines.every((line) => line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
      const items = lines.map((line) => line.trim().replace(/^[-*]\s+/, ''))
      renderedNodes.push(
        <ul
          key={pIndex}
          className="my-3 ml-5 list-disc space-y-2 marker:text-[var(--muted)] text-[var(--text)]"
        >
          {items.map((item, i) => (
            <li key={i} className="pl-1 leading-7">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>,
      )
      pIndex++
      continue
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line.trim()))) {
      const items = lines.map((line) => line.trim().replace(/^\d+\.\s+/, ''))
      renderedNodes.push(
        <ol
          key={pIndex}
          className="my-3 ml-5 list-decimal space-y-2 marker:font-semibold marker:text-[var(--muted)] text-[var(--text)]"
        >
          {items.map((item, i) => (
            <li key={i} className="pl-1 leading-7">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>,
      )
      pIndex++
      continue
    }

    const normalizedTrimmed = normalizeAllCapsParagraph(trimmed)
    const normalizedLines = normalizedTrimmed.split('\n')

    renderedNodes.push(
      <p key={pIndex} className="leading-7 text-[var(--text)]">
        {normalizedLines.map((line, lIndex) => (
          <span key={lIndex}>
            {renderInlineFormatting(line)}
            {lIndex < normalizedLines.length - 1 && <br />}
          </span>
        ))}
      </p>,
    )
    pIndex++
  }

  return (
    <div key={`block-${keyOffset}`} className="w-full min-w-0 max-w-full space-y-4">
      {renderedNodes}
    </div>
  )
}
