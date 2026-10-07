/**
 * Виділена задача НМТ (власник 2026-10-07: «роби для математики варіанти і перевірку підказки і повне
 * розвязання теж»). У виділеної задачі — усі варіанти (`options`) і повний розбір (`full_solution`), навіть
 * не відкритий на картці; невиділені — як і було (лише правильна відповідь, розбір — за відкритим).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { buildBoardSummary } from '../boardActions'

const CHOICE = {
  id: 'mc', type: 'nmt_task', x: 0, y: 0, w: 600, h: 400,
  data: {
    taskType: 'single_choice', question: 'Укажіть столицю <b>Франції</b>.',
    options: [{ letter: 'А', text: 'Берлін', isCorrect: false }, { letter: 'Б', text: 'Париж', isCorrect: true },
              { letter: 'В', text: 'Рим', isCorrect: false }],
    solution: 'Столиця Франції — Париж.', showSolution: false, showAnswer: false,
  },
}
const MATCHING = {
  id: 'pairs', type: 'nmt_task', x: 0, y: 420, w: 600, h: 300,
  data: { taskType: 'matching', question: 'Установіть відповідність.', showSolution: false, showAnswer: false,
          pairs: [{ left: '2 + 2', right: '4' }, { left: '3 · 3', right: '9' }] },
}

function board(selectedIds: string[]) {
  const store = useWBStore()
  store.pages = [{ id: 'p1', name: 'p1', strokes: [], assets: [CHOICE, MATCHING] }] as any
  store.currentPageIndex = 0
  store.selectedIds = selectedIds
  store.expandedAssetId = null
}

beforeEach(() => setActivePinia(createPinia()))

describe('виділена задача НМТ — для Інтегралика', () => {
  it('усі варіанти й повний розбір, навіть не відкритий; умова повністю', async () => {
    board(['mc'])
    const { items } = await buildBoardSummary()
    const mc = items.find((i: any) => i.id === 'mc')
    expect(mc.options).toBe('А) Берлін; Б) Париж; В) Рим')
    expect(mc.full_solution).toBe('Столиця Франції — Париж.')
    expect(mc.full_text).toBe('Укажіть столицю Франції .')   // flatten міняє тег на пробіл — як і всюди
    expect(mc.solution).toBeUndefined()            // звичайне поле — як і було: розбір закритий
  })

  it('відповідність: обидві колонки', async () => {
    board(['pairs'])
    const { items } = await buildBoardSummary()
    expect(items.find((i: any) => i.id === 'pairs').options)
      .toBe('Ліва колонка: 1) 2 + 2; 2) 3 · 3. Права колонка: 4; 9')
  })

  it('невиділена задача — як і було: без варіантів і без закритого розбору', async () => {
    board(['pairs'])
    const { items } = await buildBoardSummary()
    const mc = items.find((i: any) => i.id === 'mc')
    expect(mc.options).toBeUndefined()
    expect(mc.full_solution).toBeUndefined()
    expect(mc.answer).toBe('Б) Париж')
  })
})
