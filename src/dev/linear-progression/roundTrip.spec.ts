/** Фактичний добір → штатна вставка → undo/redo → штатний Replay-applier. */
import { describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { validateTaskPages } from '@/modules/intent/taskPages'
import { applyReplayOperation, type ReplayStoreApi } from '@/modules/winterboard/engine/applyReplayOperation'
import type { RecordOperationRequest, BoardOperation } from '@/modules/winterboard/types/replay'
import type { WBPage } from '@/modules/winterboard/types/winterboard'
import raw from './preview-data.json'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const initial = (): WBPage[] => ['before', 'after'].map(id => ({
  id, name: id, strokes: [], assets: [], width: 1920, height: 1080,
}))
const taskData = (pages: WBPage[]) => pages.flatMap(page => page.assets.map(asset => asset.data))

describe('Лінійний маршрут — незмінність карток у штатному циклі', () => {
  it.each(['1', '2', '5'])('розкладка %s: ті самі 16 задач після скасування, повтору та відтворення', layout => {
    const exported = raw.layouts[layout as keyof typeof raw.layouts]
    const input = validateTaskPages(clone(exported.pages))
    const originalData = taskData(input)
    const store = useWBStore(createPinia())
    store.workspaceId = 'local-route-test'
    store.pages = initial()
    store.currentPageIndex = 0
    const operations: RecordOperationRequest[] = []
    store.onOperation(op => operations.push(clone(op)))
    store.insertTaskPagesUndoable(input)
    const firstOps = clone(operations)
    expect(taskData(store.pages)).toEqual(originalData)
    expect(store.undoStack).toHaveLength(1)
    store.undo()
    expect(store.pages.map(page => page.id)).toEqual(['before', 'after'])
    store.redo()
    expect(taskData(store.pages)).toEqual(originalData)

    // Це модульний round-trip справжнього рушія, не симуляція кліків у Replay UI.
    const replay = useWBStore(createPinia())
    replay.pages = initial()
    replay.currentPageIndex = 0
    replay.setMode('replay')
    firstOps.forEach((op, index) => applyReplayOperation(replay as unknown as ReplayStoreApi, {
      ...op, id: index+1, user: 1, created_at: '2026-10-17T16:00:00Z',
    } as BoardOperation))
    expect(taskData(replay.pages)).toEqual(originalData)
    expect(replay.undoStack).toHaveLength(0)
    expect(taskData(replay.pages)).toHaveLength(16)
  })
})
