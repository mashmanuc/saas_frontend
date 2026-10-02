/**
 * LAW §9 v1.20 — Інтегралик текстом з пульта на ноутбуці (власник 2026-09-29: «поки учні працюють
 * над одним, я можу готувати матеріал далі… тексти з пульта лишати на пультові, щоб дошка була чистою»).
 *
 *   • окрема розмова (свій conversation_id і історія), відповідь — лише остання, на телефон;
 *   • новий матеріал — на ПІДГОТОВЧУ сторінку одразу після поточної, екран не перемикається;
 *     та сама сторінка далі, поки вчитель на неї не перейшов;
 *   • зміни наявного, навігація, план, дії робочого простору — чесна відповідь, нічого не виконується;
 *   • ризик → «Так/Ні»; повтор запиту не виконується вдруге; поки думає — «зачекайте».
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({ useWBStore: () => ({}) }))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { createRemoteAssistant, REMOTE_REPLY_TEXT_MAX } from '../remoteAssistant'
import { PREP_PAGE_KINDS } from '../boardActions'

const REQ = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const K = 'winterboard.remote.assistant.'

type Reply = { request_id: string; status: string; text?: string; page_id?: string }

function fakeStore(names = ['A', 'B']) {
  const store = reactive({
    pages: names.map((n) => ({ id: `p-${n}` })),
    currentPageIndex: 0,
    inserted: 0,
    withoutHistory: 0,
    get currentPage() { return this.pages[this.currentPageIndex] },
    insertPageAfterCurrent() {
      if (this.pages.length >= 50) return ''
      const id = `prep-${++this.inserted}`
      this.pages.splice(this.currentPageIndex + 1, 0, { id })
      return id
    },
    async runWithoutHistory(fn: () => Promise<unknown>) {
      this.withoutHistory += 1
      return fn()
    },
  })
  return store
}

const GRAPH = { status: 'board_action', risk: 'low', action: { kind: 'add_graph', payload: { expression: 'x^2' } }, explain: 'Побудував графік y = x^2' }

function setup(over: Record<string, unknown> = {}) {
  const store = fakeStore()
  const replies: Reply[] = []
  const parse = vi.fn(async (..._a: unknown[]) => GRAPH as Record<string, unknown>)
  const runAction = vi.fn(async (..._a: unknown[]) => {})
  const applyCorridor = vi.fn()
  const deps = {
    boardId: () => 'board-1',
    locale: () => 'uk',
    page: () => ({ path: '/winterboard/board-1', name: 'wb' }),
    canUse: () => true as true | string,
    parse,
    buildSummary: vi.fn(async () => ({ pages: 2 })),
    buildTools: vi.fn(async () => []),
    runAction,
    getStore: async () => store,
    applyCorridor,
    newConversationId: () => 'conv-pult',
    isLimitError: (e: any) => e?.limit === true,
    isServerDisabled: (e: any) => e?.off === true,
    serverDisabledText: 'Інтегралик вимкнено на сервері',
    humanError: (e: any) => `людською: ${e?.message}`,
    errorCode: (e: any) => e?.code ?? null,
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key),
    reply: (r: Reply) => { replies.push(r) },
    ...over,
  }
  const ra = createRemoteAssistant(deps)
  // повертаємо те, що справді дісталось залежностям (разом із переданими підробками)
  return { ra, store, replies, parse: deps.parse as typeof parse, runAction: deps.runAction as typeof runAction, applyCorridor, deps }
}
const last = (r: Reply[]) => r[r.length - 1]
const ids = (store: ReturnType<typeof fakeStore>) => store.pages.map((p) => p.id)

describe('матеріал — на підготовчу сторінку одразу після поточної, без переходу', () => {
  it('нова сторінка після поточної; екран на своїй; дія отримує саме її; «done» з id сторінки', async () => {
    const { ra, store, replies, runAction } = setup()
    await ra.ask({ requestId: REQ(1), text: 'побудуй y = x^2' })
    expect(ids(store)).toEqual(['p-A', 'prep-1', 'p-B'])
    expect(store.currentPageIndex).toBe(0)
    expect(runAction).toHaveBeenCalledWith(GRAPH.action, { pageId: 'prep-1' })
    expect(store.withoutHistory).toBe(1)          // поза історією ↶ ноутбука
    expect(replies.map((r) => r.status)).toEqual(['thinking', 'done'])
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'done', text: GRAPH.explain, page_id: 'prep-1' })
  })

  it('наступний запит — на ту саму сторінку; учитель перейшов на неї — далі нова', async () => {
    const { ra, store } = setup()
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    await ra.ask({ requestId: REQ(2), text: 'ще графік' })
    expect(ids(store)).toEqual(['p-A', 'prep-1', 'p-B'])
    store.currentPageIndex = 1                    // «Показати»
    await nextTick()
    await ra.ask({ requestId: REQ(3), text: 'наступна задача' })
    expect(ids(store)).toEqual(['p-A', 'prep-1', 'prep-2', 'p-B'])
    expect(store.currentPageIndex).toBe(1)
  })

  it('показали й повернулись — показана сторінка вже не підготовча', async () => {
    const { ra, store } = setup()
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    store.currentPageIndex = 1
    await nextTick()
    store.currentPageIndex = 0
    await nextTick()
    await ra.ask({ requestId: REQ(2), text: 'ще' })
    expect(ids(store)).toEqual(['p-A', 'prep-2', 'prep-1', 'p-B'])
  })

  it('підготовчу сторінку видалили — наступний матеріал на нову', async () => {
    const { ra, store } = setup()
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    store.pages.splice(1, 1)
    await ra.ask({ requestId: REQ(2), text: 'ще' })
    expect(ids(store)).toEqual(['p-A', 'prep-2', 'p-B'])
  })

  it('стеля 50 сторінок — error, дій немає', async () => {
    const { ra, store, replies, runAction } = setup()
    store.pages = Array.from({ length: 50 }, (_, i) => ({ id: `x${i}` }))
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    expect(runAction).not.toHaveBeenCalled()
    expect(last(replies)).toMatchObject({ status: 'error', text: `${K}maxPages` })
  })
})

describe('з пульта — лише новий матеріал', () => {
  it.each([
    ['зміна параметра', { status: 'board_action', risk: 'low', action: { kind: 'set_param', payload: {} }, explain: 'a = 3' }],
    ['видалення об\'єкта', { status: 'board_action', risk: 'high', action: { kind: 'delete_object', payload: {} }, explain: 'видалю' }],
    ['«прибери з умови»', { status: 'board_action', risk: 'low', action: { kind: 'update_card', payload: {} }, explain: 'ok' }],
    ['вихід із дошки', { status: 'board_action', risk: 'medium', action: { kind: 'close_board' }, explain: 'вийду' }],
    ['дія робочого простору', { status: 'propose', risk: 'low', capability: 'knowledge.save_draft', explain: 'збережу' }],
    ['мішаний план', { status: 'board_action_plan', actions: [{ kind: 'add_card' }, { kind: 'move_object' }], explain: 'план' }],
  ])('%s — чесна відповідь, нічого не виконується, сторінки немає', async (_n, response) => {
    const { ra, store, replies, runAction } = setup({ parse: vi.fn(async () => response) })
    await ra.ask({ requestId: REQ(1), text: 'щось' })
    expect(runAction).not.toHaveBeenCalled()
    expect(ids(store)).toEqual(['p-A', 'p-B'])
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'reply', text: `${K}onlyNew` })
  })

  it('план уроку — у вікні на ноутбуці', async () => {
    const { ra, replies } = setup({ parse: vi.fn(async () => ({ status: 'plan_action', plan: {} })) })
    await ra.ask({ requestId: REQ(1), text: 'склади план' })
    expect(last(replies)).toMatchObject({ status: 'reply', text: `${K}planOnLaptop` })
  })

  it('усі дії, що створюють матеріал, — у переліку; зміни наявного — ні', () => {
    for (const kind of ['add_text', 'add_image', 'add_formula', 'add_timeline', 'add_map', 'add_history_card', 'add_card', 'add_page', 'add_graph', 'add_tool']) {
      expect(PREP_PAGE_KINDS).toContain(kind)
    }
    for (const kind of ['set_param', 'move_object', 'resize_object', 'delete_object', 'update_card', 'graph_add_expression', 'graph_add_tangent', 'move_object_to_page', 'set_geometry', 'delete_page']) {
      expect(PREP_PAGE_KINDS).not.toContain(kind)
    }
  })
})

describe('план із кількох дій, уточнення, звичайна відповідь', () => {
  it('Б-141: план із позначкою сервера — зламана остання формула не створює навіть підготовчої сторінки', async () => {
    const actions = [{ ...GRAPH.action, math_contract: 1 }, { kind: 'add_card', math_contract: 1, payload: { body: '$x' } }]
    const {ra, store, runAction, replies} = setup({parse: vi.fn(async () => ({status: 'board_action_plan', actions}))})
    await ra.ask({requestId: REQ(1), text: 'приклади'})
    expect(store.inserted).toBe(0)
    expect(runAction).not.toHaveBeenCalled()
    expect(last(replies).status).toBe('error')
  })
  it('усі кроки — на одну підготовчу сторінку', async () => {
    const actions = [{ kind: 'add_card', payload: {} }, { kind: 'add_graph', payload: {} }]
    const { ra, store, runAction, replies } = setup({ parse: vi.fn(async () => ({ status: 'board_action_plan', actions, explain: 'Задача і графік' })) })
    await ra.ask({ requestId: REQ(1), text: 'задача з графіком' })
    expect(runAction.mock.calls.map((c) => c[1])).toEqual([{ pageId: 'prep-1' }, { pageId: 'prep-1' }])
    expect(ids(store)).toEqual(['p-A', 'prep-1', 'p-B'])
    expect(last(replies)).toMatchObject({ status: 'done', page_id: 'prep-1' })
  })

  it('крок плану не вдався — error з номером кроку', async () => {
    const actions = [{ kind: 'add_card', payload: {} }, { kind: 'add_graph', payload: {} }]
    const runAction = vi.fn(async (a: any) => { if (a.kind === 'add_graph') throw new Error('Вираз не зрозумів') })
    const { ra, replies } = setup({ runAction, parse: vi.fn(async () => ({ status: 'board_action_plan', actions, explain: 'x' })) })
    await ra.ask({ requestId: REQ(1), text: 'задача з графіком' })
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'error', text: `${K}stepFailed${JSON.stringify({ n: 2, reason: 'Вираз не зрозумів' })}` })
  })

  it('одна дія не вдалася — людський текст обробника', async () => {
    const { ra, replies } = setup({ runAction: vi.fn(async () => { throw new Error('Картинка без джерела на дошку не йде.') }) })
    await ra.ask({ requestId: REQ(1), text: 'картинка' })
    expect(last(replies)).toMatchObject({ status: 'error', text: 'Картинка без джерела на дошку не йде.' })
  })

  it('уточнення — питання й варіанти одним текстом', async () => {
    const clarify = { status: 'clarify', question: 'Яку задачу?', candidates: [{ id: 'a', label: 'Першу' }, { id: 'b', label: 'Другу' }] }
    const { ra, replies } = setup({ parse: vi.fn(async () => clarify) })
    await ra.ask({ requestId: REQ(1), text: 'розбери задачу' })
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'reply', text: 'Яку задачу?\n1) Першу\n2) Другу' })
  })

  it('пояснення без дії — як є', async () => {
    const { ra, replies } = setup({ parse: vi.fn(async () => ({ status: 'explain', explain: 'Дискримінант — це…' })) })
    await ra.ask({ requestId: REQ(1), text: 'що таке дискримінант' })
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'reply', text: 'Дискримінант — це…' })
  })

  it('довга відповідь — у стелю сервера', async () => {
    const { ra, replies } = setup({ parse: vi.fn(async () => ({ status: 'explain', explain: 'я'.repeat(900) })) })
    await ra.ask({ requestId: REQ(1), text: 'поясни' })
    expect(last(replies).text).toHaveLength(REMOTE_REPLY_TEXT_MAX)
    expect(last(replies).text!.endsWith('…')).toBe(true)
  })
})

describe('підтвердження «Так / Ні»', () => {
  const RISKY = { status: 'board_action', risk: 'medium', action: { kind: 'add_page', payload: { name: 'Нова' } }, explain: 'Додам сторінку з карткою' }

  it('ризик → confirm; «Так» → матеріал на підготовчу', async () => {
    const { ra, replies, runAction, store } = setup({ parse: vi.fn(async () => RISKY) })
    await ra.ask({ requestId: REQ(1), text: 'додай сторінку' })
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'confirm', text: RISKY.explain })
    expect(runAction).not.toHaveBeenCalled()
    await ra.answer({ requestId: REQ(1), choice: 'yes' })
    expect(runAction).toHaveBeenCalledWith(RISKY.action, { pageId: 'prep-1' })
    expect(ids(store)).toEqual(['p-A', 'prep-1', 'p-B'])
    expect(last(replies)).toMatchObject({ status: 'done', page_id: 'prep-1' })
  })

  it('«Ні» → cancelled; нічого не виконано', async () => {
    const { ra, replies, runAction } = setup({ parse: vi.fn(async () => RISKY) })
    await ra.ask({ requestId: REQ(1), text: 'додай сторінку' })
    await ra.answer({ requestId: REQ(1), choice: 'no' })
    expect(runAction).not.toHaveBeenCalled()
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'cancelled' })
  })

  it('відповідь на інший запит — ігнор; новий запит скасовує підтвердження, що чекає', async () => {
    const parse = vi.fn(async () => RISKY as Record<string, unknown>)
    const { ra, runAction } = setup({ parse })
    await ra.ask({ requestId: REQ(1), text: 'додай сторінку' })
    await ra.answer({ requestId: REQ(9), choice: 'yes' })
    expect(runAction).not.toHaveBeenCalled()
    parse.mockResolvedValueOnce({ status: 'explain', explain: 'ок' })
    await ra.ask({ requestId: REQ(2), text: 'а що таке x?' })
    await ra.answer({ requestId: REQ(1), choice: 'yes' })   // старе «Так» уже не діє
    expect(runAction).not.toHaveBeenCalled()
  })
})

describe('черга, повтори, доступ, помилки', () => {
  it('поки думає — новий запит отримує «зачекайте», нічого не губиться', async () => {
    let release!: (v: unknown) => void
    const parse = vi.fn(() => new Promise((res) => { release = res }))
    const { ra, replies } = setup({ parse })
    const first = ra.ask({ requestId: REQ(1), text: 'графік' })
    await vi.waitFor(() => expect(parse).toHaveBeenCalled())   // перший уже чекає моделі
    await ra.ask({ requestId: REQ(2), text: 'ще' })
    expect(replies.find((r) => r.request_id === REQ(2))).toEqual({ request_id: REQ(2), status: 'error', text: `${K}busy` })
    release(GRAPH)
    await first
    expect(last(replies)).toMatchObject({ request_id: REQ(1), status: 'done' })
  })

  it('той самий request_id удруге не виконується (повтор телефона)', async () => {
    const { ra, parse, runAction } = setup()
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    expect(parse).toHaveBeenCalledTimes(1)
    expect(runAction).toHaveBeenCalledTimes(1)
  })

  it('Інтегралик недоступний — error з поясненням, parse не кличемо', async () => {
    const { ra, replies, parse } = setup({ canUse: () => 'вимкнено в профілі' })
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    expect(parse).not.toHaveBeenCalled()
    expect(replies).toEqual([{ request_id: REQ(1), status: 'error', text: 'вимкнено в профілі' }])
  })

  it.each([
    ['ліміт тарифу', { limit: true }, `${K}limit`],
    ['вимкнено на сервері', { off: true }, 'Інтегралик вимкнено на сервері'],
    ['AI недоступний', { code: 'AI_UNAVAILABLE' }, `${K}unavailable`],
    ['інша помилка', { message: 'Network Error' }, 'людською: Network Error'],
  ])('помилка parse: %s', async (_n, err, text) => {
    const { ra, replies } = setup({ parse: vi.fn(async () => { throw err }) })
    await ra.ask({ requestId: REQ(1), text: 'графік' })
    expect(last(replies)).toEqual({ request_id: REQ(1), status: 'error', text })
  })
})

describe('окрема розмова пульта', () => {
  it('свій conversation_id; друга репліка несе попередні user і assistant; «зір» і коридор — як у вікна', async () => {
    const corridor = { content_language: 'uk', subject: 'math' }
    const parse = vi.fn(async () => ({ ...GRAPH, corridor }) as Record<string, unknown>)
    const { ra, applyCorridor } = setup({ parse })
    await ra.ask({ requestId: REQ(1), text: 'графік параболи' })
    await ra.ask({ requestId: REQ(2), text: 'а тепер кубічної' })
    const [phrase1, board1, history1, summary1, , , conv1] = parse.mock.calls[0] as unknown[]
    expect([phrase1, board1, history1, summary1, conv1]).toEqual(['графік параболи', 'board-1', [], { pages: 2 }, 'conv-pult'])
    const history2 = (parse.mock.calls[1] as unknown[])[2] as Array<{ role: string; content: string }>
    expect(history2).toEqual([
      { role: 'user', content: 'графік параболи' },
      { role: 'assistant', content: `Виконано: ${GRAPH.explain}` },
    ])
    expect(applyCorridor).toHaveBeenCalledWith(corridor)
  })

  it('історія — не більше 6 реплік', async () => {
    const { ra, parse } = setup({ parse: vi.fn(async () => ({ status: 'explain', explain: 'ок' })) })
    for (let i = 1; i <= 5; i++) await ra.ask({ requestId: REQ(i), text: `питання ${i}` })
    expect((parse.mock.calls[4][2] as unknown[]).length).toBe(6)
  })
})
