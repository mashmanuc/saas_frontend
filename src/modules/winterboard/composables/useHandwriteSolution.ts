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
 *
 * LAW §9 v1.32 (власник 2026-10-18: «згоден з усіма чотирма, роби»): покроково з пульта — кожен натиск пише
 * один рядок (`handwriteNextStep`). Прогрес — зі штрихів сторінки (`board/handwriteSteps.ts`), не з пам'яті.
 *
 * LAW §9 v1.34 (2026-10-19, урок власника на мультимедійній дошці; ТЗ TZ_REMOTE_CURRENT_OBJECT §5 О6):
 *   • ✍ «увесь розв'язок» (ноутбук і пульт) — ті самі кроки з позначками, усі, що лишилися: обірване (перегорнули
 *     сторінку) наступний ✍ ДОПИСУЄ з того рядка на тому самому місці, а не пише вдруге на новій сторінці;
 *   • темп за годинником: штрих N — не раніше за свою мить; дошка відстала — усі прострочені штрихи разом, однією
 *     дією (на уроці 321 штрих розтягнувся на 2 хв 19 с: обробка штриха додавалась до кожної паузи).
 */
import { ref } from 'vue'
import apiClient from '@/utils/apiClient'
import { i18n } from '@/i18n'
import { notifyError, notifyInfo, notifyWarning } from '@/utils/notify'
import { tAssistantGlobal } from '@/modules/intent/assistantLook'
import {
  HANDWRITE_GAP, HANDWRITE_INK, HANDWRITE_MARGIN, HANDWRITE_MIN_W, LAYOUT_MAX_H, LAYOUT_MAX_W, PAGE_OBJECT_LIMIT,
  answerTextOf,
  dictationArea, hasHandwritableSolution, isIntegralykSolvable, notebookRuling, occupiedRects, wholePageArea,
  writingAreasNear, type Rect,
} from '../board/handwriteSolution'
import {
  STEP_SCALES, originalOfCopy, placeStep, sessionOf, shortHash, stepCopyId, stepGap, stepSessions, stepStrokeId,
  unfinishedSession,
} from '../board/handwriteSteps'
import type { WBStroke } from '../types/winterboard'
import { dictationFromLayout } from '../board/dictationFromLayout'
import { revealDictation } from '../board/dictationReveal'
import { selectQuietly } from '../board/quietSelection'

export interface HandwriteLayoutRequest {
  text: string; width: number; height: number; mode: 'steps' | 'full'; answer: string
  /** Умова задачі в лівому верхньому куті області — текст її обтікає (нова сторінка). */
  float?: { w: number; h: number }
  /** v1.32: писати рівно цим розміром (покроково — один розмір на весь розв'язок). */
  scale?: number
  /** v1.49: почерк — закритий набір сервера (`apps/handwriting` `HANDS`); без поля — 'classic', як було. */
  hand?: HandwriteHand
  /** v1.51: лінії зошита (координати області) — рядки сідають на них; відповідь — layout v1. */
  ruling?: { first_baseline: number; pitch: number; x_height: number; left: number; right: number; align: DictateAlign; slant?: number }
  /** v1.51: layout v1 без зошита (біла дошка) — рівне письмо, координати від кута області. */
  tokens?: boolean
  /** v1.51: вирівнювання рядків у layout v1 без зошита. */
  align?: DictateAlign
}
export type DictateAlign = 'left' | 'center'
export type HandwriteHand = 'classic' | 'school'
export type HandwriteLayout =
  | { fits: true; scale: number; size: number; w: number; h: number; duration_ms: number; strokes: Array<{ p: number[][]; t: number }>; steps?: string[] }
  | { fits: false; needed_height: number | null; steps?: string[] }

/** 422 від сервера: перекладач цієї конструкції не знає — розбір лишається друкованим. */
export class HandwriteUnsupported extends Error {}

/** Чесні відмови розв'язку Інтегралика (тіло відповіді `/solve/`: `{error}`). */
export type SolveRefusal = 'no_task' | 'many_tasks' | 'unsure' | 'mismatch' | 'not_readable' | 'unsupported' | 'solver_unavailable'
export type SolveOutcome = { text: string; answer: string } | { error: SolveRefusal }

/** Чим скінчилось письмо штрихів: дописано все чи зупинено (скасування, інша сторінка, дошка не пише). */
type DrawResult = { status: 'written'; strokes: number } | { status: 'stopped'; written: number }

interface PageLike { id: string; width?: number; height?: number; assets: any[]; strokes: any[] }

export interface HandwriteStore {
  mode: string
  workspaceId: string | null
  currentPageIndex: number
  pages: PageLike[]
  undoStack: Array<{ apply: () => void; revert: () => void }>
  redoStack: Array<{ apply: () => void; revert: () => void }>
  addStroke: (stroke: WBStroke, opts?: { skipHistory?: boolean; pageId?: string }) => void
  /** v1.34: кілька штрихів однією дією (`strokes_add_batch`) — коли рука наздоганяє годинник. */
  addStrokesBatchToPage?: (pageIndex: number, strokes: WBStroke[], opts?: { skipHistory?: boolean }) => void
  deleteStroke: (id: string, opts?: { skipHistory?: boolean }) => void
  addPageUndoable: (opts?: { afterCurrent?: boolean; inheritLook?: boolean }) => string
  addAsset: (asset: any, pageId: string, opts?: { skipHistory?: boolean }) => void
  deleteAsset: (id: string, opts?: { skipHistory?: boolean }) => void
  selectItems?: (ids: string[]) => void
  /** Висота, яку показує полотно на поточній сторінці (добірка задач буває вищою за аркуш). */
  currentPageCanvasHeight?: number
  /** Висота звичайного аркуша — її має нова сторінка. */
  pageHeight?: number
}

