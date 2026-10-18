/**
 * LAW §9 v1.29 · розв'язок задачі рукою на дошці (власник 2026-10-17: «діти розв'язують на
 * екрані, а тоді вчитель на пультові натискає і розв'язок писаними пишеться, і дітки переписують»).
 *
 * Пише клієнт учителя — штатними `stroke_add` через стор (єдиний писар §2), по штриху в темпі
 * руки. Сервер лише обчислює штрихи під вільну область (`/v1/handwriting/solution/`, стан дошки
 * не чіпає). Увесь розв'язок — ОДИН крок «Скасувати»; скасування посеред письма зупиняє письмо й
 * прибирає написане. Дошка/сторінка змінилась, редагування заблоковано — письмо зупиняється.
 *
 * Етап 1 (власник 2026-10-18: «має бути виділена картка і інтегралик розв'язує… і тоді він це вже
 * пише»; «PDF → вирізав задачу → розв'язати поруч»): задача без розв'язку, картка чи картинка
 * (вирізка з PDF) — розв'язок дає Інтегралик (`/v1/handwriting/solve/`; умову сервер бере з
 * канонічного стану дошки за id об'єкта, не з браузера), далі той самий шлях письма.
 */
import { ref } from 'vue'
import apiClient from '@/utils/apiClient'
import { i18n } from '@/i18n'
import { notifyError, notifyInfo, notifyWarning } from '@/utils/notify'
import { tAssistantGlobal } from '@/modules/intent/assistantLook'
import {
  HANDWRITE_INK, PAGE_OBJECT_LIMIT, answerTextOf, hasHandwritableSolution, isIntegralykSolvable,
  occupiedRects, wholePageArea, writingAreasNear, type Rect,
} from '../board/handwriteSolution'
import type { WBStroke } from '../types/winterboard'

export interface HandwriteLayoutRequest {
  text: string; width: number; height: number; mode: 'steps' | 'full'; answer: string
  /** Умова задачі в лівому верхньому куті області — текст її обтікає (нова сторінка). */
  float?: { w: number; h: number }
}
export type HandwriteLayout =
  | { fits: true; scale: number; size: number; w: number; h: number; duration_ms: number; strokes: Array<{ p: number[][]; t: number }> }
  | { fits: false; needed_height: number | null }

/** 422 від сервера: перекладач цієї конструкції не знає — розбір лишається друкованим. */
export class HandwriteUnsupported extends Error {}

/** Чесні відмови розв'язку Інтегралика (тіло відповіді `/solve/`: `{error}`). */
export type SolveRefusal = 'no_task' | 'unsure' | 'mismatch' | 'not_readable' | 'unsupported' | 'solver_unavailable'
export type SolveOutcome = { text: string; answer: string } | { error: SolveRefusal }

export type HandwriteResult =
  | { status: 'written'; strokes: number; pageId: string; newPage: boolean; copiedTaskId?: string }
  | { status: 'stopped'; written: number }
  | { status: 'unsupported'; detail: string }
  | { status: 'busy' | 'blocked' | 'no_solution' | 'no_space' }
  | { status: Exclude<SolveRefusal, 'unsupported'> }

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
  addAsset: (asset: any, pageId: string, opts?: { skipHistory?: boolean }) => void
  deleteAsset: (id: string, opts?: { skipHistory?: boolean }) => void
}

export interface HandwriteDeps {
  store: HandwriteStore
  sync: { mode: string; inputLocked: boolean }
  fetchLayout: (req: HandwriteLayoutRequest) => Promise<HandwriteLayout>
  /** Етап 1: розв'язок Інтегралика для об'єкта дошки. */
  fetchSolve?: (boardId: string, objectId: string) => Promise<SolveOutcome>
  schedule: (fn: () => void, ms: number) => () => void
}

type AnchorAsset = { id: string; type?: string; src?: unknown; x: number; y: number; w: number; h: number; data?: any }

const MAX_UNDO = 100
/**
 * Зір (до 25 с) + розв'язувач (до 30 с) + один перепит — довше за типові 30 с `apiClient`.
 * Сервер сам не перепитує, якщо перший виклик був довгим (`solve.REASK_IF_FASTER_THAN`).
 */
const SOLVE_TIMEOUT_MS = 90_000
const SOLVE_REFUSALS: ReadonlySet<string> = new Set(['no_task', 'unsure', 'mismatch', 'not_readable', 'unsupported'])

let active: { stop: () => void } | null = null
let seq = 0

/**
 * Що зараз розв'язується чи пишеться (id об'єкта) — значок ✍ цього об'єкта пульсує й не
 * натискається. Одна дошка — один рукопис за раз: інші ✍ відповідають «Уже пишу».
 */
export const handwriteBusyId = ref<string | null>(null)

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

