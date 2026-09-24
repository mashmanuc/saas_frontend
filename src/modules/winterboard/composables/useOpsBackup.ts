/**
 * Phase ops-only migration: localStorage backup для ops pipeline.
 *
 * Advisor's must-have: backup має включати **обидва буфери** (pending + inFlight),
 * бо буфер міг бути flushed → request in-flight → crash браузера → op loss.
 *
 * Формат у localStorage: `wb_ops_backup_v2_{sessionId}_{u<id>|anon}_{tabId}` = JSON
 *   { pending: QueuedOp[], inFlight: QueuedOp[], savedAt: ISO }
 *
 * Власник і вкладка — у ключі (рев'ю P0, 2026-09-24):
 *  - власник: на спільному браузері інший акаунт із доступом до тієї ж дошки
 *    (Classroom: учитель і учень) не підхоплює й не надсилає чужі дії;
 *  - вкладка: дві вкладки однієї дошки одного акаунта не стирають копії одна одної
 *    (порожня черга знімає лише СВОЮ копію). Відкриття дошки підхоплює копії всіх
 *    своїх вкладок (`readAllBackups`), чужі копії вкладок знімаються лише після
 *    перевіреного запису своєї (див. useReplayRecorder._restoreBackup).
 * Старий ключ `wb_ops_backup_{sessionId}` власника не має — автоматично не
 * відновлюється; кімната показує його для ручного завантаження (`readLegacyBackup`).
 *
 * Lifecycle:
 *   saveBackup(pending, inFlight) — перед flush()
 *   clearBackup()                 — після успішного ACK (лише своя вкладка)
 *   readAllBackups()              — при відкритті дошки
 */

const KEY_PREFIX = 'wb_ops_backup_v2_'
const LEGACY_PREFIX = 'wb_ops_backup_'
const MAX_BACKUP_AGE_MS = 7 * 24 * 3_600 * 1_000 // 7 днів

export interface OpsBackup<T = unknown> {
  pending: T[]
  inFlight: T[]
  savedAt: string // ISO
}

export interface BackupsRead<T> {
  /** Копії своїх вкладок (включно з поточною), найстаріші першими. */
  records: Array<{ key: string; backup: OpsBackup<T> }>
  /** Власні копії, які не вдалося розібрати — не «немає», а дані для експорту. */
  unreadable: Array<{ key: string; raw: string }>
  /** Саме сховище кинуло помилку — стан невідомий. */
  readFailed: boolean
}

/** Акаунт і вкладка, яким належить копія (ставить opsSyncStore). */
let _owner: string | null = null
let _tab = 'tab-default'

export function setOpsOwner(userId: string | null): void {
  _owner = userId
}

export function setOpsTab(tabId: string): void {
  if (tabId) _tab = tabId
}

function ownPrefix(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}_${_owner ? `u${_owner}` : 'anon'}_`
}

function keyFor(sessionId: string): string {
  return `${ownPrefix(sessionId)}${_tab}`
}

export function backupKey(sessionId: string): string {
  return keyFor(sessionId)
}

/**
 * Записати backup. `true` — запис ліг і перевірений читанням назад (або черга
 * порожня й СВОЮ копію знято). `false` — сховище відмовило: store вмикає «черга
 * без копії» (LAW §4–§5), а не лише пише в консоль.
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
    console.warn('[WB:opsBackup] save failed:', err)
    return false
  }
}

function parseBackup<T>(raw: string): OpsBackup<T> | null {
  let parsed: OpsBackup<T> | null = null
  try {
    parsed = JSON.parse(raw) as OpsBackup<T>
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.pending) ||
      !Array.isArray(parsed.inFlight) || typeof parsed.savedAt !== 'string') {
    return null
  }
  return parsed
}

/** Копії цієї дошки цього акаунта з усіх вкладок. Прострочені (TTL) знімаються. */
export function readAllBackups<T>(sessionId: string): BackupsRead<T> {
  const result: BackupsRead<T> = { records: [], unreadable: [], readFailed: false }
  if (!sessionId) return result
  const prefix = ownPrefix(sessionId)
  const expired: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(prefix)) continue
      const raw = localStorage.getItem(key)
      if (raw === null || raw === '') continue
      const backup = parseBackup<T>(raw)
      if (!backup) {
        console.warn('[WB:opsBackup] unreadable backup kept as is:', key)
        result.unreadable.push({ key, raw })
        continue
      }
      // Зіпсована дата — не «прострочено»: мовчки стерти незбережені дії не можна.
      const savedMs = new Date(backup.savedAt).getTime()
      if (!Number.isFinite(savedMs)) {
        console.warn('[WB:opsBackup] backup with unreadable date kept as is:', key)
        result.unreadable.push({ key, raw })
        continue
      }
      // TTL: ігноруємо старі бекапи (сесія могла змінитись, ops застарілі)
      if (Date.now() - savedMs > MAX_BACKUP_AGE_MS) {
        expired.push(key)
        continue
      }
      result.records.push({ key, backup })
    }
  } catch (err) {
    console.warn('[WB:opsBackup] read failed:', err)
    result.readFailed = true
  }
  removeBackupKeys(expired)
  result.records.sort((a, b) => a.backup.savedAt.localeCompare(b.backup.savedAt))
  return result
}

/** Копія ПОТОЧНОЇ вкладки (для тестів і діагностики). */
export function readBackup<T>(sessionId: string): OpsBackup<T> | null {
  if (!sessionId) return null
  try {
    const raw = localStorage.getItem(keyFor(sessionId))
    return raw ? parseBackup<T>(raw) : null
  } catch {
    return null
  }
}

/**
 * Копія старого формату (`wb_ops_backup_{sessionId}`, без власника). Автоматично
 * не відновлюється — лише показується для ручного завантаження / прибирання.
 */
export function readLegacyBackup(sessionId: string): { key: string; raw: string } | null {
  if (!sessionId) return null
  const key = `${LEGACY_PREFIX}${sessionId}`
  try {
    const raw = localStorage.getItem(key)
    return raw ? { key, raw } : null
  } catch {
    return null
  }
}

export function removeBackupKeys(keys: string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* noop */
    }
  }
}

export function clearBackup(sessionId: string): void {
  if (!sessionId) return
  removeBackupKeys([keyFor(sessionId)])
}