export interface HandwriteDeps {
  store: HandwriteStore
  sync: { mode: string; inputLocked: boolean }
  fetchLayout: (req: HandwriteLayoutRequest) => Promise<HandwriteLayout>
  /** Етап 1: розв'язок Інтегралика для об'єкта дошки. */
  fetchSolve?: (boardId: string, objectId: string) => Promise<SolveOutcome>
  schedule: (fn: () => void, ms: number) => () => void
  /** v1.34: годинник для темпу письма (мс); без нього — `performance.now()`. */
  now?: () => number
}

type AnchorAsset = { id: string; type?: string; src?: unknown; x: number; y: number; w: number; h: number; data?: any }

const MAX_UNDO = 100
/**
 * Зір + розв'язувач + можливий один перепит — довше за типові 30 с `apiClient`. Сервер укладається
 * приблизно в хвилину: перепитує, лише якщо від натискання минуло менше 30 с (`solve.REASK_IF_FASTER_THAN`).
 */
const SOLVE_TIMEOUT_MS = 90_000
const SOLVE_REFUSALS: ReadonlySet<string> = new Set(['no_task', 'many_tasks', 'unsure', 'mismatch', 'not_readable', 'unsupported'])

let active: { stop: () => void } | null = null
/** Рука пише зараз (реактивно — для стану пульта «пишу…»; `active` — звичайна змінна). */
const handNow = ref(false)

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

export interface SolveOptions {
  /**
   * Кімната дала право кликати Інтегралика (власник дошки з увімкненим Інтеграликом). Без нього задача
   * банку пишеться самими формулами (як до 18.10), а інше не пишеться зовсім.
   */
  canSolve?: boolean
}

function toStrokes(
  layout: Extract<HandwriteLayout, { fits: true }>, x0: number, y0: number, idOf: (i: number) => string,
): WBStroke[] {
  return layout.strokes.map((s, i) => ({
    id: idOf(i),
    tool: 'pen',
    color: HANDWRITE_INK,
    size: layout.size,
    opacity: 1,
    points: s.p.map(([x, y]) => ({ x: Math.round((x + x0) * 10) / 10, y: Math.round((y + y0) * 10) / 10 })),
  }) as WBStroke)
}

/**
 * Штрихи на сторінку `pageId` у темпі руки (`times` — мс від початку). Один крок «Скасувати» на весь виклик —
 * кладемо одразу, щоб і скасування посеред письма прибрало написане й зупинило руку; «Повернути» кладе цілим.
 * Дошка, сторінка чи режим змінились — письмо зупиняється.
 *
 * v1.34 темп за годинником: штрих N — не раніше за свою мить від початку, а якщо дошка відстала (обробка штриха
 * на слабкому пристрої довша за паузу) — усі прострочені штрихи кладуться разом однією дією. Пауза більше не
 * додається до обробки, тож розв'язок пишеться приблизно за задуманий час і на мультимедійній дошці.
 */
