const ensureLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`

const normalizePrefix = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  const withLeading = ensureLeadingSlash(trimmed)
  return withLeading.replace(/\/+$/, '')
}

const rawApiPrefix = import.meta.env.VITE_API_PREFIX || '/api'
const rawApiV1Prefix = import.meta.env.VITE_API_V1_PREFIX || '/v1'
const rawApiV1AltPrefix = import.meta.env.VITE_API_V1_ALT_PREFIX || `${rawApiPrefix}/v1`

export const API_PREFIX = normalizePrefix(rawApiPrefix) || '/api'
export const API_V1_PREFIX = normalizePrefix(rawApiV1Prefix) || '/v1'
export const API_V1_ALT_PREFIX =
  normalizePrefix(rawApiV1AltPrefix) || `${API_PREFIX}/v1`

export const buildUrl = (prefix: string, path: string): string => {
  const safePrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  const safePath = path.startsWith('/') ? path : `/${path}`
  return `${safePrefix}${safePath}`
}

export const buildV1Url = (path: string, useAlt: boolean = false): string =>
  buildUrl(useAlt ? API_V1_ALT_PREFIX : API_V1_PREFIX, path)
