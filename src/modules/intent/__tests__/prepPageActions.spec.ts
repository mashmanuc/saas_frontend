/**
 * LAW §9 v1.20: дії Інтегралика з пульта кладуть матеріал на ПІДГОТОВЧУ сторінку — ту, якої на
 * екрані немає (`runBoardAction(action, { pageId })`). Вікно на ноутбуці (без ctx) — як і було,
 * на поточну. Ціль передається явно, а не глобальним перемикачем.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Page = { id: string; width: number; height: number; assets: any[]; strokes: any[] }
let pages: Page[] = []
let current = 0
const addPageUndoable = vi.fn(() => 'p-new')
const selectItems = vi.fn()

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    zoom: 1,
    get pages() { return pages },
    get currentPage() { return pages[current] },
    addAsset: (asset: any, pageId: string) => { pages.find((p) => p.id === pageId)!.assets.push(asset) },
    addStroke: (stroke: any, opts?: { pageId?: string }) => {
      const page = opts?.pageId ? pages.find((p) => p.id === opts.pageId)! : pages[current]
      page.strokes.push(stroke)
    },
    addPageUndoable,
    selectItems,
    updateAsset: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))
vi.mock('@/modules/winterboard/vendor/geo2d', () => ({}))
vi.mock('@/modules/winterboard/components/sidebar/insertRegistry', () => ({
  allInserts: () => [{ id: 'tool.trig', dragMime: 'application/x-trig-circle', payload: '{}', labelFallback: 'Коло' }],
}))

import { runBoardAction } from '../boardActions'

const CARD = { title: 'Задача', body: 'Розв\'яжіть x^2 = 4', badge: 'Задача' }
const blank = (id: string): Page => ({ id, width: 1920, height: 1080, assets: [], strokes: [] })

beforeEach(() => {
  pages = [blank('p-screen'), blank('p-prep')]
  current = 0
  addPageUndoable.mockClear()
  selectItems.mockClear()
})

describe('з пульта — на підготовчу сторінку', () => {
  it('картка лягає на підготовчу, екранна сторінка чиста', async () => {
    await runBoardAction({ kind: 'add_card', payload: CARD }, { pageId: 'p-prep' })
    expect(pages[1].assets.map((a) => a.type)).toEqual(['theory_card'])
    expect(pages[0].assets).toHaveLength(0)
  })

  it('текст — теж на підготовчу', async () => {
    await runBoardAction({ kind: 'add_text', payload: { text: 'Домашнє завдання' } }, { pageId: 'p-prep' })
    expect(pages[1].strokes.map((s) => s.text)).toEqual(['Домашнє завдання'])
    expect(pages[0].strokes).toHaveLength(0)
  })

  it('графік — теж на підготовчу, і не виділяється (виділення вчителя на екрані не підміняємо)', async () => {
    await runBoardAction({ kind: 'add_graph', payload: { expressions: [{ src: 'x^2' }] } }, { pageId: 'p-prep' })
    expect(pages[1].assets.map((a) => a.type)).toEqual(['graph_calculator'])
    expect(pages[0].assets).toHaveLength(0)
    expect(selectItems).not.toHaveBeenCalled()
  })

  it('«нова сторінка з карткою» з пульта — другої сторінки не додає, картка на підготовчій', async () => {
    await runBoardAction({ kind: 'add_page', payload: { name: 'Задача 2', card: CARD } }, { pageId: 'p-prep' })
    expect(addPageUndoable).not.toHaveBeenCalled()
    expect(pages[1].assets.map((a) => a.type)).toEqual(['theory_card'])
  })

  it('картка з пульта не стає «останньою карткою» вікна (E2 шукав би її на екранній сторінці)', async () => {
    await runBoardAction({ kind: 'add_card', payload: CARD }, { pageId: 'p-prep' })
    await expect(runBoardAction({ kind: 'update_card', payload: { body: 'x' } })).rejects.toThrow(/ще не створював/)
  })

  it('підготовчої сторінки вже немає — чесна помилка, нічого не записано', async () => {
    await expect(runBoardAction({ kind: 'add_card', payload: CARD }, { pageId: 'p-gone' })).rejects.toThrow('Підготовчої сторінки вже немає.')
    expect(pages.every((p) => p.assets.length === 0)).toBe(true)
  })

  it('готовий інструмент: подія несе сторінку; виконавець позначив — гаразд', async () => {
    const seen: any[] = []
    const onInsert = (e: Event) => { const d = (e as CustomEvent).detail; seen.push({ ...d }); d.handled = true }
    window.addEventListener('m4sh:wb-insert', onInsert)
    try {
      await runBoardAction({ kind: 'add_tool', payload: { insert_id: 'tool.trig' } }, { pageId: 'p-prep' })
    } finally {
      window.removeEventListener('m4sh:wb-insert', onInsert)
    }
    expect(seen).toEqual([{ mime: 'application/x-trig-circle', payload: '{}', pageId: 'p-prep', handled: false }])
  })

  it('готовий інструмент там, де вставляти нікому (клас), — error, а не «Готово»', async () => {
    await expect(runBoardAction({ kind: 'add_tool', payload: { insert_id: 'tool.trig' } }, { pageId: 'p-prep' }))
      .rejects.toThrow(/лише в уроці/)
  })
})

describe('вікно на ноутбуці (без ctx) — як і було', () => {
  it('графік із вікна — як і було, виділяється (видно, що саме додалось)', async () => {
    await runBoardAction({ kind: 'add_graph', payload: { expressions: [{ src: 'x^2' }] } })
    expect(selectItems).toHaveBeenCalledWith([pages[0].assets[0].id])
  })

  it('картка й текст — на поточну сторінку; «нова сторінка» додає сторінку', async () => {
    await runBoardAction({ kind: 'add_card', payload: CARD })
    await runBoardAction({ kind: 'add_text', payload: { text: 'x' } })
    expect(pages[0].assets).toHaveLength(1)
    expect(pages[0].strokes).toHaveLength(1)
    expect(pages[1].assets).toHaveLength(0)
    await runBoardAction({ kind: 'add_page', payload: { name: 'Нова' } })
    expect(addPageUndoable).toHaveBeenCalledTimes(1)
  })

  it('готовий інструмент — подія без сторінки й без позначки; без виконавця не падає', async () => {
    const seen: any[] = []
    const onInsert = (e: Event) => seen.push({ ...(e as CustomEvent).detail })
    window.addEventListener('m4sh:wb-insert', onInsert)
    try {
      await runBoardAction({ kind: 'add_tool', payload: { insert_id: 'tool.trig' } })
    } finally {
      window.removeEventListener('m4sh:wb-insert', onInsert)
    }
    expect(seen).toEqual([{ mime: 'application/x-trig-circle', payload: '{}' }])
    await expect(runBoardAction({ kind: 'add_tool', payload: { insert_id: 'tool.trig' } })).resolves.toBeUndefined()
  })
})
