/**
 * «Дзеркало уроку» — добір фото-станів сторінок із власного завершеного запису (ТЗ
 * `saas_docs/domains/winterboard/TZ_LESSON_MIRROR_VIDEO_PILOT_2026-10-09.md` §3).
 *
 * Джерело — лише незмінний запис: початковий стан (`start_state`, його `seq` = start_seq − 1) і
 * операції в межах `start_seq…end_seq` у порядку `seq`. Живий стан дошки не читаємо, нічого не пишемо.
 *
 * Сторінку операції визначає ТОЙ САМИЙ `createReplayApplier`, що й плеєр: ops проганяються крізь
 * нього над «скелетним» сховищем, яке знає лише сторінки (id, порядок, поточна). Так фото
 * потрапляє на ту сторінку, де його показує Replay, — з тією ж мапою id сторінок запису
 * (`_resolvePageId`: прямий збіг → уже зіставлений → позиційний → одна сторінка), без копії логіки.
 */
import type { BoardOperation, ReplayTimeline } from '../types/replay'
import type { Replay } from '../api/replayLifecycleApi'
import type { WBPageBackground } from '../types/winterboard'
import type { MirrorPhotoPage, MirrorPhotoState } from '../engine/lessonMirror/types'
import { createReplayApplier, type ReplayStoreApi } from '../engine/applyReplayOperation'
import { isImageBackground } from '../board/pageBackground'

/** Дані запису так, як їх отримує плеєр: playback (`start_state`, `operations`) + сам запис (межі). */
export type MirrorPhotoSource =
  Pick<ReplayTimeline, 'start_state' | 'operations'> & Pick<Replay, 'start_seq' | 'end_seq'>

/**
 * Ops, чий `payload` визначає сторінки (склад, порядок, поточна) або фон. Решті payload не
 * потрібен: сторінку applier визначає за `op.page_id`, а вміст об'єктів скелету байдужий.
 * Порожній payload ще й не дає applier-у змінювати вхідні дані (штамп `graph_calculator`).
 */
const PAGE_PAYLOAD_OPS: ReadonlySet<string> = new Set([
  'page_add', 'page_navigate', 'page_change', 'page_delete', 'page_reorder', 'pdf_import',
  'background_update',
])

/** Межа сторінок у `boardStore.addPage` — скелет поводиться так само, інакше розійдеться мапа id. */
const MAX_PAGES = 50

const isSeq = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

type PageRef = { id: string }

