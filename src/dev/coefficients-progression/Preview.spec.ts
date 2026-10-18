/** Реальні картки обох локальних уроків, не декоративна імітація. */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import katex from 'katex'
import Preview from './Preview.vue'
import raw from './preview-data.json'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { validateTaskPages } from '@/modules/intent/taskPages'
import { applyReplayOperation, type ReplayStoreApi } from '@/modules/winterboard/engine/applyReplayOperation'
import type { RecordOperationRequest, BoardOperation } from '@/modules/winterboard/types/replay'
import type { WBPage } from '@/modules/winterboard/types/winterboard'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
describe('Коефіцієнти квадратного рівняння — справжній локальний маршрут', () => {
  it('усі 60 умов, варіантів і розборів коректно рендерять формули', () => {
    expect(Object.keys(raw.tasks)).toHaveLength(60)
    for (const task of Object.values(raw.tasks)) for (const text of [task.question, task.solution, ...task.choices.map(c => c.text)]) {
      for (const match of text.matchAll(/\$([^$]+)\$/g)) {
        expect(() => katex.renderToString(match[1], { throwOnError: true })).not.toThrow()
      }
    }
  })
  it('показує всі 16 і 30 задач та розбори, перемикає 1/2/5', async () => {
    const wrapper = mount(Preview, { global: { plugins: [createPinia()] } })
    for (const [countIndex, count] of [[0, 16], [1, 30]]) {
      await wrapper.findAll('.count-switch button')[countIndex].trigger('click')
      await wrapper.get('input[type="checkbox"]').setValue(true)
      expect(wrapper.findAll('.nmt-task')).toHaveLength(count)
      if (countIndex === 0) await wrapper.get('.reveal').trigger('click')
      expect(wrapper.findAll('.nmt-task__solution')).toHaveLength(count)
      expect(wrapper.findAll('.katex-error')).toHaveLength(0)
      await wrapper.get('input[type="checkbox"]').setValue(false)
      for (const [index, perPage] of [[0, 1], [1, 2], [2, 5]]) {
        await wrapper.findAll('.layout-switch button')[index].trigger('click')
        expect(wrapper.findAll('.nmt-task')).toHaveLength(perPage)
        expect(wrapper.get('nav').text()).toContain(`1 / ${Math.ceil(count / perPage)}`)
      }
    }
    wrapper.unmount()
  })
  it.each(['16', '30'] as const)('урок %s: вставка → undo/redo → штатний Replay-applier зберігає дані', count => {
    for (const layout of ['1', '2', '5'] as const) {
      const input = validateTaskPages(clone(raw.layouts[count][layout].pages))
      const initial = (): WBPage[] => [{ id: 'before', name: 'До', strokes: [], assets: [] }]
      const data = (pages: WBPage[]) => pages.flatMap(page => page.assets.map(a => a.data))
      const original = data(input), store = useWBStore(createPinia())
      store.pages = initial(); store.currentPageIndex = 0
      const operations: RecordOperationRequest[] = []
      store.onOperation(op => operations.push(clone(op)))
      store.insertTaskPagesUndoable(input)
      const first = clone(operations)
      expect(data(store.pages)).toEqual(original)
      store.undo(); expect(data(store.pages)).toHaveLength(0)
      store.redo(); expect(data(store.pages)).toEqual(original)
      const replay = useWBStore(createPinia())
      replay.pages = initial(); replay.setMode('replay')
      first.forEach((op, index) => applyReplayOperation(replay as unknown as ReplayStoreApi, {
        ...op, id: index + 1, user: 40, created_at: '2026-10-17T17:00:00Z',
      } as BoardOperation))
      expect(data(replay.pages)).toEqual(original)
      expect(data(replay.pages)).toHaveLength(Number(count))
    }
  })
})
