/**
 * Незбережена робота на дошках ЦЬОГО користувача в ЦЬОМУ браузері — перед виходом.
 *
 * ТЗ «Сесія спільного екрана і безпечний вихід», R7
 * (saas_docs/domains/users/TZ_SHARED_SCREEN_SESSION_AND_SAFE_LOGOUT_2026-09-25.md).
 *
 * Вихід сам нічого не вибирає. Якщо в браузері лежать неприйняті сервером дії
 * (звичайна копія черги `wb_ops_backup_v2_*` або аварійна `wb_ops_blocked_v2_*`),
 * вчитель бачить їх і вирішує: відкрити дошку (штатне відправлення, SYSTEM_LAW §5)
 * або явно відкинути — з числом дій, які буде втрачено. Мовчки нічого не стирається.
 *
 * Лише копії з власником у ключі (`u<id>`) цього користувача: чужі не читаються і не
 * стираються. Старі копії без власника (`wb_ops_backup_{дошка}`) мають власне правило
 * з 2026-09-24 (OpsLegacyCopyNotice — лише власнику дошки) — вихід їх не чіпає.
 */

const KEY_RE = /^(wb_ops_backup_v2_|wb_ops_blocked_v2_)([0-9a-f-]{36})_(u\d+|anon)_(.+)$/

export interface UnsentBoardWork {
  /** Дошка (WBSession id). */
  sessionId: string
  /** Скільки дій не прийнято сервером; для нечитабельної копії — 0. */
  ops: number
  /** Ключі localStorage цієї дошки (усі вкладки, обидва види копій). */
  keys: string[]
  /** Є аварійна копія (`SAVE_BLOCKED`) — сервер уже відмовив. */
  blocked: boolean
  /** Є копія, яку не вдалося прочитати: число дій невідоме. */
  unreadable: boolean
}

function countOps(raw: string | null): number | null {
  if (!raw) return null
  try {
    const record = JSON.parse(raw) as { pending?: unknown; inFlight?: unknown } | null
    const pending = Array.isArray(record?.pending) ? record!.pending.length : 0
    const inFlight = Array.isArray(record?.inFlight) ? record!.inFlight.length : 0
    return pending + inFlight
  } catch (err) {
    console.warn('[auth:logout] unreadable queue copy', err)
    return null
  }
}

/** Незбережена робота користувача по дошках. Порожні копії не рахуються. */
export function listUnsentWork(
  userId: string | number | null | undefined,
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
): UnsentBoardWork[] {
  if (userId === null || userId === undefined || userId === '' || !storage) return []
  const owner = `u${userId}`
  const byBoard = new Map<string, UnsentBoardWork>()

  let length = 0
  try {
    length = storage.length
  } catch (err) {
    console.warn('[auth:logout] storage unavailable', err)
    return []
  }

  for (let i = 0; i < length; i++) {
    const key = storage.key(i)
    const match = key ? KEY_RE.exec(key) : null
    if (!key || !match || match[3] !== owner) continue

    const ops = countOps(storage.getItem(key))
    if (ops === 0) continue

    const sessionId = match[2]
    const entry = byBoard.get(sessionId) ?? {
      sessionId, ops: 0, keys: [], blocked: false, unreadable: false,
    }
    entry.keys.push(key)
    entry.ops += ops ?? 0
    entry.unreadable = entry.unreadable || ops === null
    entry.blocked = entry.blocked || match[1] === 'wb_ops_blocked_v2_'
    byBoard.set(sessionId, entry)
  }
  return [...byBoard.values()].sort((a, b) => a.sessionId.localeCompare(b.sessionId))
}

/** Скільки дій буде втрачено, якщо відкинути все (нечитабельні не рахуються). */
export function totalUnsentOps(work: UnsentBoardWork[]): number {
  return work.reduce((sum, board) => sum + board.ops, 0)
}

/** Явне відкидання — ЛИШЕ після підтвердження вчителя з числом дій. */
export function discardUnsentWork(
  work: UnsentBoardWork[],
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  if (!storage) return
  for (const board of work) {
    for (const key of board.keys) {
      try {
        storage.removeItem(key)
      } catch (err) {
        console.warn('[auth:logout] failed to remove queue copy', key, err)
      }
    }
  }
}

/**
 * Копія незбережених дій дошки для завантаження вчителем — перед явним відкиданням
 * (SYSTEM_LAW §4: «Відкинути» — лише після пропозиції завантажити копію). Та сама форма,
 * що в експорті `SAVE_BLOCKED` (`opsSyncStore.exportBlocked`); нікуди не відправляється.
 * Нечитабельні записи йдуть сирими — «нічого немає» про них казати не можна.
 */
export function exportUnsentBoard(
  board: UnsentBoardWork,
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
): Record<string, unknown> {
  const ops: unknown[] = []
  const unreadable: Array<{ key: string; raw: string | null }> = []
  for (const key of board.keys) {
    let raw: string | null = null
    try {
      raw = storage ? storage.getItem(key) : null
    } catch (err) {
      console.warn('[auth:logout] queue copy not readable for export', key, err)
    }
    try {
      const record = raw ? JSON.parse(raw) as { pending?: unknown; inFlight?: unknown } : null
      const inFlight = Array.isArray(record?.inFlight) ? record!.inFlight : []
      const pending = Array.isArray(record?.pending) ? record!.pending : []
      if (!record) unreadable.push({ key, raw })
      ops.push(...inFlight, ...pending)
    } catch {
      unreadable.push({ key, raw })
    }
  }
  return {
    format: 'm4sh-unsaved-board-ops',
    version: 1,
    session_id: board.sessionId,
    exported_at: new Date().toISOString(),
    reason: null,
    source: 'logout',
    ops,
    ...(unreadable.length > 0 ? { unreadable_records: unreadable } : {}),
  }
}
