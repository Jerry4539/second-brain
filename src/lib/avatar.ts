/** Deterministic 1-2 letter avatar initials generated locally from a model/name string. */
export function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const firstWord = trimmed.split(/\s+/)[0]
  return firstWord.slice(0, 2).toUpperCase()
}
