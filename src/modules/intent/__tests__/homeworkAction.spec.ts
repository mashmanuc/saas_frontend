/**
 * «дай домашку» (власник 2026-10-19): Інтегралик лише відкриває вікно «Запропонувати домашку» — те саме, що й
 * кнопка в уроці. Сам нічого не кладе на дошку; задачі добирає сервер, що робити зі списком — вирішує вчитель.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { runBoardAction, PREP_PAGE_KINDS } from '../boardActions'

const emptyPage = (id: string) => ({ id, name: id, strokes: [], assets: [] })
const action = { kind: 'add_homework', payload: { count: 6 } }

beforeEach(() => {
  setActivePinia(createPinia())
  const store = useWBStore()
  store.workspaceId = 'board-one'
  store.pages = [emptyPage('p1'), emptyPage('p2'), emptyPage('p3')] as never
  store.currentPageIndex = 0
})

describe('«дай домашку» — те саме вікно, що й кнопка', () => {
  it('передає кількість вікну уроку й нічого не кладе на дошку', async () => {
    const seen: number[] = []
    const listener = (e: Event) => {
      const detail = (e as CustomEvent<{ count: number; handled: boolean }>).detail
      seen.push(detail.count)
      detail.handled = true
    }
    window.addEventListener('m4sh:homework-propose', listener)
    try {
      await runBoardAction(action)
    } finally {
      window.removeEventListener('m4sh:homework-propose', listener)
    }
    expect(seen).toEqual([6])
    expect(useWBStore().pages).toHaveLength(3)
    expect(useWBStore().undoStack).toHaveLength(0)
  })

  it('немає вікна (не урок або без задач з банку) — каже, що робити', async () => {
    await expect(runBoardAction(action)).rejects.toThrow('задачами з банку')
  })

  it('з пульта — ні', async () => {
    expect(PREP_PAGE_KINDS).not.toContain('add_homework')
    await expect(runBoardAction(action, { pageId: 'p1' })).rejects.toThrow('ноутбуці')
  })
})

describe('вставка в кінець — штатні ops', () => {
  it('atEnd: page_add з insertAt = кількість сторінок; без прапорця — як було, після поточної', () => {
    const store = useWBStore()
    const ops: { op_type: string; payload: { insertAt?: number } }[] = []
    store.onOperation(op => ops.push(op as never))
    const card = { id: 'c1', type: 'theory_card', x: 60, y: 60, w: 1200, h: 300, data: { title: 'ДЗ', items: ['1'] } }
    store.insertTaskPagesUndoable([{ ...emptyPage('end'), assets: [card] }] as never, { atEnd: true })
    expect(ops.filter(o => o.op_type === 'page_add').map(o => o.payload.insertAt)).toEqual([3])
    store.currentPageIndex = 0
    store.insertTaskPagesUndoable([{ ...emptyPage('next'), assets: [{ ...card, id: 'c2' }] }] as never)
    expect(store.pages.map(p => p.id)).toEqual(['p1', 'next', 'p2', 'p3', 'end'])
  })
})