async function defaultFetchSolve(boardId: string, objectId: string): Promise<SolveOutcome> {
  try {
    const res = await apiClient.post('/v1/handwriting/solve/', { board_id: boardId, object_id: objectId },
      { timeout: SOLVE_TIMEOUT_MS }) as unknown as { text?: unknown; answer?: unknown }
    return { text: String(res?.text ?? ''), answer: String(res?.answer ?? '') }
  } catch (err: any) {
    const code = String(err?.response?.data?.error ?? '')
    if (SOLVE_REFUSALS.has(code)) return { error: code as SolveRefusal }
    // 503: розв'язувач не відповів — загальне повідомлення вже показав apiClient.
    if (err?.response?.status === 503) return { error: 'solver_unavailable' }
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
    fetchSolve: defaultFetchSolve,
    schedule: (fn, ms) => { const h = setTimeout(fn, ms); return () => clearTimeout(h) },
  }
}

/** Одна операція за раз на всю дошку: від натискання до останнього штриха (чи відмови). */
async function exclusive(assetId: string, run: () => Promise<HandwriteResult>): Promise<HandwriteResult> {
  if (active || handwriteBusyId.value !== null) return { status: 'busy' }
  handwriteBusyId.value = assetId
  try {
    return await run()
  } finally {
    handwriteBusyId.value = null
  }
}

/**
 * Написати розв'язок картки задачі рукою біля неї. Повертає, чим скінчилось; не кидає на
 * звичайних відмовах (немає розв'язку, зайнято, заблоковано, не влізло, перекладач не знає).
 */
export async function handwriteTaskSolution(asset: AnchorAsset, depsIn?: HandwriteDeps): Promise<HandwriteResult> {
  if (active || handwriteBusyId.value !== null) return { status: 'busy' }
  if (!hasHandwritableSolution(asset)) return { status: 'no_solution' }
  return exclusive(asset.id, async () => writeSolution(
    asset, { text: String(asset.data.solution), answer: answerTextOf(asset.data) }, depsIn ?? await defaultDeps()))
}

/**
 * ✍ на виділеному: задача з розв'язком у даних — пишемо його (моделі не треба); інакше розв'язує
 * Інтегралик і розв'язок пишеться тим самим шляхом. Поки йде розв'язування — `handwriteBusyId`.
 */
export async function solveAndHandwrite(asset: AnchorAsset, depsIn?: HandwriteDeps): Promise<HandwriteResult> {
  if (hasHandwritableSolution(asset)) return handwriteTaskSolution(asset, depsIn)
  if (active || handwriteBusyId.value !== null) return { status: 'busy' }
  if (!isIntegralykSolvable(asset)) return { status: 'no_solution' }
  return exclusive(asset.id, async () => {
    const deps = depsIn ?? await defaultDeps()
    const boardId = deps.store.workspaceId
    if (!boardId || deps.store.mode !== 'edit') return { status: 'blocked' }
    const solved = await (deps.fetchSolve ?? defaultFetchSolve)(boardId, asset.id)
    if ('error' in solved) {
      return solved.error === 'unsupported' ? { status: 'unsupported', detail: '' } : { status: solved.error }
    }
    // Поки Інтегралик розв'язував, учитель міг перейти на іншу дошку.
    if (deps.store.workspaceId !== boardId) return { status: 'blocked' }
    return writeSolution(asset, solved, deps)
  })
}

