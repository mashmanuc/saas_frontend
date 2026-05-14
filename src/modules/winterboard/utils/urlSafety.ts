/**
 * URL safety helpers for object link attachments (stroke.linkUrl / asset.linkUrl).
 *
 * Allow ONLY http:/https: schemes. Block javascript:, data:, file:, vbscript:
 * etc. — usual XSS vectors at <a href> / window.open.
 *
 * Single source of truth — used by:
 *   - LinkAttachmentModal validation (live UI feedback)
 *   - SelectionQuickActions submit guard
 *   - LinkBadge click handler (defense in depth — friendly fail на open)
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Returns true iff `url` parses та має дозволений protocol. Whitespace trimmed.
 * Порожній рядок / null / undefined → false.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed)
    return ALLOWED_PROTOCOLS.has(u.protocol)
  } catch {
    return false
  }
}

/**
 * Normalize URL для збереження: trim + ensure protocol prefix.
 * Якщо user вводить "example.com" — додаємо "https://". Якщо ввів
 * "javascript:alert()" — повертає trimmed без зміни, validate потім блокує.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  // Якщо вже з protocol (will match "http:", "https:", "ftp:", "javascript:" etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  // Інакше assume https:// (default safe).
  return `https://${trimmed}`
}

/**
 * Хост частина URL для tooltip / fallback label.
 * Якщо URL некоректний — повертає trimmed input для debugging.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url.trim()
  }
}
