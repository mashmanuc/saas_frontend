import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { runBoardAction, PREP_PAGE_KINDS } from '../boardActions'

const mocks = vi.hoisted(() => ({ taskPages: vi.fn(), sync: { mode: 'SYNC', inputLocked: false } }))
vi.mock('@/modules/lesson_constructor/api/lessonConstructorApi', () => ({ lessonConstructorApi: { taskPages: mocks.taskPages } }))
vi.mock('@/modules/winterboard/stores/opsSyncStore', () => ({ useOpsSyncStore: () => mocks.sync }))

const emptyPage = (id: string) => ({ id, name: id, strokes: [], assets: [] })
const result = () => ({ pages: [{ ...emptyPage('new'), width: 1920, height: 1080,
  assets: [{ id: 'task', type: 'nmt_task', x: 60, y: 60, w: 800, h: 400,
    data: { question: '2x = 4', taskType: 'open_answer' } }] }], warnings: ['Теорії для підтеми ще немає.'] })
const action = { kind: 'add_tasks', payload: { topics: ['linear-quadratic-rational-equations.linear'], task_count: 1, tasks_per_page: 1 } }

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.taskPages.mockReset()
  mocks.sync.mode = 'SYNC'
  mocks.sync.inputLocked = false
  const store = useWBStore()
  store.workspaceId = 'board-one'
  store.pages = [emptyPage('old'), emptyPage('tail')]
  store.currentPageIndex = 0
})

describe('добірка Інтегралика — повний клієнтський шлях', () => {
  it('бере підготовлені сервером сторінки, лишає старі та повертає попередження', async () => {
    mocks.taskPages.mockResolvedValue(result())
    const reply = await runBoardAction(action)
    const store = useWBStore()
    expect(mocks.taskPages).toHaveBeenCalledWith(action.payload)
    expect(store.pages.map(p => p.id)).toEqual(['old', 'new', 'tail'])
    expect(reply.warnings).toHaveLength(1)
    store.undo()
    expect(store.pages.map(p => p.id)).toEqual(['old', 'tail'])
  })

  it.each(['DESYNC', 'SAVE_BLOCKED', 'INIT'])('не готує задач при %s', async mode => {
    mocks.sync.mode = mode
    await expect(runBoardAction(action)).rejects.toThrow('заблоковано')
    expect(mocks.taskPages).not.toHaveBeenCalled()
  })

  it('не додає відповідь на іншу дошку чи сторінку після очікування сервера', async () => {
    mocks.taskPages.mockImplementation(async () => {
      useWBStore().workspaceId = 'board-two'
      return result()
    })
    await expect(runBoardAction(action)).rejects.toThrow('змінилась')
    expect(useWBStore().pages.map(p => p.id)).toEqual(['old', 'tail'])
    expect(useWBStore().undoStack).toHaveLength(0)
  })

  it('показує нестачу з банку й не залишає порожніх сторінок', async () => {
    mocks.taskPages.mockRejectedValue({ response: { data: { detail: 'Є лише 3 задачі.' } } })
    await expect(runBoardAction(action)).rejects.toThrow('Є лише 3 задачі.')
    expect(useWBStore().pages).toHaveLength(2)
    expect(useWBStore().undoStack).toHaveLength(0)
  })

  it('не відкриває новий шлях підготовки з пульта', async () => {
    expect(PREP_PAGE_KINDS).not.toContain('add_tasks')
    await expect(runBoardAction(action, { pageId: 'old' })).rejects.toThrow('ноутбуці')
    expect(mocks.taskPages).not.toHaveBeenCalled()
  })
})
