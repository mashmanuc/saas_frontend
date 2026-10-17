/**
 * LAW §9 v1.29 · розв'язок задачі рукою на дошці (власник 2026-10-17: «діти розв'язують на
 * екрані, а тоді вчитель на пультові натискає і розв'язок писаними пишеться, і дітки переписують»).
 *
 * Пише клієнт учителя — штатними `stroke_add` через стор (єдиний писар §2), по штриху в темпі
 * руки. Сервер лише обчислює штрихи під вільну область (`/v1/handwriting/solution/`, стан дошки
 * не чіпає). Увесь розв'язок — ОДИН крок «Скасувати»; скасування посеред письма зупиняє письмо й
 * прибирає написане. Дошка/сторінка змінилась, редагування заблоковано — письмо зупиняється.
 */
import apiClient from '@/utils/apiClient'
import { i18n } from '@/i18n'
import { notifyError, notifyInfo, notifyWarning } from '@/utils/notify'
import {
  HANDWRITE_INK, PAGE_OBJECT_LIMIT, answerTextOf, hasHandwritableSolution, occupiedRects,
  wholePageArea, writingAreasNear, type Rect,
} from '../board/handwriteSolution'
import type { WBStroke } from '../types/winterboard'

export interface HandwriteLayoutRequest { text: string; width: number; height: number; mode: 'steps' | 'full'; answer: string }
export type HandwriteLayout =
  | { fits: true; scale: number; size: number; w: number; h: number; duration_ms: number; strokes: Array<{ p: number[][]; t: number }> }
  | { fits: false; needed_height: number | null }

/** 422 від сервера: перекладач цієї конструкції не знає — розбір лишається друкованим. */
export class HandwriteUnsupported extends Error {}

export type HandwriteResult =
  | { status: 'written'; strokes: number; pageId: string; newPage: boolean }
  | { status: 'stopped'; written: number }
  | { status: 'unsupported'; detail: string }
  | { status: 'busy' | 'blocked' | 'no_solution' | 'no_space' }

interface PageLike { id: string; width?: number; height?: number; assets: any[]; strokes: any[] }

export interface HandwriteStore {
  mode: string
  workspaceId: string | null
  currentPageIndex: number
  pages: PageLike[]
  undoStack: Array<{ apply: () => void; revert: () => void }>
  redoStack: Array<{ apply: () => void; revert: () => void }>
  addStroke: (stroke: WBStroke, opts?: { skipHistory?: boolean; pageId?: string }) => void
  deleteStroke: (id: string, opts?: { skipHistory?: boolean }) => void
  addPageUndoable: (opts?: { afterCurrent?: boolean }) => string
}

export interface HandwriteDeps {
  store: HandwriteStore
  sync: { mode: string; inputLocked: boolean }
  fetchLayout: (req: HandwriteLayoutRequest) => Promise<HandwriteLayout>
  schedule: (fn: () => void, ms: number) => () => void
}

const MAX_UNDO = 100
let active: { stop: () => void } | null = null
let seq = 0

/** Чи пише зараз рукопис (одна дошка — один рукопис за раз). */
export function isHandwriting(): boolean { return active !== null }

/** Зупинити поточне письмо (вихід з кімнати). Написане лишається — його прибирає «Скасувати». */
export function stopHandwriting(): void { active?.stop() }

async function defaultFetchLayout(req: HandwriteLayoutRequest): Promise<HandwriteLayout> {
  try {
    return await apiClient.post('/v1/handwriting/solution/', req) as unknown as HandwriteLayout
  } catch (err: any) {
    if (err?.response?.status === 422) throw new HandwriteUnsupported(String(err.response?.data?.detail ?? ''))
    throw err
  }
}

async function defaultDeps(): Promise<HandwriteDeps> {
  const { useWBStore } = await import('../board/state/boardStore')
  const { useOpsSyncStore } = await import('../stores/opsSyncStore')
  return {
    store: useWBStore() as unknown as HandwriteStore,
    sync: useOpsSyncStore() as unknown as { mode: string; inputLocked: boolean },
    fetchLayout: defaultFetchLayout,
    schedule: (fn, ms) => { const h = setTimeout(fn, ms); return () => clearTimeout(h) },
  }
}

/**
 * Написати розв'язок картки задачі рукою біля неї. Повертає, чим скінчилось; не кидає на
 * звичайних відмовах (немає розв'язку, зайнято, заблоковано, не влізло, перекладач не знає).
 */
