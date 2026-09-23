/**
 * Аварійне сховище черги, яку сервер відхилив або результат якої не підтверджено
 * (стан `SAVE_BLOCKED`, SYSTEM_LAW §4–§5, P0 ТЗ `TZ_BOARD_SAVE_REJECTION_RECOVERY_2026-09-23.md`).
 *
 * Відмінності від звичайного backup (`useOpsBackup`):
 *  - ключ = дошка + вкладка: дві вкладки однієї дошки не перезаписують одна одну
 *    (правило «остання вкладка перемагає» заборонене, ТЗ §7);
 *  - немає TTL: невирішене не зникає мовчки через тиждень;
 *  - кожен запис перевіряється читанням назад; невдача → caller вмикає fail-closed;
 *  - після reload черга НЕ повертається у звичайну відправку — store відновлює
 *    `SAVE_BLOCKED` і чекає дії вчителя;
 *  - запис прив'язаний до акаунта: чужий запис на спільному комп'ютері не читається.
 */
import type { OpsSyncOp, SaveBlockInfo } from '../stores/opsSyncStore'

const KEY_PREFIX = 'wb_ops_blocked_v1_'
const FORMAT_VERSION = 1

export interface BlockedRecord {
  v: number
  sessionId: string
  tabId: string
  userId: string | null
  info: SaveBlockInfo
  inFlight: OpsSyncOp[]
  pending: OpsSyncOp[]
  savedAt: string
}

function keyFor(sessionId: string, tabId: string): string {
  return `${KEY_PREFIX}${sessionId}_${tabId}`
}

/**
 * Записати чергу й перевірити, що вона справді лягла. `false` — сховище недоступне
 * або переповнене: викликач НЕ має права вважати чергу збереженою.
 */
export function writeBlocked(
  sessionId: string,
  tabId: string,
  userId: string | null,
  info: SaveBlockInfo,
  inFlight: OpsSyncOp[],
  pending: OpsSyncOp[],
): boolean {
  if (!sessionId) return false
  const record: BlockedRecord = {
    v: FORMAT_VERSION,
    sessionId,
    tabId,
    userId,
    info,
    inFlight,
    pending,
    savedAt: new Date().toISOString(),
  }
  const key = keyFor(sessionId, tabId)
  const raw = JSON.stringify(record)
  try {
    localStorage.setItem(key, raw)
    return localStorage.getItem(key) === raw
  } catch (err) {
    // QuotaExceededError / SecurityError — НЕ ковтаємо мовчки: повертаємо false,
    // і store показує «зміни лише в пам'яті вкладки» + блокує введення.
    console.warn('[WB:blockedOps] write failed:', err)
    return false
  }
}

export interface BlockedReadResult {
  /** Прочитані записи цієї дошки цього акаунта, найстаріші першими. */
  records: Array<{ key: string; record: BlockedRecord }>
  /**
   * Записи цієї дошки, які НЕ вдалося розібрати (пошкоджений JSON, невідомий
   * формат, зламана структура). Їх не можна мовчки вважати «нічого немає» —
   * там можуть бути незбережені дії (рев'ю P0, 2026-09-24).
   */
  unreadable: Array<{ key: string; raw: string }>
  /** Саме сховище кинуло помилку під час читання — стан невідомий. */
  readFailed: boolean
}

/** Усі аварійні записи цієї дошки цього акаунта (з будь-якої вкладки). */
export function readBlocked(sessionId: string, userId: string | null): BlockedReadResult {
  const result: BlockedReadResult = { records: [], unreadable: [], readFailed: false }
  if (!sessionId) return result
  const prefix = `${KEY_PREFIX}${sessionId}_`
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(prefix)) continue
      const raw = localStorage.getItem(key)
      if (raw === null) continue
      let record: BlockedRecord | null = null
      try {
        record = JSON.parse(raw) as BlockedRecord
      } catch {
        record = null
      }
      const valid = !!record && record.v === FORMAT_VERSION && record.sessionId === sessionId &&
        Array.isArray(record.inFlight) && Array.isArray(record.pending) && !!record.info
      if (!valid) {
        console.warn('[WB:blockedOps] unreadable record kept as is:', key)
        result.unreadable.push({ key, raw })
        continue
      }
      // Чужий акаунт на спільному комп'ютері — не наш запис, не помилка.
      if ((record!.userId ?? null) !== (userId ?? null)) continue
      result.records.push({ key, record: record! })
    }
  } catch (err) {
    console.warn('[WB:blockedOps] read failed:', err)
    result.readFailed = true
  }
  result.records.sort((a, b) => a.record.savedAt.localeCompare(b.record.savedAt))
  return result
}

export function removeBlocked(keys: string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch (err) {
      console.warn('[WB:blockedOps] remove failed:', key, err)
    }
  }
}

export function blockedKey(sessionId: string, tabId: string): string {
  return keyFor(sessionId, tabId)
}
