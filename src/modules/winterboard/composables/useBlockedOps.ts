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
 *
 * Власник — у КЛЮЧІ (формат v2, рев'ю P0 2026-09-24): `…v2_{sid}_{u<id>|anon}_{tab}`.
 * Інакше власника пошкодженого запису не встановити, і користувач Б міг би
 * завантажити чи стерти сирий запис користувача А. Чужі v2-ключі навіть не
 * потрапляють у вибірку. Записи v1 (прод `a37af79b`, власник лише всередині):
 * власника беремо зі вмісту; не встановлено → запис не віддаємо, не стираємо і
 * ним не блокуємо (він не наш, доки не доведено протилежне).
 */
import type { OpsSyncOp, SaveBlockInfo } from '../stores/opsSyncStore'

const KEY_PREFIX = 'wb_ops_blocked_v2_'
const LEGACY_PREFIX = 'wb_ops_blocked_v1_'
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

function ownerSeg(userId: string | null): string {
  return userId ? `u${userId}` : 'anon'
}

function keyFor(sessionId: string, userId: string | null, tabId: string): string {
  return `${KEY_PREFIX}${sessionId}_${ownerSeg(userId)}_${tabId}`
}

/** Структура запису повна й придатна до сортування (savedAt — рядок). */
function isValidRecord(r: unknown, sessionId: string): r is BlockedRecord {
  const x = r as Partial<BlockedRecord> | null
  return !!x && typeof x === 'object' && x.v === FORMAT_VERSION && x.sessionId === sessionId &&
    Array.isArray(x.inFlight) && Array.isArray(x.pending) &&
    !!x.info && typeof x.info === 'object' && typeof x.savedAt === 'string'
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
  const key = keyFor(sessionId, userId, tabId)
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
   * ВЛАСНІ записи цієї дошки, які НЕ вдалося розібрати (пошкоджений JSON,
   * невідомий формат, зламана структура, зіпсована дата). Їх не можна мовчки
   * вважати «нічого немає» — там можуть бути незбережені дії (рев'ю P0, 2026-09-24).
   * Власника встановлено ДО цього (ключ v2 або вміст v1) — експорт і видалення безпечні.
   */
  unreadable: Array<{ key: string; raw: string }>
  /** Саме сховище кинуло помилку під час читання — стан невідомий. */
  readFailed: boolean
  /** Записи v1 цієї дошки з невстановленим власником — лише для ручного завантаження. */
  legacyUnknown: Array<{ key: string; raw: string }>
}

/** Усі аварійні записи цієї дошки цього акаунта (з будь-якої вкладки). */
export function readBlocked(sessionId: string, userId: string | null): BlockedReadResult {
  const result: BlockedReadResult = { records: [], unreadable: [], readFailed: false, legacyUnknown: [] }
  if (!sessionId) return result
  const ownPrefix = `${KEY_PREFIX}${sessionId}_${ownerSeg(userId)}_`
  const legacyPrefix = `${LEGACY_PREFIX}${sessionId}_`
  const me = userId ?? null
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const own = key.startsWith(ownPrefix)
      const legacy = !own && key.startsWith(legacyPrefix)
      if (!own && !legacy) continue  // зокрема чужі v2-ключі — не наші, не читаємо
      const raw = localStorage.getItem(key)
      if (raw === null) continue
      let parsed: unknown = null
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }
      if (legacy) {
        // v1: власник лише всередині. Не встановлено або чужий → не наш запис.
        const uid = (parsed && typeof parsed === 'object') ? (parsed as { userId?: unknown }).userId : undefined
        const known = uid === null || typeof uid === 'string'
        if (!known) {
          console.warn('[WB:blockedOps] legacy record with unknown owner left untouched:', key)
          result.legacyUnknown.push({ key, raw })
          continue
        }
        if (uid !== me) continue
      } else if ((parsed as { userId?: unknown } | null)?.userId !== undefined &&
                 (parsed as { userId?: unknown }).userId !== me) {
        // Ключ каже «мій», вміст — «чужий»: не довіряємо жодному, не віддаємо.
        console.warn('[WB:blockedOps] owner mismatch between key and record, left untouched:', key)
        continue
      }
      if (!isValidRecord(parsed, sessionId)) {
        console.warn('[WB:blockedOps] unreadable record kept as is:', key)
        result.unreadable.push({ key, raw })
        continue
      }
      result.records.push({ key, record: parsed })
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

export function blockedKey(sessionId: string, userId: string | null, tabId: string): string {
  return keyFor(sessionId, userId, tabId)
}
