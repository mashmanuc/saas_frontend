/**
 * folderRoute — utilities for passing folder context through Vue Router queries.
 *
 * INV-KNOW-1 (Knowledge plan 2026-05-02): create flow MUST respect current
 * folder context. We propagate via `?folder=<id>` query parameter — survives
 * deep-link refresh and avoids global Pinia state for a transient value.
 */

/**
 * Strict-parse a route query value into a folder primary-key.
 *
 * Returns:
 *   - `number` (positive integer) when value is a valid folder id
 *   - `null` when value is missing, non-string, NaN, zero, negative, fractional,
 *     or an array (Vue Router can deliver `string | string[] | null | undefined`)
 *
 * NEVER throws. NEVER returns NaN. Caller can safely pass result to
 * `createSession({ folder })`.
 *
 * Examples:
 *   parseFolderQuery('5')      → 5
 *   parseFolderQuery('0')      → null   (folder ids start at 1)
 *   parseFolderQuery('-1')     → null
 *   parseFolderQuery('1.5')    → null
 *   parseFolderQuery('abc')    → null
 *   parseFolderQuery(undefined)→ null
 *   parseFolderQuery(['1','2'])→ null   (array — ambiguous)
 */
export function parseFolderQuery(value: unknown): number | null {
  if (typeof value !== 'string') return null
  if (value.length === 0) return null
  const n = Number(value)
  if (!Number.isInteger(n)) return null
  if (n <= 0) return null
  return n
}

/**
 * Type guard — error response from backend that signals folder is gone or
 * forbidden (validation error from `WBSessionCreateSerializer.validate_folder`).
 *
 * Backend currently throws DRF ValidationError → axios surfaces as 400 with
 * `response.data.folder` array of error messages.
 */
export function isFolderUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { response?: { status?: number; data?: Record<string, unknown> } }
  if (e.response?.status !== 400) return false
  const data = e.response?.data
  if (!data || typeof data !== 'object') return false
  // DRF returns { folder: ['Folder must belong to you'] } or similar.
  return 'folder' in data
}
