// LAW §9 v1.32 · покрокове письмо з пульта (ТЗ TZ_HANDWRITE_STEP_BY_STEP_PULT_2026-10-18): прогрес — зі штрихів
// сторінки (І1), ніколи поверх (І3), один крок — одне «Скасувати» (І5), один рукопис за раз (І7), Р1–Р4.
// Мережі й стору немає — підставні залежності.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import soloSource from '../views/WBSoloRoom.vue?raw'
import classroomSource from '../views/WBClassroomRoom.vue?raw'
import {
  originalOfCopy, parseStepId, placeStep, shortHash, stepSessions, stepStrokeId, unfinishedSession,
} from '../board/handwriteSteps'
import {
  clearHandwriteStepsCache, handwriteNextStep, handwriteStepState, handwriteTaskSolution, hasStepTarget, stopHandwriting,
  type HandwriteDeps, type HandwriteLayoutRequest,
} from '../composables/useHandwriteSolution'

vi.mock('@/utils/notify', () => ({ notifyError: vi.fn(), notifyInfo: vi.fn(), notifyWarning: vi.fn() }))
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))
vi.mock('@/modules/intent/assistantLook', () => ({ tAssistantGlobal: (k: string) => `assistant:${k}` }))

// ─── чиста логіка ───────────────────────────────────────────────────────────

const MARK = { obj: shortHash('task-1'), text: shortHash('a'), step: 2, total: 5, k: 1, x: 900, w: 940, nonce: 'q7', n: 3 }

describe('board/handwriteSteps', () => {
  it('позначка штриха: туди й назад; чуже чи зіпсоване — не крок', () => {
    expect(shortHash('task-1')).toMatch(/^[0-9a-z]{6}$/)
    expect(shortHash('task-1')).toBe(shortHash('task-1'))
    expect(parseStepId(stepStrokeId(MARK))).toEqual(MARK)
    expect(parseStepId('hw-lmn-1-0')).toBeNull()                           // рукопис ✍ (увесь розв'язок)
    expect(parseStepId(stepStrokeId({ ...MARK, step: 6 }))).toBeNull()    // крок більший за всі
    expect(parseStepId(42)).toBeNull()
  })

  it('прогрес зі сторінки: найбільший написаний крок, низ, свіжість; копія задачі веде до оригіналу', () => {
    const page = {
      strokes: [
        { id: stepStrokeId({ ...MARK, step: 1, n: 0 }), points: [{ x: 900, y: 100 }, { x: 950, y: 140 }] },
        { id: 'manual-1', points: [{ x: 10, y: 10 }] },
        { id: stepStrokeId({ ...MARK, step: 2, n: 0 }), points: [{ x: 900, y: 160 }, { x: 950, y: 200 }] },
        { id: stepStrokeId({ ...MARK, obj: shortHash('other'), step: 5, n: 0 }), points: [{ x: 1, y: 1 }] },
      ],
    }
    const sessions = stepSessions(page)
    expect(sessions).toHaveLength(2)
    expect(sessions.find((s) => s.obj === MARK.obj)).toMatchObject({ written: 2, total: 5, bottom: 200, last: 2, x: 900 })
    expect(unfinishedSession(page)?.obj).toBe(MARK.obj)                  // інший — уже готовий (5 з 5)
    expect(originalOfCopy(`tsk-hw-${MARK.obj}-xyz`)).toBe(MARK.obj)
    expect(originalOfCopy('tsk-hw-lmnopqrst')).toBeNull()                 // копія ✍ (не покрокова)
  })

  it('місце кроку: під попереднім, а якщо там написано — нижче за написане; до низу не влізло — null', () => {
    const page = { strokes: [{ size: 2, points: [{ x: 950, y: 300 }, { x: 1100, y: 340 }] }], assets: [] }
    expect(placeStep(page, 900, 200, { w: 300, h: 40 }, 1080, 20)).toBe(200)          // над чужим письмом місце є
    expect(placeStep(page, 900, 280, { w: 300, h: 40 }, 1080, 20)).toBe(341 + 20)    // нижче за чуже
    expect(placeStep(page, 900, 1000, { w: 300, h: 60 }, 1080, 20)).toBeNull()
    expect(placeStep({ strokes: [], assets: [] }, 900, 200, { w: 300, h: 40 }, 1080, 20, [{ x: 900, y: 190, w: 300, h: 40 }]))
      .toBe(250)                                                                        // заплановане теж перешкода
  })
})

// ─── письмо кроками ─────────────────────────────────────────────────────────

