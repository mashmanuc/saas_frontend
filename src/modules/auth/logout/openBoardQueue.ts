/**
 * Черга дошки, відкритої в цій вкладці, — для виходу (ТЗ спільного екрана, R7;
 * рецензія пакета A, знахідка 4; друга рецензія, знахідка 3).
 *
 * Навіщо: копія черги пишеться у сховище з секундною затримкою, а при смерті сесії й
 * при `beforeunload` черга з пам'яті пишеться знову. Без цього реєстру вихід (а) не бачив
 * останніх дій у переліку, (б) після ЯВНОГО відкидання вчителем копія відкритої дошки
 * одразу з'являлась знову — дії попереднього вчителя лишались у спільному браузері, і
 * (в) якщо копія не лягла у сховище (переповнене, приватний режим), черга в пам'яті не
 * потрапляла в перелік зовсім — дії губились без показаного числа.
 *
 * Модуль виходу не імпортує ops-стор дошки: рекордер відкритої дошки сам реєструє наявні
 * дії стору. Той самий підхід, що `registerAuthDeathCleanup`.
 */
import type { UnsentBoardWork } from './unsentWork'

export interface OpenBoardQueue {
  /** Дошка, чия черга зараз у пам'яті вкладки. */
  sessionId(): string | null
  /** Скільки дій у пам'яті ще не прийнято сервером. */
  pending(): number
  /** Сервер уже відмовив (`SAVE_BLOCKED`). */
  blocked(): boolean
  /** Черга → перевірена копія у сховищі зараз, а не за секундним таймером. */
  persist(): boolean
  /** Копія черги з пам'яті для завантаження вчителем (форма `m4sh-unsaved-board-ops`). */
  exportCopy(): Record<string, unknown>
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

/** Перед переліком незбережених дій: черга відкритої дошки — у сховище. `false` — не лягла. */
export function persistOpenBoardQueue(): boolean {
  if (!current) return true
  try {
    return current.pending() === 0 || current.persist()
  } catch (err) {
    console.warn('[auth:logout] open board queue not persisted', err)
    return false
  }
}

/**
 * Перелік з урахуванням черги в пам'яті: якщо її копія у сховище не лягла, дошка все
 * одно має бути в переліку з числом дій у пам'яті. Інакше вихід пройшов би без діалогу.
 */
export function withOpenBoardQueue(work: UnsentBoardWork[], persisted: boolean): UnsentBoardWork[] {
  if (persisted || !current) return work
  const sid = current.sessionId()
  const live = sid ? current.pending() : 0
  if (!sid || live === 0) return work
  const blocked = current.blocked()
  const existing = work.find(board => board.sessionId === sid)
  if (existing) {
    return work.map(board => (board === existing
      ? { ...board, ops: Math.max(board.ops, live), blocked: board.blocked || blocked, liveUnsaved: true }
      : board))
  }
  return [...work, { sessionId: sid, ops: live, keys: [], blocked, unreadable: false, liveUnsaved: true }]
}

/** Копія черги з пам'яті відкритої дошки — для завантаження; `null`, якщо дошка інша. */
export function exportOpenBoardQueue(sessionId: string): Record<string, unknown> | null {
  if (!current || current.sessionId() !== sessionId) return null
  try {
    return current.exportCopy()
  } catch (err) {
    console.warn('[auth:logout] open board queue not exported', err)
    return null
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
