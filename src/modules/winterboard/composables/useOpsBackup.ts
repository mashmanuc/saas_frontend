/**
 * Phase ops-only migration: localStorage backup для ops pipeline.
 *
 * Advisor's must-have: backup має включати **обидва буфери** (pending + inFlight),
 * бо буфер міг бути flushed → request in-flight → crash браузера → op loss.
 *
 * Формат у localStorage: `wb_ops_backup_{sessionId}` = JSON
 *   { pending: QueuedOp[], inFlight: QueuedOp[], savedAt: ISO }
 *
 * Lifecycle:
 *   saveBackup(pending, inFlight) — перед flush()
 *   clearBackup()                 — після успішного ACK
 *   readBackup()                  — при mount composable'а
 */

const KEY_PREFIX = 'wb_ops_backup_'
const MAX_BACKUP_AGE_MS = 7 * 24 * 3_600 * 1_000 // 7 днів

export interface OpsBackup<T = unknown> {
  pending: T[]
  inFlight: T[]
  savedAt: string // ISO
}

function keyFor(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`
}

export function saveBackup<T>(sessionId: string, pending: T[], inFlight: T[]): void {
  if (!sessionId) return
  if (pending.length === 0 && inFlight.length === 0) {
    clearBackup(sessionId)
    return
  }
  try {
    const payload: OpsBackup<T> = {
      pending,
      inFlight,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(keyFor(sessionId), JSON.stringify(payload))
  } catch (err) {
    // QuotaExceededError / SecurityError — mute, non-critical
    console.warn('[WB:opsBackup] save failed:', err)
  }
}

export function readBackup<T>(sessionId: string): OpsBackup<T> | null {
  if (!sessionId) return null
  try {
    const raw = localStorage.getItem(keyFor(sessionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as OpsBackup<T>
    if (!parsed || !Array.isArray(parsed.pending) || !Array.isArray(parsed.inFlight)) {
      return null
    }
    // TTL: ігноруємо старі бекапи (сесія могла змінитись, ops застарілі)
    const age = Date.now() - new Date(parsed.savedAt).getTime()
    if (!Number.isFinite(age) || age > MAX_BACKUP_AGE_MS) {
      clearBackup(sessionId)
      return null
    }
    return parsed
  } catch (err) {
    console.warn('[WB:opsBackup] read failed:', err)
    return null
  }
}

export function clearBackup(sessionId: string): void {
  if (!sessionId) return
  try {
    localStorage.removeItem(keyFor(sessionId))
  } catch {
    /* noop */
  }
}
