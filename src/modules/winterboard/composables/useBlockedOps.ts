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

/** Усі аварійні записи цієї дошки цього акаунта (з будь-якої вкладки), найстаріші першими. */
export function readBlocked(sessionId: string, userId: string | null): Array<{ key: string; record: BlockedRecord }> {
  if (!sessionId) return []
  const prefix = `${KEY_PREFIX}${sessionId}_`
  const out: Array<{ key: string; record: BlockedRecord }> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(prefix)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      let record: BlockedRecord
      try {
        record = JSON.parse(raw) as BlockedRecord
      } catch {
        console.warn('[WB:blockedOps] unreadable record kept as is:', key)
        continue
      }
      if (record?.v !== FORMAT_VERSION || record.sessionId !== sessionId) continue
      if (!Array.isArray(record.inFlight) || !Array.isArray(record.pending)) continue
      if ((record.userId ?? null) !== (userId ?? null)) continue
      out.push({ key, record })
    }
  } catch (err) {
    console.warn('[WB:blockedOps] read failed:', err)
  }
  return out.sort((a, b) => a.record.savedAt.localeCompare(b.record.savedAt))
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