const TASK = {
  id: 'task-1', type: 'nmt_task', x: 60, y: 60, w: 800, h: 300,
  data: { solution: 'Маємо $x + 2 = 5$, отже $x = 3$.', options: [{ letter: 'А', isCorrect: false }, { letter: 'Б', isCorrect: true }] },
}
const STEPS = ['$x + 2 = 5$', 'перенесемо $2$', '$x = 3$', 'Відповідь: Б']
const LINE_H = 40

function makeDeps(opts: { steps?: string[]; strokes?: any[]; pages?: any[]; assets?: any[]; solve?: () => Promise<any> } = {}) {
  const steps = opts.steps ?? STEPS
  const page = { id: 'p1', width: 1920, height: 1080, assets: (opts.assets ?? [TASK]) as any[], strokes: (opts.strokes ?? []) as any[] }
  const pages: any[] = [page, ...(opts.pages ?? [])]
  const store = {
    mode: 'edit', workspaceId: 'board-1', currentPageIndex: 0, pages,
    undoStack: [] as any[], redoStack: [] as any[],
    addStroke: vi.fn((s: any, o?: { pageId?: string }) => {
      const pg = pages.find((p) => p.id === (o?.pageId ?? pages[store.currentPageIndex].id))!
      pg.strokes = [...pg.strokes, s]
    }),
    deleteStroke: vi.fn((id: string) => { for (const pg of pages) pg.strokes = pg.strokes.filter((s: any) => s.id !== id) }),
    addAsset: vi.fn((a: any, pageId: string) => { const pg = pages.find((p) => p.id === pageId)!; pg.assets = [...pg.assets, a] }),
    deleteAsset: vi.fn((id: string) => { for (const pg of pages) pg.assets = pg.assets.filter((a: any) => a.id !== id) }),
    addPageUndoable: vi.fn(() => {
      const np = { id: `p${pages.length + 1}`, width: 1920, height: 1080, assets: [] as any[], strokes: [] as any[] }
      pages.splice(store.currentPageIndex + 1, 0, np)
      store.currentPageIndex += 1
      return np.id
    }),
  }
  const sync = { mode: 'SYNC', inputLocked: false }
  const queue: Array<() => void> = []
  const deps: HandwriteDeps = {
    store: store as any,
    sync,
    // Розкладка: кожен рядок — 2 штрихи заввишки LINE_H; `steps` — рядки запису (як `/solution/`).
    fetchLayout: vi.fn(async (req: HandwriteLayoutRequest) => {
      const lines = req.text.split('\n')
      const h = LINE_H * lines.length
      if (h > req.height) return { fits: false as const, needed_height: h, steps }
      const strokes = lines.flatMap((_, li) => [
        { p: [[0, li * LINE_H], [40, li * LINE_H + 30]], t: 100 * (2 * li + 1) },
        { p: [[50, li * LINE_H], [90, li * LINE_H + 30]], t: 100 * (2 * li + 2) },
      ])
      return { fits: true as const, scale: req.scale ?? 46, size: 3, w: 90, h, duration_ms: 200, strokes, steps }
    }),
    fetchSolve: vi.fn(opts.solve ?? (async () => ({ text: 'x', answer: 'Б' }))),
    schedule: (fn) => { queue.push(fn); return () => { const i = queue.indexOf(fn); if (i >= 0) queue.splice(i, 1) } },
  }
  const runAll = () => { while (queue.length) queue.shift()!() }
  return { deps, store, page, pages, runAll, queue }
}

const flush = () => new Promise((r) => setTimeout(r, 0))
async function press(d: ReturnType<typeof makeDeps>, opts: any = { canSolve: true, selected: TASK }) {
  const done = handwriteNextStep(opts, d.deps)
  for (let i = 0; i < 5; i++) { await flush(); d.runAll() }
  return done
}
const stepsOn = (page: any) => page.strokes.map((s: any) => parseStepId(s.id)).filter(Boolean)
const bottomOf = (page: any, step: number) => Math.max(...page.strokes.filter((s: any) => parseStepId(s.id)?.step === step)
  .flatMap((s: any) => s.points.map((p: any) => p.y)))
const topOf = (page: any, step: number) => Math.min(...page.strokes.filter((s: any) => parseStepId(s.id)?.step === step)
  .flatMap((s: any) => s.points.map((p: any) => p.y)))

