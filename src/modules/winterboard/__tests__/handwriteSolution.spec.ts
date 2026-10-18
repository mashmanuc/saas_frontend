// LAW §9 v1.29 · розв'язок задачі рукою: місце біля задачі, письмо в темпі руки, один «Скасувати»,
// зупинка при зміні сторінки/дошки, чесні відмови. Мережі й стору немає — підставні залежності.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HANDWRITE_INK, HANDWRITE_MIN_W, LAYOUT_MAX_H, LAYOUT_MAX_W, answerTextOf, freeAreaFrom, hasHandwritableSolution,
  isIntegralykSolvable, occupiedRects, wholePageArea, writingAreasNear,
} from '../board/handwriteSolution'
import {
  HandwriteUnsupported, handwriteBusyId, handwriteTaskSolution, handwriteWithFeedback, isHandwriting,
  solveAndHandwrite, solveWithFeedback, stopHandwriting, type HandwriteDeps, type HandwriteLayout, type SolveOutcome,
} from '../composables/useHandwriteSolution'
import { cardWindowActions } from '../board/windowActions'
import { notifyError, notifyInfo, notifyWarning } from '@/utils/notify'

vi.mock('@/utils/notify', () => ({ notifyError: vi.fn(), notifyInfo: vi.fn(), notifyWarning: vi.fn() }))
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))
vi.mock('@/modules/intent/assistantLook', () => ({ tAssistantGlobal: (k: string) => `assistant:${k}` }))

const TASK = {
  id: 'task-1', type: 'nmt_task', x: 60, y: 60, w: 800, h: 500,
  data: {
    solution: 'Маємо $x + 2 = 5$, отже $x = 3$.',
    options: [{ letter: 'А', isCorrect: false }, { letter: 'Б', isCorrect: true }],
  },
}

// ─── чиста логіка ───────────────────────────────────────────────────────────

describe('board/handwriteSolution', () => {
  it('є що писати — лише задача з непорожнім розв\'язком', () => {
    expect(hasHandwritableSolution(TASK)).toBe(true)
    expect(hasHandwritableSolution({ ...TASK, data: { solution: '  ' } })).toBe(false)
    expect(hasHandwritableSolution({ ...TASK, type: 'theory_card' })).toBe(false)
    expect(hasHandwritableSolution(null)).toBe(false)
  })

  it('відповідь: букви правильних варіантів, інакше correctAnswer, інакше порожньо', () => {
    expect(answerTextOf(TASK.data)).toBe('Б')
    expect(answerTextOf({ options: [{ letter: 'А', isCorrect: true }, { letter: 'В', isCorrect: true }] })).toBe('А, В')
    expect(answerTextOf({ correctAnswer: 12 })).toBe('12')
    expect(answerTextOf({ pairs: [{ left: '$145$', right: 'на 5' }, { left: '$96$', right: 'на 2' }] }))
      .toBe('$145$ — на 5; $96$ — на 2')
    expect(answerTextOf({})).toBe('')
  })

  it('зайняте місце — і об\'єкти, і штрихи пера', () => {
    const rects = occupiedRects({
      assets: [{ x: 10, y: 20, w: 30, h: 40 }, { x: 0, y: 0, w: 0, h: 0 }],
      strokes: [{ size: 4, points: [{ x: 100, y: 100 }, { x: 150, y: 120 }] }],
    })
    expect(rects).toEqual([{ x: 10, y: 20, w: 30, h: 40 }, { x: 98, y: 98, w: 54, h: 24 }])
  })

  it('вільна область обрізається перешкодою, а не налазить на неї', () => {
    const area = freeAreaFrom(900, 60, [{ x: 1500, y: 0, w: 300, h: 1080 }], 1920, 1080)!
    expect(area.x).toBe(900)
    expect(area.x + area.w).toBeLessThanOrEqual(1500)
    expect(area.w).toBeGreaterThanOrEqual(HANDWRITE_MIN_W)
    expect(freeAreaFrom(900, 60, [{ x: 880, y: 40, w: 100, h: 100 }], 1920, 1080)).toBeNull()
  })

  it('біля задачі: спершу праворуч, тоді під нею; рукопис учителя теж перешкода', () => {
    const areas = writingAreasNear(TASK, occupiedRects({ assets: [TASK] }), 1920, 1080)
    expect(areas[0].x).toBe(TASK.x + TASK.w + 40)
    expect(areas[1].y).toBe(TASK.y + TASK.h + 40)
    const busy = occupiedRects({ assets: [TASK], strokes: [{ size: 2, points: [{ x: 900, y: 0 }, { x: 1900, y: 1080 }] }] })
    const only = writingAreasNear(TASK, busy, 1920, 1080)
    expect(only.every((a) => a.x + a.w <= 900 || a.y > 1080)).toBe(true)
  })

  it('сторінка вища за аркуш (добірка задач, 18.10) — область не більша, ніж розкладає сервер', () => {
    expect(freeAreaFrom(60, 480, [], 1920, 2120)).toEqual({ x: 60, y: 480, w: 1820, h: LAYOUT_MAX_H })
    expect(freeAreaFrom(40, 40, [], 4000, 1080)!.w).toBe(LAYOUT_MAX_W)
    expect(wholePageArea(1920, 2120)).toEqual({ x: 40, y: 40, w: 1840, h: LAYOUT_MAX_H })
    expect(wholePageArea(1920, 1080)).toEqual({ x: 40, y: 40, w: 1840, h: 1000 })
  })
})