export function collectMirrorPhotoPages(input: MirrorPhotoSource): MirrorPhotoPage[] {
  const { start_seq: startSeq, end_seq: endSeq } = input
  // Без меж це не завершений запис — фото-станів не добираємо.
  if (!isSeq(startSeq) || !isSeq(endSeq) || endSeq < startSeq) return []

  const ops = (input.operations ?? [])
    .filter((op): op is BoardOperation & { seq: number } =>
      isSeq(op.seq) && op.seq >= startSeq && op.seq <= endSeq)
    .slice()
    .sort((a, b) => a.seq - b.seq)

  // Стани за сторінкою, у порядку появи (seq зростає: спершу start_state, далі ops за порядком).
  const statesByPage = new Map<string, MirrorPhotoState[]>()
  // Позиція сторінки в мить її останнього фото — на випадок, якщо до кінця запису її видалили.
  const lastIndexByPage = new Map<string, number>()
  let currentSeq = startSeq - 1

  // ── Скелет сховища: той самий початок, що в WBPublicView.resetBoardForReplay ──
  // Без start_state сховище після resetForReplay має одну порожню сторінку з новим id.
  const startPages = input.start_state && Array.isArray(input.start_state.pages)
    ? (input.start_state.pages as Array<{ id?: unknown; background?: unknown } | null>)
    : null
  let newPageCounter = 0
  const newPageId = (): string => `__mirror_skeleton_page_${newPageCounter++}`

  const skeleton = {
    pages: (startPages
      ? startPages.map(p => ({ id: typeof p?.id === 'string' ? p.id : '' }))
      : [{ id: newPageId() }]) as PageRef[],
    currentPageIndex: 0,
  }

  function record(pageId: string, url: string): void {
    const list = statesByPage.get(pageId) ?? []
    list.push({ seq: currentSeq, url })
    statesByPage.set(pageId, list)
    lastIndexByPage.set(pageId, skeleton.pages.findIndex(p => p.id === pageId))
  }

  // Початковий фон кожної сторінки запису — перший стан (seq = start_seq − 1).
  if (startPages) {
    startPages.forEach((p, i) => {
      const id = skeleton.pages[i].id
      const bg = p?.background
      if (id && isImageBackground(bg)) record(id, bg.url)
    })
  }

  const noop = (): void => {}
  const store: ReplayStoreApi = {
    get pages() { return skeleton.pages },
    // `page_reorder` у applier присвоює `store.pages` напряму.
    set pages(next: PageRef[]) { skeleton.pages = next },
    get currentPageIndex() { return skeleton.currentPageIndex },
    set currentPageIndex(i: number) { skeleton.currentPageIndex = i },
    addPage() {
      if (skeleton.pages.length >= MAX_PAGES) return
      skeleton.pages = [...skeleton.pages, { id: newPageId() }]
    },
    goToPage(index: number) {
      if (!Number.isFinite(index)) return
      skeleton.currentPageIndex = Math.max(0, Math.min(skeleton.pages.length - 1, index))
    },
    // Ті самі правила, що boardStore.placeReplayedPage / deletePage.
    placeReplayedPage(pageId: string, insertAt: number | undefined, keepPageId: string | null) {
      const from = skeleton.pages.findIndex(p => p.id === pageId)
      if (from === -1) return
      if (typeof insertAt === 'number' && Number.isInteger(insertAt) && insertAt >= 0 && insertAt < from) {
        const copy = [...skeleton.pages]
        const [page] = copy.splice(from, 1)
        copy.splice(insertAt, 0, page)
        skeleton.pages = copy
      }
      const idx = skeleton.pages.findIndex(p => p.id === (keepPageId ?? pageId))
      if (idx !== -1) skeleton.currentPageIndex = idx
    },
    deletePage(index: number) {
      if (skeleton.pages.length <= 1) return
      if (index < 0 || index >= skeleton.pages.length) return
      skeleton.pages = skeleton.pages.filter((_, i) => i !== index)
      if (skeleton.currentPageIndex >= skeleton.pages.length) {
        skeleton.currentPageIndex = skeleton.pages.length - 1
      } else if (skeleton.currentPageIndex > index) {
        skeleton.currentPageIndex--
      }
    },
    // Фон: як boardStore.setPageBackground — сторінка за id або поточна. Беремо лише фото.
    setPageBackground(background: WBPageBackground, pageId?: string) {
      const page = pageId
        ? skeleton.pages.find(p => p.id === pageId)
        : skeleton.pages[skeleton.currentPageIndex]
      if (!page || !isImageBackground(background)) return
      record(page.id, background.url)
    },
    // Вміст сторінок скелету не потрібен.
    addStroke: noop, updateStroke: noop, deleteStroke: noop,
    addAsset: noop, updateAsset: noop, deleteAsset: noop,
    clearPage: noop, setGridSize: noop, updateCurrentPageGrid: noop, setBackgroundColor: noop,
    createGroup: noop, deleteGroup: noop, lockItems: noop, unlockItems: noop,
    bringForward: noop, sendBackward: noop, bringToFront: noop, sendToBack: noop,
    setObjectText: noop,
  }

  const applier = createReplayApplier()
  // Плеєр повідомляє applier про сторінки лише тоді, коли запис має start_state.
  if (startPages) applier.markPagesEnsured(skeleton.pages.map(p => p.id).filter(Boolean))

  for (const op of ops) {
    currentSeq = op.seq
    applier.apply(store, PAGE_PAYLOAD_OPS.has(op.op_type) ? op : { ...op, payload: {} })
  }

  const result: Array<MirrorPhotoPage & { order: number; firstSeq: number }> = []
  for (const [pageId, raw] of statesByPage) {
    // Сусідні стани з тим самим фото — один стан (повторна постановка того ж знімка).
    const states = raw.filter((s, i) => i === 0 || s.url !== raw[i - 1].url)
    if (states.length < 2) continue
    const finalIndex = skeleton.pages.findIndex(p => p.id === pageId)
    const order = finalIndex >= 0 ? finalIndex : (lastIndexByPage.get(pageId) ?? 0)
    result.push({ pageId, label: `${order + 1}`, states, order, firstSeq: states[0].seq })
  }
  return result
    .sort((a, b) => a.order - b.order || a.firstSeq - b.firstSeq)
    .map(({ pageId, label, states }) => ({ pageId, label, states }))
}