describe('handwriteNextStep', () => {
  beforeEach(() => { stopHandwriting(); clearHandwriteStepsCache() })

  it('один натиск — один рядок біля задачі; штрихи з позначкою кроку; одне «Скасувати»; пульт «Крок 1 з 4»', async () => {
    const d = makeDeps()
    expect(await press(d)).toEqual({ status: 'written', from: 1, to: 1, total: 4 })
    const marks = stepsOn(d.page)
    expect(marks).toHaveLength(2)
    expect(marks.every((m: any) => m.step === 1 && m.total === 4 && m.obj === shortHash('task-1'))).toBe(true)
    expect(d.page.strokes[0].points[0].x).toBe(TASK.x + TASK.w + 40)       // праворуч від задачі, як у ✍
    expect(d.store.undoStack).toHaveLength(1)
    expect(handwriteStepState(d.page)).toEqual({ status: 'idle', written: 1, total: 4 })
  })

  it('другий натиск — наступний рядок під першим, у тому ж стовпчику й тим самим розміром', async () => {
    const d = makeDeps()
    await press(d)
    expect(await press(d)).toMatchObject({ status: 'written', from: 2, to: 2 })
    expect(topOf(d.page, 2)).toBeGreaterThan(bottomOf(d.page, 1))
    const scales = (d.deps.fetchLayout as any).mock.calls.map((c: any) => c[0].scale).filter((s: any) => s !== undefined)
    expect(new Set(scales).size).toBe(1)
    expect(d.store.undoStack).toHaveLength(2)                               // крок — свій «Скасувати»
  })

  it('учитель чи учень дописав під розв\'язком — наступний рядок нижче за написане, не поверх', async () => {
    const d = makeDeps()
    await press(d); await press(d)
    const x = d.page.strokes[0].points[0].x
    const under = bottomOf(d.page, 2) + 30
    d.page.strokes = [...d.page.strokes, { id: 'manual', size: 2, points: [{ x: x + 10, y: under }, { x: x + 200, y: under + 80 }] }]
    await press(d)
    expect(topOf(d.page, 3)).toBeGreaterThan(under + 80)
  })

  it('«Скасувати» прибирає лише останній крок — і наступний натиск пише його знову (новими штрихами)', async () => {
    const d = makeDeps()
    await press(d); await press(d)
    const oldIds = d.page.strokes.filter((s: any) => parseStepId(s.id)?.step === 2).map((s: any) => s.id)
    d.store.undoStack[d.store.undoStack.length - 1].revert()
    expect(stepsOn(d.page).every((m: any) => m.step === 1)).toBe(true)
    expect(handwriteStepState(d.page)).toMatchObject({ written: 1, total: 4 })
    expect(await press(d)).toMatchObject({ from: 2, to: 2 })
    const newIds = d.page.strokes.filter((s: any) => parseStepId(s.id)?.step === 2).map((s: any) => s.id)
    expect(newIds.some((id: string) => oldIds.includes(id))).toBe(false)
  })

  it('перезавантаження: прогрес — зі штрихів сторінки, продовжує з наступного кроку', async () => {
    const a = makeDeps()
    await press(a); await press(a)
    clearHandwriteStepsCache()
    const b = makeDeps({ strokes: a.page.strokes })                         // «нова вкладка», та сама сторінка
    expect(await press(b, { canSolve: true, selected: null, fallback: () => null })).toMatchObject({ from: 3, to: 3 })
  })

  it('усі кроки написано — «Готово», нічого не пише', async () => {
    const d = makeDeps()
    for (let i = 0; i < 4; i++) await press(d)
    const before = d.page.strokes.length
    expect(await press(d)).toEqual({ status: 'done', total: 4 })
    expect(d.page.strokes.length).toBe(before)
    expect(handwriteStepState(d.page)).toEqual({ status: 'done', written: 4, total: 4 })
  })

  it('Р4: ✍ на ноутбуці посеред покрокового — дописує решту одним «Скасувати»', async () => {
    const d = makeDeps()
    await press(d)
    const done = handwriteTaskSolution(TASK, d.deps, { canSolve: true })
    for (let i = 0; i < 6; i++) { await flush(); d.runAll() }
    expect((await done).status).toBe('written')
    expect(new Set(stepsOn(d.page).map((m: any) => m.step))).toEqual(new Set([1, 2, 3, 4]))
    expect(d.store.undoStack).toHaveLength(2)                               // крок 1 + решта разом
  })

  it('натиск, поки пише попередній крок, — нічого не додає («зайнято»)', async () => {
    const d = makeDeps()
    const first = handwriteNextStep({ canSolve: true, selected: TASK }, d.deps)
    await flush(); await flush()
    expect(await handwriteNextStep({ canSolve: true, selected: TASK }, makeDeps().deps)).toEqual({ status: 'busy' })
    for (let i = 0; i < 5; i++) { await flush(); d.runAll() }
    await first
  })

  it('продовження на іншій сторінці — тут не починає вдруге', async () => {
    const other = { id: 'p9', width: 1920, height: 1080, assets: [], strokes: [] as any[] }
    const a = makeDeps()
    await press(a)
    other.strokes = a.page.strokes                                           // той самий розв'язок — на p9
    const b = makeDeps({ pages: [other] })
    expect(await press(b)).toMatchObject({ status: 'refused', reason: 'elsewhere' })
    expect(b.page.strokes).toHaveLength(0)
  })

  it('унизу немає місця — крок на новій сторінці з копією задачі; копія веде до того самого розв\'язку', async () => {
    const tall = { ...TASK, h: 980 }                                        // біля задачі місця немає
    const wall = { id: 'wall', x: 900, y: 0, w: 1020, h: 1080 }
    const d = makeDeps({ assets: [tall, wall] })
    expect(await press(d, { canSolve: true, selected: tall })).toMatchObject({ status: 'written', from: 1 })
    expect(d.store.currentPageIndex).toBe(1)
    const copy = d.pages[1].assets[0]
    expect(originalOfCopy(copy.id)).toBe(shortHash('task-1'))
    expect(stepsOn(d.pages[1]).every((m: any) => m.step === 1)).toBe(true)
    // На новій сторінці наступний натиск продовжує той самий розв'язок.
    expect(await press(d, { canSolve: true, selected: null, fallback: () => null })).toMatchObject({ from: 2 })
  })

  it('Р3: розв\'язок на сервері оновився — новий розв\'язок окремо, старий не змішується', async () => {
    const a = makeDeps()
    await press(a)
    clearHandwriteStepsCache()                                              // нова вкладка: кроки — з сервера заново
    const b = makeDeps({ strokes: a.page.strokes, steps: ['$x = 3$', 'Відповідь: Б'] })
    expect(await press(b)).toMatchObject({ status: 'written', from: 1, total: 2 })
    expect(stepSessions(b.page)).toHaveLength(2)
  })

  it('без права Інтегралика — задача банку покроково формулами з картки, сервер розв\'язків не питаємо', async () => {
    const d = makeDeps()
    expect(await press(d, { canSolve: false, selected: TASK })).toMatchObject({ status: 'written', from: 1 })
    expect(d.deps.fetchSolve).not.toHaveBeenCalled()
    expect((d.deps.fetchLayout as any).mock.calls[0][0]).toMatchObject({ mode: 'steps', text: TASK.data.solution })
  })

  it('Р1: виділеного немає — бере задачу, як «✍️ Розв\'язок рукою» з пульта; нічого немає — відмова словами', async () => {
    const d = makeDeps()
    expect(await press(d, { canSolve: true, selected: null, fallback: () => TASK })).toMatchObject({ status: 'written' })
    const e = makeDeps({ assets: [] })
    expect(await press(e, { canSolve: true, selected: null, fallback: () => null })).toMatchObject({ status: 'refused', reason: 'no_solution' })
    expect(handwriteStepState(e.page)).toMatchObject({ status: 'refused', reason: 'no_solution' })
  })
})