// ─── письмо ─────────────────────────────────────────────────────────────────

function layout(n: number, size = 3): HandwriteLayout {
  return {
    fits: true, scale: 46, size, w: 300, h: 100, duration_ms: n * 100,
    strokes: Array.from({ length: n }, (_, i) => ({ p: [[i * 10, 0], [i * 10 + 5, 10]], t: (i + 1) * 100 })),
  }
}

/** Як сервер (`apps/handwriting/api.py`): область поза 200…1920 × 60…1080 — 400 `invalid_area`. */
function serverRejects(req: { width: number; height: number }): boolean {
  return !(req.width >= 200 && req.width <= 1920 && req.height >= 60 && req.height <= 1080)
}

function makeDeps(opts: {
  layouts?: HandwriteLayout[]; unsupported?: boolean; assets?: any[]; solve?: () => Promise<SolveOutcome>
  /** Висота поточної сторінки, як її показує полотно (добірка задач — вища за аркуш). */
  pageHeight?: number
} = {}) {
  const page: any = { id: 'p1', assets: (opts.assets ?? [TASK]) as any[], strokes: [] as any[] }
  if (opts.pageHeight) page.height = opts.pageHeight
  const pages = [page]
  const store = {
    mode: 'edit', workspaceId: 'board-1', currentPageIndex: 0, pages,
    pageHeight: 1080,
    get currentPageCanvasHeight() { return pages[store.currentPageIndex]?.height ?? 1080 },
    undoStack: [] as any[], redoStack: [{ apply() {}, revert() {} }] as any[],
    addStroke: vi.fn((s: any, o?: { skipHistory?: boolean; pageId?: string }) => {
      const pg = pages.find((p) => p.id === (o?.pageId ?? pages[store.currentPageIndex].id))!
      pg.strokes = [...pg.strokes, s]
    }),
    deleteStroke: vi.fn((id: string) => {
      const pg = pages[store.currentPageIndex]
      pg.strokes = pg.strokes.filter((s: any) => s.id !== id)
    }),
    addAsset: vi.fn((a: any, pageId: string) => {
      const pg = pages.find((p) => p.id === pageId)!
      pg.assets = [...pg.assets, a]
    }),
    deleteAsset: vi.fn((id: string) => {
      const pg = pages[store.currentPageIndex]
      pg.assets = pg.assets.filter((a: any) => a.id !== id)
    }),
    addPageUndoable: vi.fn(() => {
      const np = { id: 'p2', assets: [] as any[], strokes: [] as any[] }
      pages.splice(store.currentPageIndex + 1, 0, np)
      store.currentPageIndex += 1
      return 'p2'
    }),
  }
  const sync = { mode: 'SYNC', inputLocked: false }
  const queue: Array<() => void> = []
  const layouts = [...(opts.layouts ?? [layout(3)])]
  const deps: HandwriteDeps = {
    store: store as any,
    sync,
    fetchLayout: vi.fn(async (req: any) => {
      if (serverRejects(req)) throw Object.assign(new Error('400'), { isAxiosError: true, response: { status: 400 } })
      if (opts.unsupported) throw new HandwriteUnsupported('\\hbar')
      return layouts.length > 1 ? layouts.shift()! : layouts[0]
    }),
    schedule: (fn) => { queue.push(fn); return () => { const i = queue.indexOf(fn); if (i >= 0) queue.splice(i, 1) } },
    fetchSolve: vi.fn(opts.solve ?? (async () => ({ text: '$2x = 4$\n$x = 2$', answer: '$2$' }))),
  }
  const step = () => { const fn = queue.shift(); fn?.() }
  const runAll = () => { while (queue.length) step() }
  return { deps, store, sync, page, pages, step, runAll, queue }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('handwriteTaskSolution', () => {
  beforeEach(() => stopHandwriting())

  it('пише штрих за штрихом справа від задачі, синім пером; увесь розв\'язок — один «Скасувати»', async () => {
    const { deps, store, page, step, runAll } = makeDeps()
    const done = handwriteTaskSolution(TASK, deps)
    await flush()
    expect(store.undoStack).toHaveLength(1)
    expect(store.redoStack).toHaveLength(0)
    step()
    expect(page.strokes).toHaveLength(1)
    expect(isHandwriting()).toBe(true)
    runAll()
    expect(await done).toEqual({ status: 'written', strokes: 3, pageId: 'p1', newPage: false })
    expect(isHandwriting()).toBe(false)
    const s0 = page.strokes[0]
    expect(s0).toMatchObject({ tool: 'pen', color: HANDWRITE_INK, size: 3, opacity: 1 })
    expect(s0.points[0].x).toBe(TASK.x + TASK.w + 40)
    expect(store.addStroke.mock.calls.every((c) => c[1]?.skipHistory === true && c[1]?.pageId === 'p1')).toBe(true)
    // «Скасувати» прибирає весь розв'язок, «Повернути» кладе його цілим
    store.undoStack[0].revert()
    expect(page.strokes).toHaveLength(0)
    store.undoStack[0].apply()
    expect(page.strokes).toHaveLength(3)
  })

  it('«Скасувати» посеред письма зупиняє руку й прибирає написане', async () => {
    const { deps, store, page, step, queue } = makeDeps({ layouts: [layout(5)] })
    const done = handwriteTaskSolution(TASK, deps)
    await flush()
    step(); step()
    expect(page.strokes).toHaveLength(2)
    store.undoStack[0].revert()
    expect(page.strokes).toHaveLength(0)
    expect(queue).toHaveLength(0)
    expect(await done).toEqual({ status: 'stopped', written: 2 })
  })

  it('перегорнули сторінку чи дошка в DESYNC — письмо зупиняється, далі не пише', async () => {
    const a = makeDeps({ layouts: [layout(4)] })
    const done = handwriteTaskSolution(TASK, a.deps)
    await flush()
    a.step()
    a.pages.push({ id: 'other', assets: [], strokes: [] })
    a.store.currentPageIndex = 1
    a.runAll()
    expect(await done).toEqual({ status: 'stopped', written: 1 })

    const b = makeDeps({ layouts: [layout(4)] })
    const done2 = handwriteTaskSolution(TASK, b.deps)
    await flush()
    b.sync.mode = 'DESYNC'
    b.runAll()
    expect(await done2).toEqual({ status: 'stopped', written: 0 })
    expect(b.page.strokes).toHaveLength(0)
  })

  it('не влізло біля задачі — нова сторінка: копія умови в кутку, рукопис навколо неї, один «Скасувати»', async () => {
    const nofit: HandwriteLayout = { fits: false, needed_height: 2000 }
    const { deps, store, pages, runAll } = makeDeps({ layouts: [nofit, nofit, layout(2)] })
    const done = handwriteTaskSolution(TASK, deps)
    await flush()
    runAll()
    const res = await done
    expect(res).toMatchObject({ status: 'written', strokes: 2, pageId: 'p2', newPage: true })
    expect(store.addPageUndoable).toHaveBeenCalledWith({ afterCurrent: true })
    // запит для нової сторінки — з умовою в кутку
    const calls = (deps.fetchLayout as any).mock.calls
    const lastReq = calls[calls.length - 1][0]
    expect(lastReq.float).toEqual({ w: TASK.w, h: TASK.h })
    // копія, а не перенос: оригінал лишився, на новій сторінці — копія з прихованими відповіддю й розбором
    expect(pages[0].assets.map((a: any) => a.id)).toContain('task-1')
    const copy = pages[1].assets[0]
    expect(copy.id).not.toBe('task-1')
    expect(copy).toMatchObject({ type: 'nmt_task', x: 40, y: 40, w: TASK.w, h: TASK.h })
    expect(copy.data).toMatchObject({ showAnswer: false, showSolution: false, solution: TASK.data.solution })
    expect((res as any).copiedTaskId).toBe(copy.id)
    expect(pages[1].strokes).toHaveLength(2)
    // «Скасувати» прибирає і рукопис, і копію
    store.undoStack[store.undoStack.length - 1].revert()
    expect(pages[1].strokes).toHaveLength(0)
    expect(pages[1].assets).toHaveLength(0)
  })

  it('перекладач не знає конструкції — нічого не пише й не кладе «Скасувати»', async () => {
    const { deps, store, page } = makeDeps({ unsupported: true })
    expect(await handwriteTaskSolution(TASK, deps)).toEqual({ status: 'unsupported', detail: '\\hbar' })
    expect(page.strokes).toHaveLength(0)
    expect(store.undoStack).toHaveLength(0)
  })

  it('заблоковано, зайнято, немає розв\'язку', async () => {
    const a = makeDeps()
    a.sync.inputLocked = true
    expect(await handwriteTaskSolution(TASK, a.deps)).toEqual({ status: 'blocked' })
    expect(await handwriteTaskSolution({ ...TASK, data: {} }, makeDeps().deps)).toEqual({ status: 'no_solution' })
    const b = makeDeps({ layouts: [layout(3)] })
    const first = handwriteTaskSolution(TASK, b.deps)
    await flush()
    expect(await handwriteTaskSolution(TASK, makeDeps().deps)).toEqual({ status: 'busy' })
    b.runAll()
    await first
  })

  it('не вийшло рукою — розбір показується друкованим', async () => {
    const reveal = vi.fn()
    const { deps } = makeDeps({ unsupported: true })
    await handwriteWithFeedback(TASK, reveal, deps)
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  // Прод 18.10 (власник: «не появляється розв'язок, коли я натискаю»): згенерована добірка задач —
  // два ряди карток на сторінці вищій за аркуш; область під карткою була вищою, ніж приймає сервер.
  const ROW = [
    { ...TASK, id: 'gen-a', x: 60, y: 60, w: 860, h: 380 },
    { ...TASK, id: 'gen-b', x: 940, y: 60, w: 860, h: 380 },
  ]

  it('добірка задач вища за аркуш — рукопис під карткою, область у межах сервера', async () => {
    const { deps, page, runAll } = makeDeps({ assets: ROW, pageHeight: 2120 })
    const done = handwriteTaskSolution(ROW[1], deps)
    await flush()
    runAll()
    expect(await done).toMatchObject({ status: 'written', newPage: false })
    const reqs = (deps.fetchLayout as any).mock.calls.map((c: any[]) => c[0])
    expect(reqs.some(serverRejects)).toBe(false)
    expect(page.strokes.length).toBeGreaterThan(0)
    const ys = page.strokes.flatMap((s: any) => s.points.map((p: any) => p.y))
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(ROW[1].y + ROW[1].h)
  })

  it('після високої добірки нова сторінка — звичайний аркуш, область під нього', async () => {
    const nofit: HandwriteLayout = { fits: false, needed_height: 2000 }
    const { deps, runAll } = makeDeps({ assets: ROW, pageHeight: 2120, layouts: [nofit, layout(2)] })
    const done = handwriteTaskSolution(ROW[1], deps)
    await flush()
    runAll()
    expect(await done).toMatchObject({ status: 'written', newPage: true })
    const calls = (deps.fetchLayout as any).mock.calls
    expect(calls[calls.length - 1][0]).toMatchObject({ height: 1080 - 80, float: { w: 860, h: 380 } })
  })

  it('сервер відкинув запит — учитель бачить «не вийшло», а не тишу', async () => {
    vi.mocked(notifyError).mockClear()
    const { deps } = makeDeps()
    ;(deps.fetchLayout as any).mockRejectedValueOnce(
      Object.assign(new Error('400'), { isAxiosError: true, response: { status: 400 } }))
    expect(await handwriteWithFeedback(TASK, vi.fn(), deps)).toBeNull()
    expect(notifyError).toHaveBeenCalledWith('winterboard.handwrite.error')
    expect(isHandwriting()).toBe(false)
    expect(handwriteBusyId.value).toBeNull()
  })
})

// ─── хто бачить ✍ ───────────────────────────────────────────────────────────

describe('✍ у групі дій картки', () => {
  const TEACHER = { isTutor: true, mode: 'edit' }
  it('лише вчитель, режим редагування, задача з розв\'язком', () => {
    expect(cardWindowActions(TASK as any, TEACHER).handwrite).toBe(true)
    expect(cardWindowActions(TASK as any, { isTutor: false, mode: 'edit' }).handwrite).toBe(false)
    expect(cardWindowActions(TASK as any, { isTutor: true, mode: 'replay' }).handwrite).toBe(false)
    expect(cardWindowActions(TASK as any, { isTutor: true, mode: 'readonly' }).handwrite).toBe(false)
    expect(cardWindowActions({ ...TASK, data: {} } as any, TEACHER).handwrite).toBe(false)
  })
})

// ─── етап 1: розв'язує Інтегралик ───────────────────────────────────────────

const PDF_CUT = { id: 'pdffrag-1', type: 'image', src: 'https://cdn.m4sh.org/wb/cut.png', x: 60, y: 60, w: 700, h: 300 }
const OPEN_TASK = { id: 'task-2', type: 'nmt_task', x: 60, y: 60, w: 800, h: 500, data: { question: 'Знайдіть $x$' } }
const CARD = { id: 'card-1', type: 'theory_card', x: 60, y: 60, w: 600, h: 300, data: { title: 'Задача', body: '$3x = 12$' } }

describe('що може розв\'язати Інтегралик', () => {
  it('задача, картка, картинка з адресою; data:/blob: і решта — ні', () => {
    expect(isIntegralykSolvable(PDF_CUT)).toBe(true)
    expect(isIntegralykSolvable(OPEN_TASK)).toBe(true)
    expect(isIntegralykSolvable(CARD)).toBe(true)
    expect(isIntegralykSolvable({ ...PDF_CUT, src: 'data:image/png;base64,AAA' })).toBe(false)
    expect(isIntegralykSolvable({ ...PDF_CUT, src: 'blob:https://m4sh.org/x' })).toBe(false)
    expect(isIntegralykSolvable({ type: 'sticky' })).toBe(false)
    expect(isIntegralykSolvable(null)).toBe(false)
  })

  it('✍ у групі дій картки: картка без розв\'язку — лише з дозволом кімнати (Інтегралик)', () => {
    const teacher = { isTutor: true, mode: 'edit' }
    expect(cardWindowActions(CARD as any, teacher).handwrite).toBe(false)
    expect(cardWindowActions(CARD as any, { ...teacher, canSolve: true }).handwrite).toBe(true)
    expect(cardWindowActions(OPEN_TASK as any, { ...teacher, canSolve: true }).handwrite).toBe(true)
    expect(cardWindowActions(PDF_CUT as any, { ...teacher, canSolve: true }).handwrite).toBe(true)
    expect(cardWindowActions(PDF_CUT as any, teacher).handwrite).toBe(false)
    expect(cardWindowActions({ ...PDF_CUT, src: 'blob:x' } as any, { ...teacher, canSolve: true }).handwrite).toBe(false)
    expect(cardWindowActions(CARD as any, { isTutor: true, mode: 'replay', canSolve: true }).handwrite).toBe(false)
    expect(cardWindowActions(CARD as any, { isTutor: false, mode: 'edit', canSolve: true }).handwrite).toBe(false)
  })

  it("позначка Інтегралика на ✍ — лише коли розв'язуватиме він (власник 18.10)", () => {
    const solver = { isTutor: true, mode: 'edit', canSolve: true }
    expect(cardWindowActions(PDF_CUT as any, solver).handwriteSolves).toBe(true)
    expect(cardWindowActions(CARD as any, solver).handwriteSolves).toBe(true)
    expect(cardWindowActions(OPEN_TASK as any, solver).handwriteSolves).toBe(true)
    // Готовий розв'язок банку — без позначки, і з правом Інтегралика, і без нього.
    expect(cardWindowActions(TASK as any, solver)).toMatchObject({ handwrite: true, handwriteSolves: false })
    expect(cardWindowActions(TASK as any, { isTutor: true, mode: 'edit' }).handwriteSolves).toBe(false)
    expect(cardWindowActions(PDF_CUT as any, { isTutor: true, mode: 'edit' }).handwriteSolves).toBe(false)
    expect(cardWindowActions(PDF_CUT as any, { ...solver, mode: 'replay' }).handwriteSolves).toBe(false)
  })
})

describe('solveAndHandwrite', () => {
  beforeEach(() => { stopHandwriting(); vi.mocked(notifyInfo).mockClear(); vi.mocked(notifyWarning).mockClear() })

  it('вирізка з PDF: Інтегралик розв\'язує за id об\'єкта, розв\'язок пишеться поруч тим самим шляхом', async () => {
    const { deps, page, runAll } = makeDeps({ assets: [PDF_CUT] })
    const done = solveAndHandwrite(PDF_CUT, deps)
    await flush()
    runAll()
    expect(await done).toEqual({ status: 'written', strokes: 3, pageId: 'p1', newPage: false })
    expect(deps.fetchSolve).toHaveBeenCalledWith('board-1', 'pdffrag-1')
    expect((deps.fetchLayout as any).mock.calls[0][0]).toMatchObject({ text: '$2x = 4$\n$x = 2$', answer: '$2$', mode: 'full' })
    expect(page.strokes[0].points[0].x).toBe(PDF_CUT.x + PDF_CUT.w + 40)
    expect(handwriteBusyId.value).toBeNull()
  })

  it('задача банку з правом Інтегралика — короткий запис сервера (формули + слова) як є', async () => {
    const brief = { text: '$x + 2 = 5$\nперенесемо $2$\n$x = 3$', answer: 'Б' }
    const { deps, runAll } = makeDeps({ solve: async () => brief })
    const done = solveAndHandwrite(TASK, deps)
    await flush()
    runAll()
    expect((await done).status).toBe('written')
    expect(deps.fetchSolve).toHaveBeenCalledWith('board-1', 'task-1')
    expect((deps.fetchLayout as any).mock.calls[0][0]).toMatchObject({ text: brief.text, answer: 'Б', mode: 'full' })
  })

  it('без права Інтегралика задача банку — самими формулами з картки, сервера не питаємо', async () => {
    const { deps, runAll } = makeDeps()
    const done = handwriteTaskSolution(TASK, deps)
    await flush()
    runAll()
    expect((await done).status).toBe('written')
    expect(deps.fetchSolve).not.toHaveBeenCalled()
    expect((deps.fetchLayout as any).mock.calls[0][0]).toMatchObject({ text: TASK.data.solution, answer: 'Б', mode: 'steps' })
  })

  it('сервер відмовив чи впав — задача банку пишеться формулами з картки', async () => {
    for (const solve of [async () => ({ error: 'mismatch' as const }), async () => { throw new Error('мережа') }]) {
      const { deps, runAll } = makeDeps({ solve })
      const done = handwriteTaskSolution(TASK, deps, { canSolve: true })
      await flush()
      runAll()
      expect((await done).status).toBe('written')
      expect((deps.fetchLayout as any).mock.calls[0][0]).toMatchObject({ text: TASK.data.solution, mode: 'steps' })
    }
  })

  it('без права Інтегралика картинку й картку не розв\'язуємо', async () => {
    const { deps } = makeDeps({ assets: [PDF_CUT] })
    expect(await solveAndHandwrite(PDF_CUT, deps, { canSolve: false })).toEqual({ status: 'no_solution' })
    expect(deps.fetchSolve).not.toHaveBeenCalled()
  })

  it('поки розв\'язує — значок зайнятий, друге натискання «зайнято»', async () => {
    let answer!: (v: SolveOutcome) => void
    const { deps, runAll } = makeDeps({ assets: [CARD], solve: () => new Promise((r) => { answer = r }) })
    const done = solveAndHandwrite(CARD, deps)
    await flush()
    expect(handwriteBusyId.value).toBe('card-1')
    expect(await solveAndHandwrite(CARD, makeDeps({ assets: [CARD] }).deps)).toEqual({ status: 'busy' })
    expect(await handwriteTaskSolution(TASK, makeDeps().deps)).toEqual({ status: 'busy' })
    answer({ text: '$3x = 12$\n$x = 4$', answer: '$4$' })
    await flush()
    expect(handwriteBusyId.value).toBe('card-1')        // тепер пише рука — усе ще зайнято
    runAll()
    expect((await done).status).toBe('written')
    expect(handwriteBusyId.value).toBeNull()
  })

  it('чесні відмови сервера нічого не пишуть і не кладуть «Скасувати»', async () => {
    for (const error of ['no_task', 'unsure', 'mismatch', 'not_readable', 'solver_unavailable'] as const) {
      const { deps, store, page } = makeDeps({ assets: [PDF_CUT], solve: async () => ({ error }) })
      expect(await solveAndHandwrite(PDF_CUT, deps)).toEqual({ status: error })
      expect(page.strokes).toHaveLength(0)
      expect(store.undoStack).toHaveLength(0)
    }
    const u = makeDeps({ assets: [PDF_CUT], solve: async () => ({ error: 'unsupported' }) })
    expect(await solveAndHandwrite(PDF_CUT, u.deps)).toEqual({ status: 'unsupported', detail: '' })
    expect(handwriteBusyId.value).toBeNull()
  })

  it('поки розв\'язував, об\'єкт прибрали — нічого не пише', async () => {
    let answer!: (v: SolveOutcome) => void
    const { deps, page, store } = makeDeps({ assets: [PDF_CUT], solve: () => new Promise((r) => { answer = r }) })
    const done = solveAndHandwrite(PDF_CUT, deps)
    await flush()
    page.assets = []
    answer({ text: '$x = 2$', answer: '$2$' })
    expect(await done).toEqual({ status: 'blocked' })
    expect(store.undoStack).toHaveLength(0)
    expect(deps.fetchLayout).not.toHaveBeenCalled()
  })

  it('нова сторінка: копія картинки як є (без даних задачі), рукопис навколо неї', async () => {
    const nofit: HandwriteLayout = { fits: false, needed_height: 2000 }
    const { deps, pages, runAll } = makeDeps({ assets: [PDF_CUT], layouts: [nofit, nofit, layout(2)] })
    const done = solveAndHandwrite(PDF_CUT, deps)
    await flush()
    runAll()
    expect(await done).toMatchObject({ status: 'written', newPage: true, pageId: 'p2' })
    const copy = pages[1].assets[0]
    expect(copy).toMatchObject({ type: 'image', src: PDF_CUT.src, x: 40, y: 40, w: PDF_CUT.w, h: PDF_CUT.h })
    expect(copy.id).not.toBe(PDF_CUT.id)
    expect(copy.data).toBeUndefined()
  })

  it('пояснення вчителю: «розв\'язує…» на старті, причина відмови — словами', async () => {
    const ok = makeDeps({ assets: [PDF_CUT] })
    const done = solveWithFeedback(PDF_CUT, () => {}, ok.deps)
    await flush()
    ok.runAll()
    await done
    expect(notifyInfo).toHaveBeenCalledWith('assistant:winterboard.handwrite.solving')

    const img = makeDeps({ assets: [PDF_CUT], solve: async () => ({ error: 'unsure' }) })
    await solveWithFeedback(PDF_CUT, () => {}, img.deps)
    expect(notifyWarning).toHaveBeenCalledWith('assistant:winterboard.handwrite.unsureImage')
    const card = makeDeps({ assets: [OPEN_TASK], solve: async () => ({ error: 'unsure' }) })
    await solveWithFeedback(OPEN_TASK, () => {}, card.deps)
    expect(notifyWarning).toHaveBeenCalledWith('winterboard.handwrite.unsure')
    const none = makeDeps({ assets: [CARD], solve: async () => ({ error: 'no_task' }) })
    await solveWithFeedback(CARD, () => {}, none.deps)
    expect(notifyInfo).toHaveBeenCalledWith('assistant:winterboard.handwrite.noTask')
  })
})
