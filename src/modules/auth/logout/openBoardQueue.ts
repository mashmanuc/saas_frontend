/**
 * Черга дошки, відкритої в цій вкладці, — для виходу (ТЗ спільного екрана, R7;
 * рецензія пакета A, знахідка 4).
 *
 * Навіщо: копія черги пишеться у сховище з секундною затримкою, а при смерті сесії й
 * при `beforeunload` черга з пам'яті пишеться знову. Без цього реєстру вихід (а) не бачив
 * останніх дій у переліку і (б) після ЯВНОГО відкидання вчителем копія відкритої дошки
 * одразу з'являлась знову — дії попереднього вчителя лишались у спільному браузері.
 *
 * Модуль виходу не імпортує ops-стор дошки: рекордер відкритої дошки сам реєструє, як
 * зберегти чергу і як відкинути її з пам'яті (обидва — наявні дії стору). Той самий
 * підхід, що `registerAuthDeathCleanup`.
 */

export interface OpenBoardQueue {
  /** Дошка, чия черга зараз у пам'яті вкладки. */
  sessionId(): string | null
  /** Черга → перевірена копія у сховищі зараз, а не за секундним таймером. */
  persist(): boolean
  /** Явне відкидання вчителем при виході: черга геть із пам'яті (копії прибирає вихід). */
  abandon(): void
}

let current: OpenBoardQueue | null = null

export function registerOpenBoardQueue(queue: OpenBoardQueue): () => void {
  current = queue
  return () => {
    if (current === queue) current = null
  }
}

/** Перед переліком незбережених дій: черга відкритої дошки — у сховище. */
export function persistOpenBoardQueue(): void {
  if (!current) return
  try {
    current.persist()
  } catch (err) {
    console.warn('[auth:logout] open board queue not persisted', err)
  }
}

/** Відкинути з пам'яті чергу відкритої дошки, якщо вчитель відкинув саме її. */
export function abandonOpenBoardQueue(sessionIds: readonly string[]): void {
  if (!current) return
  const sid = current.sessionId()
  if (!sid || !sessionIds.includes(sid)) return
  try {
    current.abandon()
  } catch (err) {
    console.error('[auth:logout] open board queue not abandoned', err)
  }
}

/**
 * Інші вкладки цього браузера: відкинути в них чергу тих самих дошок. Подія `storage`
 * приходить лише в ІНШІ вкладки; ключ одразу прибирається — це сигнал, а не стан.
 */
export const DISCARD_BROADCAST_KEY = 'm4sh_logout_discard'

export function broadcastDiscard(sessionIds: readonly string[]): void {
  try {
    localStorage.setItem(DISCARD_BROADCAST_KEY, JSON.stringify({ ids: sessionIds, at: Date.now() }))
    localStorage.removeItem(DISCARD_BROADCAST_KEY)
  } catch (err) {
    console.warn('[auth:logout] discard not broadcast to other tabs', err)
  }
}

export function parseDiscardBroadcast(raw: string | null): string[] {
  if (!raw) return []
  try {
    const ids = (JSON.parse(raw) as { ids?: unknown })?.ids
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch (err) {
    console.warn('[auth:logout] unreadable discard broadcast', err)
    return []
  }
}