describe('hasStepTarget — чи показувати «✍️ Наступний рядок» на пульті', () => {
  it('виділена вирізка з PDF з правом Інтегралика — так; без права чи без виділення — ні; незавершений розв\'язок — так', async () => {
    const cut = { id: 'pdffrag-1', type: 'image', src: 'https://cdn.m4sh.org/wb/cut.png', x: 60, y: 60, w: 600, h: 200 }
    const d = makeDeps({ assets: [cut] })
    expect(hasStepTarget(d.store as any, { canSolve: true, selected: cut })).toBe(true)
    expect(hasStepTarget(d.store as any, { canSolve: false, selected: cut })).toBe(false)
    expect(hasStepTarget(d.store as any, { canSolve: true, selected: null, fallback: () => null })).toBe(false)
    clearHandwriteStepsCache()
    const t = makeDeps()
    await press(t)
    expect(hasStepTarget(t.store as any, { canSolve: true, selected: null, fallback: () => null })).toBe(true)
  })
})

describe('кімнати: право Інтегралика оголошено до пульта', () => {
  // Стан пульта (v1.32) читає право вже під час створення кімнати: пізніше оголошення валить дошку
  // («Cannot access 'canSolveHandwrite' before initialization», стенд 18.10). Кімнати в тестах не монтуються.
  it.each([['WBSoloRoom', soloSource], ['WBClassroomRoom', classroomSource]])('%s', (_name, src) => {
    const decl = src.indexOf('const canSolveHandwrite = computed(')
    const remote = src.indexOf('useBoardRemote({')
    expect(decl).toBeGreaterThan(0)
    expect(remote).toBeGreaterThan(decl)
  })
})
