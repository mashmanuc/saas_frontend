/**
 * Phase ops-only migration: localStorage backup для ops pipeline.
 *
 * Advisor's must-have: backup має включати **обидва буфери** (pending + inFlight),
 * бо буфер міг бути flushed → request in-flight → crash браузера → op loss.
 *
 * Формат у localStorage: `wb_ops_backup_v2_{sessionId}_{u<id>|anon}` = JSON
 *   { pending: QueuedOp[], inFlight: QueuedOp[], savedAt: ISO }
 *
 * Власник — у ключі (рев'ю P0, 2026-09-24): на спільному браузері інший акаунт
 * із доступом до тієї ж дошки (Classroom: учитель і учень) не підхоплює й не
 * надсилає чужі незавершені дії. Старий ключ `wb_ops_backup_{sessionId}` власника
 * не має — не читається й не стирається (власника не встановити).
 *
 * Lifecycle:
 *   saveBackup(pending, inFlight) — перед flush()
 *   clearBackup()                 — після успішного ACK
 *   readBackup()                  — при mount composable'а
 *   readBackupChecked()           — те саме, але пошкоджений запис ≠ «немає»
 */

const KEY_PREFIX = 'wb_ops_backup_v2_'
const MAX_BACKUP_AGE_MS = 7 * 24 * 3_600 * 1_000 // 7 днів

export interface OpsBackup<T = unknown> {
  pending: T[]
  inFlight: T[]
  savedAt: string // ISO
}

export type BackupRead<T> =
  | { status: 'none' }
  | { status: 'ok'; backup: OpsBackup<T> }
  /** Запис є, але його не прочитати. `raw === null` — саме сховище кинуло помилку. */
  | { status: 'unreadable'; key: string; raw: string | null }

/** Акаунт, якому належать backup'и цієї вкладки (ставить opsSyncStore.setBlockedOwner). */
let _owner: string | null = null

export function setOpsOwner(userId: string | null): void {
  _owner = userId
}

function keyFor(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}_${_owner ? `u${_owner}` : 'anon'}`
}

export function backupKey(sessionId: string): string {
  return keyFor(sessionId)
}

/**
 * Записати backup. `true` — запис ліг і перевірений читанням назад (або черга
 * порожня й backup знято). `false` — сховище відмовило: викликач, якому це
 * важливо (зняття аварійного запису SAVE_BLOCKED), НЕ має вважати чергу збереженою.
 */
export function saveBackup<T>(sessionId: string, pending: T[], inFlight: T[]): boolean {
  if (!sessionId) return false
  if (pending.length === 0 && inFlight.length === 0) {
    clearBackup(sessionId)
    return true
  }
  try {
    const payload: OpsBackup<T> = {
      pending,
      inFlight,
      savedAt: new Date().toISOString(),
    }
    const raw = JSON.stringify(payload)
    localStorage.setItem(keyFor(sessionId), raw)
    return localStorage.getItem(keyFor(sessionId)) === raw
  } catch (err) {
    // QuotaExceededError / SecurityError — результат повертаємо: store за ним
    // вмикає «черга без копії» (LAW §4), а не лише пише в консоль.
    console.warn('[WB:opsBackup] save failed:', err)
    return false
  }
}

export function readBackupChecked<T>(sessionId: string): BackupRead<T> {
  if (!sessionId) return { status: 'none' }
  const key = keyFor(sessionId)
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch (err) {
    console.warn('[WB:opsBackup] read failed:', err)
    return { status: 'unreadable', key, raw: null }
  }
  if (raw === null || raw === '') return { status: 'none' }
  let parsed: OpsBackup<T> | null = null
  try {
    parsed = JSON.parse(raw) as OpsBackup<T>
  } catch {
    parsed = null
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.pending) ||
      !Array.isArray(parsed.inFlight) || typeof parsed.savedAt !== 'string') {
    console.warn('[WB:opsBackup] unreadable backup kept as is:', key)
    return { status: 'unreadable', key, raw }
  }
  // TTL: ігноруємо старі бекапи (сесія могла змінитись, ops застарілі)
  const age = Date.now() - new Date(parsed.savedAt).getTime()
  if (!Number.isFinite(age) || age > MAX_BACKUP_AGE_MS) {
    clearBackup(sessionId)
    return { status: 'none' }
  }
  return { status: 'ok', backup: parsed }
}

export function readBackup<T>(sessionId: string): OpsBackup<T> | null {
  const r = readBackupChecked<T>(sessionId)
  return r.status === 'ok' ? r.backup : null
}

export function clearBackup(sessionId: string): void {
  if (!sessionId) return
  try {
    localStorage.removeItem(keyFor(sessionId))
  } catch {
    /* noop */
  }
}