export async function handwriteTaskSolution(
  asset: { id: string; type?: string; x: number; y: number; w: number; h: number; data?: any },
  depsIn?: HandwriteDeps,
): Promise<HandwriteResult> {
  if (active) return { status: 'busy' }
  if (!hasHandwritableSolution(asset)) return { status: 'no_solution' }
  const deps = depsIn ?? await defaultDeps()
  const { store, sync } = deps
  const boardId = store.workspaceId
  const page = store.pages[store.currentPageIndex]
  const writable = () => store.mode === 'edit' && sync.mode === 'SYNC' && !sync.inputLocked && store.workspaceId === boardId
  if (!page || !writable()) return { status: 'blocked' }

  const pageW = page.width ?? 1920
  const pageH = page.height ?? 1080
  const req = (area: Rect): HandwriteLayoutRequest => ({
    text: String(asset.data.solution), width: Math.floor(area.w), height: Math.floor(area.h),
    mode: 'steps', answer: answerTextOf(asset.data),
  })

  // Сторінку займає те, що на ній є зараз; лічильник об'єктів — як у `canAddObject`.
  let chosen: { area: Rect; layout: Extract<HandwriteLayout, { fits: true }>; newPage: boolean } | null = null
  try {
    const task: Rect = { x: asset.x, y: asset.y, w: asset.w, h: asset.h }
    for (const area of writingAreasNear(task, occupiedRects(page), pageW, pageH)) {
      const layout = await deps.fetchLayout(req(area))
      if (layout.fits && page.strokes.length + page.assets.length + layout.strokes.length <= PAGE_OBJECT_LIMIT) {
        chosen = { area, layout, newPage: false }
        break
      }
    }
    if (!chosen) {
      const area = wholePageArea(pageW, pageH)
      const layout = await deps.fetchLayout(req(area))
      if (layout.fits && layout.strokes.length <= PAGE_OBJECT_LIMIT) chosen = { area, layout, newPage: true }
    }
  } catch (err) {
    if (err instanceof HandwriteUnsupported) return { status: 'unsupported', detail: err.message }
    throw err
  }
  if (!chosen) return { status: 'no_space' }
  // Поки йшов запит, дошка, сторінка чи режим могли змінитись — тоді нічого не пишемо.
  if (!writable() || store.pages[store.currentPageIndex]?.id !== page.id) return { status: 'blocked' }

  let pageId = page.id
  if (chosen.newPage) {
    pageId = store.addPageUndoable({ afterCurrent: true })
    if (!pageId) return { status: 'no_space' }
  }

  const { area, layout } = chosen
  const run = ++seq
  const strokes: WBStroke[] = layout.strokes.map((s, i) => ({
    id: `hw-${Date.now().toString(36)}-${run}-${i}`,
    tool: 'pen',
    color: HANDWRITE_INK,
    size: layout.size,
    opacity: 1,
    points: s.p.map(([x, y]) => ({ x: Math.round((x + area.x) * 10) / 10, y: Math.round((y + area.y) * 10) / 10 })),
  }) as WBStroke)
  const times = layout.strokes.map((s) => s.t)

  return new Promise<HandwriteResult>((resolve) => {
    let written = 0
    let stopped = false
    let cancelTimer: (() => void) | null = null
    const finish = (result: HandwriteResult) => {
      if (active === handle) active = null
      resolve(result)
    }
    const stop = () => {
      if (stopped) return
      stopped = true
      cancelTimer?.()
      finish({ status: 'stopped', written })
    }
    const handle = { stop }
    active = handle

    // Один крок «Скасувати» на весь розв'язок — кладемо одразу, щоб і скасування посеред
    // письма прибрало написане й зупинило руку; «Повернути» кладе розв'язок цілим.
    store.undoStack = [...store.undoStack, {
      apply: () => { for (const s of strokes) store.addStroke(s, { skipHistory: true, pageId }) },
      revert: () => { stop(); for (const s of strokes) store.deleteStroke(s.id, { skipHistory: true }) },
    }].slice(-MAX_UNDO)
    store.redoStack = []

    const tick = (i: number) => {
      if (stopped) return
      if (!writable() || store.pages[store.currentPageIndex]?.id !== pageId) { stop(); return }
      store.addStroke(strokes[i], { skipHistory: true, pageId })
      written = i + 1
      if (written >= strokes.length) {
        finish({ status: 'written', strokes: written, pageId, newPage: chosen!.newPage })
        return
      }
      cancelTimer = deps.schedule(() => tick(i + 1), Math.max(0, times[i + 1] - times[i]))
    }
    cancelTimer = deps.schedule(() => tick(0), Math.max(0, times[0] ?? 0))
  })
}

function tr(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(`winterboard.handwrite.${key}`)
}

/**
 * Те саме з поясненням для вчителя (ноутбук і пульт). Коли рукою не вийшло — розбір
 * показується друкованим (`revealPrinted`, як «Показати розбір»), щоб учні не лишились без нього.
 */
export async function handwriteWithFeedback(
  asset: Parameters<typeof handwriteTaskSolution>[0],
  revealPrinted: () => void,
  depsIn?: HandwriteDeps,
): Promise<HandwriteResult | null> {
  let result: HandwriteResult
  try {
    result = await handwriteTaskSolution(asset, depsIn)
  } catch (err: any) {
    // Мережа й 5xx уже показав apiClient; тут — лише те, чого він не бачив.
    console.error('[WB:handwrite] failed', err)
    if (!err?.response) notifyError(tr('error'))
    return null
  }
  switch (result.status) {
    case 'unsupported': revealPrinted(); notifyInfo(tr('unsupported')); break
    case 'no_space': revealPrinted(); notifyWarning(tr('noSpace')); break
    case 'busy': notifyInfo(tr('busy')); break
    case 'blocked': notifyWarning(tr('blocked')); break
    case 'no_solution': notifyInfo(tr('noSolution')); break
    default: break
  }
  return result
}