/** Текст розв'язку → рукопис біля об'єкта на поточній сторінці (або на новій — з копією об'єкта). */
async function writeSolution(
  anchor: AnchorAsset, solved: { text: string; answer: string }, deps: HandwriteDeps,
): Promise<HandwriteResult> {
  const { store, sync } = deps
  const boardId = store.workspaceId
  const page = store.pages[store.currentPageIndex]
  const writable = () => store.mode === 'edit' && sync.mode === 'SYNC' && !sync.inputLocked && store.workspaceId === boardId
  if (!page || !writable()) return { status: 'blocked' }
  // Об'єкт — той, що на поточній сторінці зараз: його могли пересунути чи прибрати, поки йшов
  // розв'язок, а сторінку — перегорнути.
  const asset = page.assets.find((a) => a?.id === anchor.id) as AnchorAsset | undefined
  if (!asset) return { status: 'blocked' }

  const pageW = page.width ?? 1920
  const pageH = page.height ?? 1080
  const req = (area: Rect, float?: { w: number; h: number }): HandwriteLayoutRequest => ({
    text: solved.text, width: Math.floor(area.w), height: Math.floor(area.h),
    mode: 'steps', answer: solved.answer, ...(float ? { float } : {}),
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
    // Біля задачі місця немає — нова сторінка, і туди ж копія умови (власник 17.10: «треба і умову
    // переносити, а розв'язок описувати кругом умови»): умова в лівому верхньому куті, рукопис її обтікає.
    if (!chosen) {
      const area = wholePageArea(pageW, pageH)
      // Копія стає в кут з полем; висока задача може сягати майже низу сторінки — тоді рукопис лише праворуч.
      if (asset.w <= area.w && area.y + asset.h <= pageH - 20) {
        const layout = await deps.fetchLayout(req(area, { w: Math.ceil(asset.w), h: Math.ceil(asset.h) }))
        if (layout.fits && layout.strokes.length + 1 <= PAGE_OBJECT_LIMIT) chosen = { area, layout, newPage: true }
      }
    }
  } catch (err) {
    if (err instanceof HandwriteUnsupported) return { status: 'unsupported', detail: err.message }
    throw err
  }
  if (!chosen) return { status: 'no_space' }
  // Поки йшов запит, дошка, сторінка чи режим могли змінитись — тоді нічого не пишемо.
  if (!writable() || store.pages[store.currentPageIndex]?.id !== page.id) return { status: 'blocked' }

  let pageId = page.id
  let copy: any = null
  if (chosen.newPage) {
    pageId = store.addPageUndoable({ afterCurrent: true })
    if (!pageId) return { status: 'no_space' }
    // Копія, а не перенос (власник 17.10): задача лишається на своїй сторінці. Відповідь і розбір
    // у копії картки задачі сховані — їх і пише рука; картка й картинка копіюються як є.
    copy = {
      ...asset, id: `tsk-hw-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      x: chosen.area.x, y: chosen.area.y,
      ...(asset.type === 'nmt_task' ? { data: { ...(asset.data || {}), showAnswer: false, showSolution: false } } : {}),
    }
    store.addAsset(copy, pageId, { skipHistory: true })
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
      apply: () => {
        if (copy) store.addAsset(copy, pageId, { skipHistory: true })
        for (const s of strokes) store.addStroke(s, { skipHistory: true, pageId })
      },
      revert: () => {
        stop()
        for (const s of strokes) store.deleteStroke(s.id, { skipHistory: true })
        if (copy) store.deleteAsset(copy.id, { skipHistory: true })
      },
    }].slice(-MAX_UNDO)
    store.redoStack = []

    const tick = (i: number) => {
      if (stopped) return
      if (!writable() || store.pages[store.currentPageIndex]?.id !== pageId) { stop(); return }
      store.addStroke(strokes[i], { skipHistory: true, pageId })
      written = i + 1
      if (written >= strokes.length) {
        finish({ status: 'written', strokes: written, pageId, newPage: chosen!.newPage, ...(copy ? { copiedTaskId: copy.id } : {}) })
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

/**
 * ✍ на виділеному (етап 1) з поясненням для вчителя. Розв'язок у даних задачі — як
 * `handwriteWithFeedback`; розв'язок Інтегралика друкованого відповідника не має — тоді лише
 * пояснення словами, чому рукою не написано.
 */
export async function solveWithFeedback(
  asset: AnchorAsset,
  revealPrinted: () => void,
  depsIn?: HandwriteDeps,
): Promise<HandwriteResult | null> {
  if (hasHandwritableSolution(asset)) return handwriteWithFeedback(asset, revealPrinted, depsIn)
  if (!active && handwriteBusyId.value === null && isIntegralykSolvable(asset)) {
    notifyInfo(tAssistantGlobal('winterboard.handwrite.solving'))
  }
  let result: HandwriteResult
  try {
    result = await solveAndHandwrite(asset, depsIn)
  } catch (err: any) {
    console.error('[WB:handwrite] solve failed', err)
    // Мережу, 403 і 5xx уже показав apiClient; решту відповідей (404 вимкненого на сервері
    // Інтегралика, 429 ліміту) він мовчки пропускає — тоді кажемо тут, щоб натискання не зникло.
    // Не мережева помилка (вада коду) — теж тут.
    const status = Number(err?.response?.status ?? 0)
    if (err?.isAxiosError !== true || (err.response && status !== 403 && status < 500)) notifyError(tr('error'))
    return null
  }
  switch (result.status) {
    case 'unsupported': notifyInfo(tr('unsupportedSolved')); break
    case 'no_space': notifyWarning(tr('noSpaceSolved')); break
    case 'busy': notifyInfo(tr('busy')); break
    case 'blocked': notifyWarning(tr('blocked')); break
    case 'no_task': notifyInfo(tAssistantGlobal('winterboard.handwrite.noTask')); break
    // Картинку Інтегралик читав сам — прочитане можна виправити в «Що прочитав Інтегралик».
    case 'unsure': notifyWarning(asset.type === 'image' ? tAssistantGlobal('winterboard.handwrite.unsureImage') : tr('unsure')); break
    case 'mismatch': notifyWarning(tr('mismatch')); break
    case 'not_readable': notifyWarning(tAssistantGlobal('winterboard.handwrite.notReadable')); break
    default: break
  }
  return result
}
