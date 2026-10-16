import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { validateTaskPages } from '@/modules/intent/taskPages'
import type { WBPage } from '../types/winterboard'
import type { RecordOperationRequest } from '../types/replay'

function page(id: string, count = 5): WBPage {
  return { id, name: 'Задачі', strokes: [], width: 1920, height: 3000,
    assets: Array.from({ length: count }, (_, i) => ({ id: `${id}-task-${i}`, type: 'nmt_task' as const,
      src: '', x: 60, y: 60 + i * 500, w: 900, h: 400, rotation: 0, locked: false,
      data: { version: 1, taskType: 'open_answer', question: `Задача ${i}`, answer: '1', showAnswer: false, showSolution: false } })) }
}

beforeEach(() => setActivePinia(createPinia()))

describe('добірка задач — штатні ops й одне скасування', () => {
  it('вставляє 5+5+2 після поточної; ↶ прибирає весь набір, ↷ повертає ті самі id', () => {
    const store = useWBStore()
    store.pages = [page('before', 0), page('after', 0)]
    store.currentPageIndex = 0
    const ops: RecordOperationRequest[] = []
    store.onOperation(op => ops.push(op))
    const input = validateTaskPages([page('one'), page('two'), page('three', 2)])
    const ids = store.insertTaskPagesUndoable(input)
    expect(store.pages.map(p => p.id)).toEqual(['before', ...ids, 'after'])
    expect(store.pages.slice(1, 4).map(p => p.assets.length)).toEqual([5, 5, 2])
    expect(ops.filter(o => o.op_type === 'page_add').map(o => o.payload.insertAt)).toEqual([1, 2, 3])
    expect(ops.filter(o => o.op_type === 'asset_add')).toHaveLength(12)
    expect(store.undoStack).toHaveLength(1)
    store.undo()
    expect(store.pages.map(p => p.id)).toEqual(['before', 'after'])
    expect(store.currentPageIndex).toBe(0)
    expect(ops.filter(o => o.op_type === 'page_delete')).toHaveLength(3)
    store.redo()
    expect(store.pages.map(p => p.id)).toEqual(['before', ...ids, 'after'])
    expect(store.pages[1].height).toBe(3000)
    expect(store.pages[1].assets[0]).toMatchObject({ data: { showAnswer: false } })
    expect(ops.filter(o => o.op_type === 'page_add')[0].payload).toMatchObject({ page: { height: 3000 } })
  })

  it('відмовляє до першого op, якщо весь набір не вміщується', () => {
    const store = useWBStore()
    store.pages = Array.from({ length: 49 }, (_, i) => page(`old-${i}`, 0))
    const ops: RecordOperationRequest[] = []
    store.onOperation(op => ops.push(op))
    expect(() => store.insertTaskPagesUndoable([page('one'), page('two')])).toThrow('50')
    expect(store.pages).toHaveLength(49)
    expect(ops).toHaveLength(0)
    expect(store.undoStack).toHaveLength(0)
  })

  it('не пише в readonly чи Replay і не приймає повтор id', () => {
    const store = useWBStore()
    store.pages = [page('one')]
    expect(() => store.insertTaskPagesUndoable([page('one')])).toThrow()
    store.setMode('readonly')
    expect(() => store.insertTaskPagesUndoable([page('new')])).toThrow()
    store.setMode('replay')
    expect(() => store.insertTaskPagesUndoable([page('new')])).toThrow()
    expect(store.pages).toHaveLength(1)
  })

  it('не допускає зіткнення id з об’єктом старої сторінки до першої зміни', () => {
    const store = useWBStore()
    store.pages = [page('old', 1)]
    const input = page('new', 1)
    input.assets[0].id = 'old-task-0'
    expect(() => store.insertTaskPagesUndoable([input])).toThrow('ідентифікатор')
    expect(store.pages.map(p => p.id)).toEqual(['old'])
    expect(store.undoStack).toHaveLength(0)
  })

  it('перевіряє й останню сторінку до зміни; не допускає картки за краєм', () => {
    const invalid = page('bad')
    invalid.assets[0].y = 3000
    expect(() => validateTaskPages([page('good'), invalid])).toThrow()
    expect(() => validateTaskPages([page('same'), page('same')])).toThrow()
  })
})