function drawStrokes(
  deps: HandwriteDeps, writable: () => boolean, pageId: string, strokes: WBStroke[], times: number[],
  copy: any, stepEnds: number[] = [],
): Promise<DrawResult> {
  const { store } = deps
  const now = deps.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
  return new Promise<DrawResult>((resolve) => {
    let written = 0
    let stopped = false
    let cancelTimer: (() => void) | null = null
    const finish = (result: DrawResult) => {
      if (active === handle) { active = null; handNow.value = false }
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
    handNow.value = true

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

    const put = (batch: WBStroke[]) => {
      const pageIndex = store.pages.findIndex((p) => p.id === pageId)
      if (batch.length > 1 && store.addStrokesBatchToPage && pageIndex >= 0) {
        store.addStrokesBatchToPage(pageIndex, batch, { skipHistory: true })
      } else {
        for (const s of batch) store.addStroke(s, { skipHistory: true, pageId })
      }
    }
    const t0 = now()
    const tick = () => {
      if (stopped) return
      if (!writable()) { stop(); return }
      if (store.pages[store.currentPageIndex]?.id !== pageId) {
        // v1.34: перегорнули посеред рядка — цей рядок дописуємо одразу (на його сторінку), щоб на дошці не лишилось
        // обрізаного рядка («кожного др…», урок 19.10); наступний ✍ продовжить з наступного рядка.
        const end = stepEnds.find((e) => e > written)
        if (end !== undefined && written > 0 && !stepEnds.includes(written) && store.pages.some((p) => p.id === pageId)) {
          put(strokes.slice(written, end))
          written = end
        }
        stop()
        return
      }
      // Щонайменше один штрих; відстали — ще й усі, чия мить уже минула.
      const elapsed = now() - t0
      let next = written + 1
      while (next < strokes.length && times[next] <= elapsed) next++
      put(strokes.slice(written, next))
      written = next
      if (written >= strokes.length) {
        finish({ status: 'written', strokes: written })
        return
      }
      cancelTimer = deps.schedule(tick, Math.max(0, times[written] - (now() - t0)))
    }
    cancelTimer = deps.schedule(tick, Math.max(0, times[0] ?? 0))
  })
}

// ── LAW §9 v1.32 · покроково з пульта ───────────────────────────────────────────────────────────────────────

export type StepReason = SolveRefusal | 'no_space' | 'blocked' | 'no_solution' | 'elsewhere' | 'error'

/** Стан для пульта (`remote.state.handwrite_step`): «Крок N з M», «готую…», «пишу…», «Готово», причина відмови. */
export interface StepState {
  status: 'idle' | 'preparing' | 'writing' | 'done' | 'refused'
  written: number
  total: number
  reason?: StepReason
  /** Є що писати наступним натиском (Р1) — пульт показує «✍️ Наступний рядок» і на сторінці без карток задач. */
  target?: boolean
}

export type StepResult =
  | { status: 'written'; from: number; to: number; total: number }
  | { status: 'done'; total: number }
  | { status: 'busy' }
  | { status: 'stopped' }
  | { status: 'refused'; reason: StepReason; detail?: string; image?: boolean }

export interface StepOptions extends SolveOptions {
  /** Р1, друге правило: один виділений на ноутбуці об'єкт. */
  selected?: AnchorAsset | null
  /** Р1, третє правило: як у `card.handwrite` — розгорнута / у фокусі пульта / перша задача. */
  fallback?: () => AnchorAsset | null
  /** Р4: ✍ на ноутбуці посеред покрокового — саме цей об'єкт і всі кроки, що лишилися. */
  force?: AnchorAsset | null
  all?: boolean
}

/** Пауза між кроками, коли решту дописуємо одразу (Р4). */
const STEP_PAUSE_MS = 450
/** Стеля сервера для `handwrite_step` (written/total ≤ 99). */
const STEP_MAX = 99

const stepPhase = ref<{ phase: 'preparing' | 'writing'; written: number; total: number } | null>(null)
const stepRefusal = ref<{ reason: StepReason; written: number; total: number } | null>(null)
/** Кроки розв'язку об'єкта в цій вкладці — щоб не питати сервер на кожен натиск (він і сам кешує). */
const stepsCache = new Map<string, { steps: string[]; hash: string }>()

/** Забути кроки, запам'ятовані у вкладці (тести; «нова вкладка»). Прогрес на дошці лишається (І1). */
export function clearHandwriteStepsCache(): void {
  stepsCache.clear()
  stepRefusal.value = null
}

type FitLayout = Extract<HandwriteLayout, { fits: true }>
interface Column { x: number; w: number; k: number; scale: number }
interface Planned { step: number; x: number; y: number; layout: FitLayout }

function canWriteSteps(asset: AnchorAsset | null | undefined, canSolve: boolean): asset is AnchorAsset {
  return !!asset && (hasHandwritableSolution(asset) || (canSolve && isIntegralykSolvable(asset)))
}

/** Оригінал за відбитком id (копії зі сторінок продовження — не оригінал). */
function originalByHash(store: HandwriteStore, obj: string): AnchorAsset | null {
  for (const p of store.pages) {
    for (const a of p.assets ?? []) {
      if (a && !originalOfCopy(a.id) && shortHash(String(a.id)) === obj) return a as AnchorAsset
    }
  }
  return null
}

function asOriginal(store: HandwriteStore, asset: AnchorAsset | null | undefined): AnchorAsset | null {
  if (!asset) return null
  const obj = originalOfCopy(asset.id)
  return obj ? originalByHash(store, obj) : asset
}

/** Р1: незавершений на сторінці → виділений на ноутбуці → як `card.handwrite`. */
function stepTarget(store: HandwriteStore, page: PageLike, opts: StepOptions): AnchorAsset | null {
  const canSolve = opts.canSolve === true
  if (opts.force) {
    const forced = asOriginal(store, opts.force)
    return canWriteSteps(forced, canSolve) ? forced : null
  }
  const open = unfinishedSession(page)
  if (open) {
    const orig = originalByHash(store, open.obj)
    if (canWriteSteps(orig, canSolve)) return orig
  }
  const sel = asOriginal(store, opts.selected)
  if (canWriteSteps(sel, canSolve)) return sel
  const fb = asOriginal(store, opts.fallback?.() ?? null)
  return canWriteSteps(fb, canSolve) ? fb : null
}

/**
 * Кроки розв'язку — рядки запису від `/solution/` (`steps`): з правом Інтегралика — короткий запис сервера;
 * задача банку без нього (чи сервер відмовив, чи перекладач не знає запису) — формули з картки, як у ✍.
 */
async function stepsOf(target: AnchorAsset, canSolve: boolean, boardId: string, deps: HandwriteDeps):
Promise<{ steps: string[]; hash: string } | { error: StepReason; detail?: string }> {
  const key = `${boardId}:${target.id}:${canSolve ? 'brief' : 'steps'}`
  const hit = stepsCache.get(key)
  if (hit) return hit
  const bank = hasHandwritableSolution(target)
  const sources: Array<{ text: string; answer: string; mode: 'steps' | 'full' }> = []
  if (canSolve) {
    let solved: SolveOutcome
    try {
      solved = await (deps.fetchSolve ?? defaultFetchSolve)(boardId, target.id)
    } catch (err) {
      if (!bank) throw err
      solved = { error: 'solver_unavailable' }   // розв'язок у картці є — пишемо його
    }
    if (!('error' in solved)) sources.push({ text: solved.text, answer: solved.answer, mode: 'full' })
    else if (!bank) return { error: solved.error }
  }
  if (bank) sources.push({ text: String(target.data.solution), answer: answerTextOf(target.data), mode: 'steps' })
  let detail = ''
  for (const src of sources) {
    try {
      const probe = await deps.fetchLayout({ text: src.text, width: 1100, height: 1080, mode: src.mode, answer: src.answer })
      const steps = (probe.steps ?? []).filter((x) => x.trim())
      if (!steps.length || steps.length > STEP_MAX) continue
      const got = { steps, hash: shortHash(steps.join('\n')) }
      stepsCache.set(key, got)
      return got
    } catch (err) {
      if (!(err instanceof HandwriteUnsupported)) throw err
      detail = err.message
    }
  }
  return { error: sources.length ? 'unsupported' : 'no_solution', ...(detail ? { detail } : {}) }
}

function scaleIndex(scale: number): number {
  const k = STEP_SCALES.indexOf(scale)
  return k >= 0 ? k : STEP_SCALES.length - 1
}

/** Перший крок: місце й розмір — як у ✍ (увесь запис поруч із об'єктом), далі стовпчик лишається тим самим (І4). */
async function firstColumn(
  deps: HandwriteDeps, page: PageLike, anchor: AnchorAsset, steps: string[], pageW: number, pageH: number,
): Promise<{ col: Column; top: number } | null> {
  const task: Rect = { x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h }
  for (const area of writingAreasNear(task, occupiedRects(page), pageW, pageH)) {
    const l = await deps.fetchLayout({
      text: steps.join('\n'), width: Math.floor(area.w), height: Math.floor(area.h), mode: 'full', answer: '',
    })
    if (l.fits) return { col: { x: area.x, w: area.w, k: scaleIndex(l.scale), scale: l.scale }, top: area.y }
  }
  return null
}

/** Нова сторінка продовження: копія задачі в куті, стовпчик праворуч від неї (вузько — під нею). */
async function newPageColumn(
  deps: HandwriteDeps, anchor: AnchorAsset, steps: string[], pageW: number, pageH: number, scale?: number,
): Promise<{ col: Column; top: number; copyAt: { x: number; y: number } } | null> {
  const area = wholePageArea(pageW, pageH)
  if (anchor.w > area.w || area.y + anchor.h > pageH - 20) return null
  const sideX = area.x + anchor.w + HANDWRITE_GAP
  const side = area.x + area.w - sideX >= HANDWRITE_MIN_W
  const x = side ? sideX : area.x
  const w = side ? area.x + area.w - sideX : area.w
  const top = side ? area.y : area.y + anchor.h + HANDWRITE_GAP
  if (pageH - HANDWRITE_MARGIN - top < 60) return null
  let k: number
  if (scale) {
    k = scaleIndex(scale)
  } else {
    const l = await deps.fetchLayout({
      text: steps.join('\n'), width: Math.floor(w), height: Math.floor(Math.min(LAYOUT_MAX_H, pageH - HANDWRITE_MARGIN - top)),
      mode: 'full', answer: '',
    })
    k = l.fits ? scaleIndex(l.scale) : STEP_SCALES.length - 1
  }
  return { col: { x, w, k, scale: STEP_SCALES[k] }, top, copyAt: { x: area.x, y: area.y } }
}

async function layoutStep(deps: HandwriteDeps, text: string, col: Column): Promise<FitLayout | null> {
  const l = await deps.fetchLayout({ text, width: Math.floor(col.w), height: 1080, mode: 'full', answer: '', scale: col.scale })
  return l.fits ? l : null
}

/**
 * Розкласти кроки `from..to`: на поточній сторінці — під попереднім кроком, в обхід усього, що там є (І3); що не
 * влізло — на нову сторінку з копією задачі (як у ✍). На новій сторінці теж не влізло — решта до наступного натиску.
 */
async function planSteps(
  deps: HandwriteDeps, page: PageLike & { strokes: any[]; assets: any[] }, anchor: AnchorAsset, steps: string[],
  from: number, to: number, start: { col: Column; top: number } | null, pageW: number, pageH: number, newPageH: number,
): Promise<{ here: Planned[]; col: Column | null; there?: { planned: Planned[]; col: Column; copyAt: { x: number; y: number } } } | { error: StepReason }> {
  const here: Planned[] = []
  let i = from
  if (start) {
    const gap = stepGap(start.col.scale)
    const extra: Rect[] = []
    let y = start.top
    let count = page.strokes.length + page.assets.length
    for (; i <= to; i++) {
      const l = await layoutStep(deps, steps[i - 1], start.col)
      if (!l) return { error: 'no_space' }
      const top = placeStep(page, start.col.x, y, { w: l.w, h: l.h }, pageH, gap, extra)
      if (top === null || count + l.strokes.length > PAGE_OBJECT_LIMIT) break
      here.push({ step: i, x: start.col.x, y: top, layout: l })
      extra.push({ x: start.col.x, y: top, w: l.w, h: l.h })
      count += l.strokes.length
      y = top + l.h + gap
    }
    if (i > to) return { here, col: start.col }
  }
  const np = await newPageColumn(deps, anchor, steps, pageW, newPageH, start?.col.scale)
  if (!np) return here.length ? { here, col: start?.col ?? null } : { error: 'no_space' }
  const gap = stepGap(np.col.scale)
  const blank = { strokes: [], assets: [] }
  const extra: Rect[] = [{ x: np.copyAt.x, y: np.copyAt.y, w: anchor.w, h: anchor.h }]
  const there: Planned[] = []
  let y = np.top
  for (; i <= to; i++) {
    const l = await layoutStep(deps, steps[i - 1], np.col)
    if (!l) break
    const top = placeStep(blank, np.col.x, y, { w: l.w, h: l.h }, newPageH, gap, extra)
    if (top === null) break
    there.push({ step: i, x: np.col.x, y: top, layout: l })
    extra.push({ x: np.col.x, y: top, w: l.w, h: l.h })
    y = top + l.h + gap
  }
  if (!here.length && !there.length) return { error: 'no_space' }
  return { here, col: start?.col ?? null, ...(there.length ? { there: { planned: there, col: np.col, copyAt: np.copyAt } } : {}) }
}

function stepStrokes(
  planned: Planned[], col: Column, obj: string, hash: string, total: number, nonce: string,
): { strokes: WBStroke[]; times: number[]; ends: number[] } {
  const strokes: WBStroke[] = []
  const times: number[] = []
  /** Межі кроків: кінець кожного кроку (не включно) — рядок не лишається обрізаним (v1.34). */
  const ends: number[] = []
  let offset = 0
  for (const p of planned) {
    strokes.push(...toStrokes(p.layout, p.x, p.y, (n) => stepStrokeId({
      obj, text: hash, step: p.step, total, k: col.k, x: col.x, w: col.w, nonce, n,
    })))
    times.push(...p.layout.strokes.map((st) => st.t + offset))
    offset = (times[times.length - 1] ?? offset) + STEP_PAUSE_MS
    ends.push(strokes.length)
  }
  return { strokes, times, ends }
}

function refuse(reason: StepReason, s?: { written: number; total: number } | null, detail?: string, image?: boolean): StepResult {
  stepRefusal.value = { reason, written: s?.written ?? 0, total: s?.total ?? 0 }
  return { status: 'refused', reason, ...(detail ? { detail } : {}), ...(image ? { image } : {}) }
}

/**
 * LAW §9 v1.32: один натиск «✍️ Наступний рядок» — один крок розв'язку (з `all` — усі, що лишилися, Р4).
 * Що вже написано, береться зі штрихів поточної сторінки (І1): перезавантаження, інша сторінка й повернення
 * нічого не ламають. Пише ноутбук штатними `stroke_add`, ніколи поверх написаного (І3), один крок —
 * одне «Скасувати» (І5). Поки пише — новий натиск нічого не додає (І7).
 */
export async function handwriteNextStep(opts: StepOptions, depsIn?: HandwriteDeps): Promise<StepResult> {
  if (active || handwriteBusyId.value !== null) return { status: 'busy' }
  stepRefusal.value = null
  const deps = depsIn ?? await defaultDeps()
  const { store, sync } = deps
  const boardId = store.workspaceId
  const page = store.pages[store.currentPageIndex]
  const writable = () => store.mode === 'edit' && sync.mode === 'SYNC' && !sync.inputLocked && store.workspaceId === boardId
  if (!page || !boardId || !writable()) return refuse('blocked')
  const target = stepTarget(store, page, opts)
  if (!target) return refuse('no_solution')
  const image = target.type === 'image'
  const obj = shortHash(String(target.id))
  const open = stepSessions(page).find((x) => x.obj === obj && x.written < x.total) ?? null
  handwriteBusyId.value = target.id
  stepPhase.value = { phase: 'preparing', written: open?.written ?? 0, total: open?.total ?? 0 }
  try {
    const got = await stepsOf(target, opts.canSolve === true, boardId, deps)
    if ('error' in got) return refuse(got.error, open, got.detail, image)
    if (!writable() || store.pages[store.currentPageIndex]?.id !== page.id) return refuse('blocked', open)
    const total = got.steps.length
    // v1.34: прогрес — по всіх сторінках (оригінал і сторінки продовження). Уже все — «написано»; далі пише
    // сторінка, де написано найбільше: якщо це не ця — «продовжується на іншій сторінці», а не вдруге тут.
    let latest: { page: PageLike; written: number; total: number } | null = null
    for (const p of store.pages) {
      const sess = sessionOf(p, obj, got.hash)
      if (sess && (!latest || sess.written > latest.written)) latest = { page: p, written: sess.written, total: sess.total }
    }
    if (latest && latest.written >= total) return { status: 'done', total }
    if (latest && latest.page.id !== page.id) return refuse('elsewhere', latest)
    const session = sessionOf(page, obj, got.hash)
    const from = session ? session.written + 1 : 1
    const to = opts.all ? total : from
    const pageW = page.width ?? 1920
    // Як у ✍: місце — у висоті, яку показує полотно; сторінка продовження — звичайний аркуш.
    const pageH = store.currentPageCanvasHeight ?? page.height ?? 1080
    const newPageH = store.pageHeight ?? 1080
    let start: { col: Column; top: number } | null
    if (session) {
      const scale = STEP_SCALES[session.k]
      start = { col: { x: session.x, w: session.w, k: session.k, scale }, top: session.bottom + stepGap(scale) }
    } else {
      // Перший крок пишеться біля об'єкта на цій сторінці: оригіналу чи його копії зі сторінки продовження.
      const anchor = (page.assets.find((a) => a?.id === target.id)
        ?? page.assets.find((a) => originalOfCopy(a?.id) === obj)) as AnchorAsset | undefined
      if (!anchor) return refuse('elsewhere')
      start = await firstColumn(deps, page, anchor, got.steps, pageW, pageH)
    }
    stepPhase.value = { phase: 'writing', written: from - 1, total }
    const plan = await planSteps(deps, page as any, target, got.steps, from, to, start, pageW, pageH, newPageH)
    if ('error' in plan) return refuse(plan.error, session)
    if (!writable() || store.pages[store.currentPageIndex]?.id !== page.id) return refuse('blocked', session)
    const nonce = Math.random().toString(36).slice(2, 4).padEnd(2, '0')
    let last = from - 1
    if (plan.here.length && plan.col) {
      const { strokes, times, ends } = stepStrokes(plan.here, plan.col, obj, got.hash, total, nonce)
      const r = await drawStrokes(deps, writable, page.id, strokes, times, null, ends)
      if (r.status !== 'written') return { status: 'stopped' }
      last = plan.here[plan.here.length - 1].step
      stepPhase.value = { phase: 'writing', written: last, total }
    }
    if (plan.there) {
      const pageId = store.addPageUndoable({ afterCurrent: true, inheritLook: true })
      if (!pageId) return last >= from ? { status: 'written', from, to: last, total } : refuse('no_space', session)
      // Копія, а не перенос (як у ✍): задача лишається на своїй сторінці; відповідь і розбір у копії сховані.
      const copy = {
        ...target, id: stepCopyId(obj), x: plan.there.copyAt.x, y: plan.there.copyAt.y,
        ...(target.type === 'nmt_task' ? { data: { ...(target.data || {}), showAnswer: false, showSolution: false } } : {}),
      }
      store.addAsset(copy, pageId, { skipHistory: true })
      const { strokes, times, ends } = stepStrokes(plan.there.planned, plan.there.col, obj, got.hash, total, nonce)
      const r = await drawStrokes(deps, writable, pageId, strokes, times, copy, ends)
      if (r.status !== 'written') return { status: 'stopped' }
      last = plan.there.planned[plan.there.planned.length - 1].step
    }
    return { status: 'written', from, to: last, total }
  } finally {
    handwriteBusyId.value = null
    stepPhase.value = null
  }
}

/** Чи знайде наступний натиск, що писати (Р1) — без мережі, лише з того, що на дошці. */
export function hasStepTarget(store: HandwriteStore, opts: StepOptions): boolean {
  const page = store.pages[store.currentPageIndex]
  return !!page && stepTarget(store, page, opts) !== null
}

/** Стан для пульта: що зробить наступний натиск на цій сторінці. */
export function handwriteStepState(page: PageLike | null | undefined): StepState {
  const phase = stepPhase.value
  if (phase) return { status: phase.phase, written: phase.written, total: phase.total }
  // Повний ✍ (з ноутбука чи пульта): кроків немає — лише «готую…» / «пишу…».
  if (handwriteBusyId.value !== null) return { status: handNow.value ? 'writing' : 'preparing', written: 0, total: 0 }
  const r = stepRefusal.value
  if (r) return { status: 'refused', written: Math.min(r.written, r.total), total: r.total, reason: r.reason }
  const open = unfinishedSession(page)
  if (open) return { status: 'idle', written: open.written, total: open.total }
  const latest = stepSessions(page).sort((a, b) => b.last - a.last)[0]
  if (latest) return { status: 'done', written: latest.total, total: latest.total }
  return { status: 'idle', written: 0, total: 0 }
}

function tr(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(`winterboard.handwrite.${key}`)
}

/**
 * Збій натискання — словами, якщо apiClient його не показав. Мережу, 403 і 5xx він показує сам; решту
 * відповідей (400 відкинутої області, 404 вимкненого на сервері Інтегралика, 429 ліміту) мовчки
 * пропускає — тоді кажемо тут, щоб натискання не зникло (власник 18.10: кнопка «ніби спрацювала»,
 * а нічого не з'явилось). Не мережева помилка (вада коду) — теж тут.
 */
function reportUnshownError(err: any): void {
  const status = Number(err?.response?.status ?? 0)
  if (err?.isAxiosError !== true || (err.response && status !== 403 && status < 500)) notifyError(tr('error'))
}

/**
 * ✍ «увесь розв'язок» з поясненням для вчителя — ноутбук (група дій виділеного) і пульт (`card.handwrite`).
 * v1.34: ті самі кроки з позначками, що «Наступний рядок», — усі, що лишилися (О6, Р4). Обірване дописується з того
 * рядка на тому самому місці; уже написане — «Розв'язок уже написано», без дубля на новій сторінці.
 * Рукою не вийшло, а розв'язок у картці є — показуємо його друкованим (`reveal`, як «Показати розбір»).
 */
export async function handwriteAllWithFeedback(
  asset: AnchorAsset, opts: SolveOptions & { reveal?: (asset: AnchorAsset) => void } = {}, depsIn?: HandwriteDeps,
): Promise<StepResult | null> {
  if (active || handwriteBusyId.value !== null) {
    notifyInfo(tr('busy'))
    return { status: 'busy' }
  }
  const bank = hasHandwritableSolution(asset)
  if (opts.canSolve && !bank && isIntegralykSolvable(asset)) notifyInfo(tAssistantGlobal('winterboard.handwrite.solving'))
  const r = await nextStepWithFeedback({ canSolve: opts.canSolve === true, force: asset, all: true }, depsIn,
    { printed: bank && !!opts.reveal })
  if (bank && opts.reveal && r?.status === 'refused' && (r.reason === 'unsupported' || r.reason === 'no_space')) {
    opts.reveal(asset)
  }
  return r
}

/**
 * ✍ у групі дій виділеного об'єкта на ноутбуці (`WBCanvas`). Те саме, що `handwriteAllWithFeedback`; підпис
 * лишився з v1.29 (`revealPrinted` — показати розбір друкованим, коли рукою не вийшло).
 */
export function solveWithFeedback(
  asset: AnchorAsset, revealPrinted: () => void, depsIn?: HandwriteDeps, opts: SolveOptions = { canSolve: true },
): Promise<StepResult | null> {
  return handwriteAllWithFeedback(asset, { canSolve: opts.canSolve, reveal: () => revealPrinted() }, depsIn)
}

/**
 * Пульт «✍️ Розв'язок рукою» від старого телефона (без адреси об'єкта): задача за Р1 — незавершений покроковий на
 * сторінці → виділений на ноутбуці → `fallback`. Новий телефон шле адресу — тоді `handwriteAllWithFeedback` рівно
 * для неї. Писати нічого — словами на ноутбуці й на пульті (`handwrite_step.reason`), не тиша.
 */
export async function remoteHandwriteWithFeedback(
  opts: StepOptions & { reveal: (asset: AnchorAsset) => void }, depsIn?: HandwriteDeps,
): Promise<StepResult | null> {
  if (active || handwriteBusyId.value !== null) {
    notifyInfo(tr('busy'))
    return { status: 'busy' }
  }
  stepRefusal.value = null
  const deps = depsIn ?? await defaultDeps()
  const page = deps.store.pages[deps.store.currentPageIndex]
  const target = page ? stepTarget(deps.store, page, opts) : null
  if (!target) {
    stepRefusal.value = { reason: 'no_solution', written: 0, total: 0 }
    notifyInfo(tr('noStepTarget'))
    return { status: 'refused', reason: 'no_solution' }
  }
  return handwriteAllWithFeedback(target, { canSolve: opts.canSolve, reveal: opts.reveal }, deps)
}

/**
 * «✍️ Наступний рядок» з пульта з поясненням на ноутбуці (пульт бачить те саме у `handwrite_step`).
 * `printed` — розв'язок картки покажуть друкованим (тексти «…— показала друкованим»).
 */
export async function nextStepWithFeedback(
  opts: StepOptions, depsIn?: HandwriteDeps, how: { printed?: boolean } = {},
): Promise<StepResult | null> {
  let r: StepResult
  try {
    r = await handwriteNextStep(opts, depsIn)
  } catch (err: any) {
    console.error('[WB:handwrite] step failed', err)
    stepRefusal.value = { reason: 'error', written: 0, total: 0 }
    reportUnshownError(err)
    return null
  }
  if (r.status === 'busy') notifyInfo(tr('busy'))
  else if (r.status === 'done') notifyInfo(tr('stepDone'))
  else if (r.status === 'refused') {
    switch (r.reason) {
      case 'unsupported': notifyInfo(tr(how.printed ? 'unsupported' : 'unsupportedSolved')); break
      case 'no_space': notifyWarning(tr(how.printed ? 'noSpace' : 'noSpaceSolved')); break
      case 'blocked': notifyWarning(tr('blocked')); break
      case 'no_solution': notifyInfo(tr('noStepTarget')); break
      case 'elsewhere': notifyInfo(tr('elsewhere')); break
      case 'no_task': notifyInfo(tAssistantGlobal('winterboard.handwrite.noTask')); break
      case 'many_tasks': notifyInfo(tr('manyTasks')); break
      case 'unsure': notifyWarning(r.image ? tAssistantGlobal('winterboard.handwrite.unsureImage') : tr('unsure')); break
      case 'mismatch': notifyWarning(tr('mismatch')); break
      case 'not_readable': notifyWarning(tAssistantGlobal('winterboard.handwrite.notReadable')); break
      default: break
    }
  }
  return r
}

// ── LAW §9 v1.49 · диктант з пульта ─────────────────────────────────────────────────────────────────────────

export type DictationReason = 'no_space' | 'busy' | 'blocked' | 'unsupported' | 'error'
export type DictationResult = { status: 'written' } | { status: 'stopped' } | { status: 'refused'; reason: DictationReason }

/** Позначка «пишеться диктант» у `handwriteBusyId`: інші ✍ відповідають «Уже пишу», значки об'єктів не пульсують. */
export const DICTATION_BUSY_ID = '__dictation__'

/**
 * Почерк диктанту — шкільний пропис (Bad Script + шкільні Т, П, Г, Ґ, А, т; власник 2026-10-25: «роби з bad script,
 * але з можливістю потім змінити»). Змінити почерк диктанту — тут; ✍ Інтегралика пише як було ('classic').
 */
export const DICTATION_HAND: HandwriteHand = 'school'

/** v1.66: «Пропустити рядок» на сторінці без ліній — один «рядок» білої дошки, px. */
export const FREE_SKIP_PX = 56

/**
 * Речення з пульта — рукописом (власник 2026-10-24: «…для неї багато часу займає написання речень на дошці… в нас є
 * телефон мікрофон дошка і пропис»). Той самий почерк і шлях, що ✍ розв'язку: сервер вписує текст у вільне місце
 * (`/solution/`, `mode: 'full'`, без «Відповідь:»), клієнт кладе штатні `stroke_add` у темпі руки одним кроком
 * «Скасувати». Місце — під усім, що вже є на поточній сторінці (`dictationArea`).
 */
export async function handwriteDictation(
  text: string, depsIn?: HandwriteDeps, opts: { align?: DictateAlign; lang?: 'uk' | 'en'; skip?: number } = {},
): Promise<DictationResult> {
  const refuse = (reason: DictationReason): DictationResult => ({ status: 'refused', reason })
  if (active || handwriteBusyId.value !== null) return refuse('busy')
  const deps = depsIn ?? await defaultDeps()
  const { store, sync } = deps
  const boardId = store.workspaceId
  const page = store.pages[store.currentPageIndex]
  const writable = () => store.mode === 'edit' && sync.mode === 'SYNC' && !sync.inputLocked && store.workspaceId === boardId
  if (!page || !boardId || !writable()) return refuse('blocked')
  const pageW = page.width ?? 1920
  const pageH = store.currentPageCanvasHeight ?? page.height ?? 1080
  const align: DictateAlign = opts.align === 'center' ? 'center' : 'left'
  // v1.51: на фоні «в лінійку» / «в косу» — рядки на лінії зошита; область — смуга сторінки від запасу над першою
  // лінією (сервер приймає ≤ 1920×1080), числа лінійки — у координатах цієї смуги. Інакше — як v1.49, але рівно.
  const ruling = notebookRuling(page as any, pageW)
  // v1.66 «Пропустити рядок» (власник 2026-10-26: «відступ від попереднього»): на зошиті — N ліній, на білій — N×56 px
  const skip = Number.isInteger(opts.skip) && (opts.skip as number) > 0 ? Math.min(3, opts.skip as number) : 0
  if (ruling) ruling.first_baseline += skip * ruling.pitch
  let area: Rect | null
  let req: HandwriteLayoutRequest
  if (ruling) {
    const top = Math.max(0, Math.floor(ruling.first_baseline - 3 * ruling.x_height))
    area = { x: 0, y: top, w: Math.min(pageW, LAYOUT_MAX_W), h: Math.min(LAYOUT_MAX_H, pageH - top) }
    if (area.h < ruling.pitch) return refuse('no_space')
    req = { text, width: area.w, height: area.h, mode: 'full', answer: '', hand: DICTATION_HAND,
      ruling: { ...ruling, first_baseline: ruling.first_baseline - top, align } }
  } else {
    area = dictationArea(page, pageW, pageH)
    if (area && skip) area = area.h - skip * FREE_SKIP_PX > 0 ? { ...area, y: area.y + skip * FREE_SKIP_PX, h: area.h - skip * FREE_SKIP_PX } : null
    if (!area) return refuse('no_space')
    req = { text, width: area.w, height: area.h, mode: 'full', answer: '', hand: DICTATION_HAND, tokens: true, align }
  }
  handwriteBusyId.value = DICTATION_BUSY_ID
  try {
    let layout: HandwriteLayout
    try {
      layout = await deps.fetchLayout(req)
    } catch (err) {
      if (err instanceof HandwriteUnsupported) return refuse('unsupported')
      console.warn('[WB:dictation] layout failed:', err)
      return refuse('error')
    }
    if (!layout.fits) return refuse('no_space')
    if (!writable() || store.pages[store.currentPageIndex]?.id !== page.id) return refuse('blocked')
    if (opts.lang === 'uk' || opts.lang === 'en') {
      if (page.strokes.length + page.assets.length >= PAGE_OBJECT_LIMIT) return refuse('no_space')
      try {
        const asset = dictationFromLayout(layout, { id: `dictation-${crypto.randomUUID()}`, text, lang: opts.lang,
          align, x: area.x, y: area.y, width: req.width, height: req.height })
        // Одна цілісна дія; старий шлях без lang нижче не змінюється.
        // v1.66: на цьому ноутбуці речення пишеться рукою (лише вигляд), виділення — тихе (без панелі до дотику)
        revealDictation(asset.id)
        store.addAsset(asset, page.id)
        if (!store.pages[store.currentPageIndex]?.assets.some((a) => a.id === asset.id)) return refuse('blocked')
        store.selectItems?.([asset.id])
        selectQuietly(asset.id)
        return { status: 'written' }
      } catch (err) {
        console.warn('[WB:dictation] sentence creation refused', err)
        return refuse('error')
      }
    }
    // Сторінка вміщує щонайбільше PAGE_OBJECT_LIMIT штрихів і об'єктів — зайве сховище мовчки відкидає, і на дошці
    // лишилось би обрізане речення («…діду», стенд 24.10) під «Готово» на телефоні. Не влазить ціле — «немає місця».
    if (page.strokes.length + page.assets.length + layout.strokes.length > PAGE_OBJECT_LIMIT) return refuse('no_space')
    const key = shortHash(`${page.id}|${text}|${Date.now()}`)
    const strokes = toStrokes(layout, area.x, area.y, (i) => `dict-${key}-${i}`)
    const r = await drawStrokes(deps, writable, page.id, strokes, layout.strokes.map((s) => s.t), null)
    return r.status === 'written' ? { status: 'written' } : { status: 'stopped' }
  } finally {
    handwriteBusyId.value = null
  }
}
