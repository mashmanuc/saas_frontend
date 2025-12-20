export type Primitive = string | number | boolean | null | undefined

export function toDisplayText(value: unknown, fallback: string): string {
  if (value == null) return fallback
  if (typeof value === 'string') {
    const v = value.trim()
    return v.length > 0 ? v : fallback
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback
  }
  if (typeof value === 'boolean') {
    return fallback
  }
  return fallback
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((x) => {
      if (typeof x === 'string') return x
      if (x && typeof x === 'object') {
        const obj: any = x
        const v = obj.name ?? obj.title ?? obj.label ?? obj.code ?? obj.slug
        return typeof v === 'string' ? v : null
      }
      return null
    })
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
}

export function formatList(value: unknown, fallback: string, opts?: { limit?: number; separator?: string }): string {
  const arr = toStringArray(value)
  const separator = opts?.separator ?? ', '
  const limit = typeof opts?.limit === 'number' ? opts?.limit : undefined

  const sliced = typeof limit === 'number' ? arr.slice(0, Math.max(0, limit)) : arr
  return sliced.length > 0 ? sliced.join(separator) : fallback
}
