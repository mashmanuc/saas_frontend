/**
 * Чи жива інша вкладка (рев'ю P0, 2026-09-24).
 *
 * Копії черги (звичайна `wb_ops_backup_v2_*` і аварійна `wb_ops_blocked_v2_*`) —
 * своя на кожну вкладку. Підхопити й ЗНЯТИ чужу копію можна лише тоді, коли її
 * вкладка мертва: жива вкладка могла дописати дію між нашим читанням і видаленням —
 * і вона зникла б. Мертва вкладка писати вже не може, тож гонки немає.
 *
 * Кожна вкладка тримає Web Lock `wb-tab:<tabId>`, поки відкрита (браузер знімає
 * його при закритті, reload чи падінні). `navigator.locks.query()` показує, які
 * вкладки цього сайту живі. Немає Web Locks → `null`: «невідомо» — чужі копії
 * тоді підхоплюємо (дедуплікація op_id на сервері), але НЕ стираємо.
 */
const LOCK_PREFIX = 'wb-tab:'

interface LocksLike {
  request: (name: string, cb: () => Promise<void>) => Promise<unknown>
  query: () => Promise<{ held?: Array<{ name?: string }> }>
}

function locks(): LocksLike | null {
  const l = (globalThis.navigator as unknown as { locks?: LocksLike } | undefined)?.locks
  return l && typeof l.request === 'function' && typeof l.query === 'function' ? l : null
}

/** Тримати позначку «вкладка жива» до її закриття. */
export function holdTabLock(tabId: string): void {
  const l = locks()
  if (!l) return
  l.request(`${LOCK_PREFIX}${tabId}`, () => new Promise<void>(() => {})).catch((err) => {
    console.warn('[WB:tabLiveness] lock request failed:', err)
  })
}

/** Живі вкладки цього сайту; `null` — невідомо (немає Web Locks або помилка). */
export async function liveTabIds(): Promise<Set<string> | null> {
  const l = locks()
  if (!l) return null
  try {
    const snap = await l.query()
    const ids = new Set<string>()
    for (const h of snap.held ?? []) {
      if (h?.name?.startsWith(LOCK_PREFIX)) ids.add(h.name.slice(LOCK_PREFIX.length))
    }
    return ids
  } catch (err) {
    console.warn('[WB:tabLiveness] lock query failed:', err)
    return null
  }
}

/** Вкладка з ключа копії: останній сегмент після `_` (tabId без `_`). */
export function tabOfKey(key: string): string {
  const i = key.lastIndexOf('_')
  return i >= 0 ? key.slice(i + 1) : key
}

/**
 * Чужу копію можна ПІДХОПИТИ: своя вкладка; мертва; або живість невідома
 * (тоді лише підхопити, не стирати — див. `mayRemove`).
 */
export function mayAdopt(key: string, ownTab: string, live: Set<string> | null): boolean {
  const tab = tabOfKey(key)
  if (tab === ownTab) return true
  return live === null || !live.has(tab)
}

/** Чужу копію можна СТЕРТИ лише коли точно відомо, що її вкладка мертва. */
export function mayRemove(key: string, ownTab: string, live: Set<string> | null): boolean {
  const tab = tabOfKey(key)
  if (tab === ownTab) return true
  return live !== null && !live.has(tab)
}
