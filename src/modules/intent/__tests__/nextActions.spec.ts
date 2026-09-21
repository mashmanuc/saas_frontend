/**
 * Next Actions V1 — фронт (рішення власника 2026-09-21).
 *
 * UI не знає, що таке «сторони битви»: дії приходять із бекенду готовими, а
 * результат кладе той самий `runBoardAction`, що й план палітри, — тобто
 * штатні ops. У Replay кнопок немає, бо немає обробника.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  post: vi.fn(),
  runBoardAction: vi.fn(async () => {}),
  planFits: vi.fn(async () => true),
  openPage: vi.fn(async () => 'page-2'),
  notifyInfo: vi.fn(),
  notifyWarning: vi.fn(),
  notifyError: vi.fn(),
}))

vi.mock('../../../utils/apiClient', () => ({ default: { post: m.post } }))
vi.mock('../../../utils/notify', () => ({
  notifyInfo: m.notifyInfo, notifyWarning: m.notifyWarning, notifyError: m.notifyError,
}))
vi.mock('../boardActions', async (orig) => ({
  ...(await orig<typeof import('../boardActions')>()),
  runBoardAction: m.runBoardAction,
  planFitsCurrentPage: m.planFits,
  openPageForPlan: m.openPage,
}))
vi.mock('@/modules/winterboard/stores/opsSyncStore', () => ({
  useOpsSyncStore: () => ({ sessionId: 'board-1' }),
}))

import { sanitizeTeachingActions } from '../boardActions'
import { _resetNextActionsCache, loadNextActions, runNextAction } from '../nextActions'

const SOURCE = { id: 'card-1', data: { entity_ref: { provider: 'wikidata', id: 'Q152486' } } }
const SIDES = { id: 'history.related', label: 'Сторони битви' }

beforeEach(() => {
  vi.clearAllMocks()
  _resetNextActionsCache()
})

describe('loadNextActions — список дій питають, а не зберігають', () => {
  const REF = { provider: 'wikidata', id: 'Q152486' }

  it('питає бекенд за посиланням картки й чистить відповідь', async () => {
    m.post.mockResolvedValue({ actions: [{ id: 'history.map', label: 'Де це сталося' },
      { id: 'P710', label: 'зламане' }] })
    expect(await loadNextActions(REF)).toEqual([{ id: 'history.map', label: 'Де це сталося' }])
    expect(m.post).toHaveBeenCalledWith('/v1/intents/next-actions/available/',
      { board_id: 'board-1', entity_ref: REF })
  })

  it('одна сутність — один запит, скільки б карток її не показували', async () => {
    m.post.mockResolvedValue({ actions: [] })
    await Promise.all([loadNextActions(REF), loadNextActions({ ...REF })])
    expect(m.post).toHaveBeenCalledTimes(1)
  })

  it('невдалий запит — порожньо, і наступний пробує знову', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    m.post.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce({ actions: [] })
    expect(await loadNextActions(REF)).toEqual([])
    await loadNextActions(REF)
    expect(m.post).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('без посилання — жодного запиту', async () => {
    expect(await loadNextActions(null)).toEqual([])
    expect(m.post).not.toHaveBeenCalled()
  })
})

describe('runNextAction', () => {
  it('план бекенду кладеться тим самим runBoardAction — крок за кроком', async () => {
    m.post.mockResolvedValue({ status: 'board_action_plan', actions: [
      { kind: 'add_history_card', payload: { title: 'Шведська імперія' } },
      { kind: 'add_history_card', payload: { title: 'Гетьманщина' } },
    ] })
    await runNextAction(SOURCE, SIDES)
    expect(m.post).toHaveBeenCalledWith('/v1/intents/next-actions/run/', {
      board_id: 'board-1', entity_ref: SOURCE.data.entity_ref, action_id: 'history.related',
    })
    expect(m.runBoardAction.mock.calls.map((c: any[]) => c[0].payload.title))
      .toEqual(['Шведська імперія', 'Гетьманщина'])
  })

  it('набір вміщується — лишається на поточній сторінці', async () => {
    m.post.mockResolvedValue({ status: 'board_action_plan', actions: [
      { kind: 'add_history_card', payload: { title: 'A' } }] })
    await runNextAction(SOURCE, SIDES)
    expect(m.openPage).not.toHaveBeenCalled()
  })

  it('набір не вміщується — нова сторінка з назвою дії, потім ті самі кроки', async () => {
    m.planFits.mockResolvedValueOnce(false)
    m.post.mockResolvedValue({ status: 'board_action_plan', actions: [
      { kind: 'add_history_card', payload: { title: 'A' } }] })
    const card = { ...SOURCE, data: { ...SOURCE.data, title: 'Полтавська битва' } }
    await runNextAction(card, SIDES)
    expect(m.openPage).toHaveBeenCalledWith('Полтавська битва — Сторони битви')
    expect(m.notifyInfo).toHaveBeenCalled()
    expect(m.openPage.mock.invocationCallOrder[0])
      .toBeLessThan(m.runBoardAction.mock.invocationCallOrder[0])
  })

  it('нова сторінка теж заповнилась — продовження на ще одній, без перекриттів', async () => {
    // Увесь набір не вміщується (1), перший крок на новій сторінці вміщується (2),
    // другий — вже ні (3): відкривається «(2)».
    m.planFits.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    m.post.mockResolvedValue({ status: 'board_action_plan', actions: [
      { kind: 'add_history_card', payload: { title: 'A' } },
      { kind: 'add_history_card', payload: { title: 'B' } }] })
    const card = { ...SOURCE, data: { ...SOURCE.data, title: 'Полтавська битва' } }
    await runNextAction(card, SIDES)
    expect(m.openPage.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      'Полтавська битва — Сторони битви', 'Полтавська битва — Сторони битви (2)'])
    expect(m.runBoardAction).toHaveBeenCalledTimes(2)
  })

  it('немає результату — чесне попередження, на дошку нічого не кладемо', async () => {
    m.post.mockResolvedValue({ status: 'none', explain: 'Перевірених зв\'язків немає.' })
    await runNextAction(SOURCE, SIDES)
    expect(m.runBoardAction).not.toHaveBeenCalled()
    expect(m.notifyWarning).toHaveBeenCalledWith('Перевірених зв\'язків немає.')
  })

  it('без посилання на сутність — ні запиту, ні дії', async () => {
    await runNextAction({ id: 'x', data: {} }, SIDES)
    expect(m.post).not.toHaveBeenCalled()
  })

  it('повторний клік, поки перший ще йде, не дублює картки', async () => {
    let release: (v: unknown) => void = () => {}
    m.post.mockReturnValue(new Promise((r) => { release = r }))
    const first = runNextAction(SOURCE, SIDES)
    await runNextAction(SOURCE, SIDES)
    release({ status: 'none', explain: '' })
    await first
    expect(m.post).toHaveBeenCalledTimes(1)
  })
})

describe('sanitizeTeachingActions — лише форма, зміст знає бекенд', () => {
  it('пропускає id у просторі імен предмета і людський підпис', () => {
    expect(sanitizeTeachingActions([{ id: 'history.map', label: 'Де це сталося' }]))
      .toEqual([{ id: 'history.map', label: 'Де це сталося' }])
  })

  it('відкидає зламане, дублі й зайве', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `history.a${'b'.repeat(i)}`, label: 'X' }))
    expect(sanitizeTeachingActions([{ id: 'P710', label: 'X' }, { id: 'history.map', label: '' },
      { id: 'history.map', label: 'A' }, { id: 'history.map', label: 'B' }])).toEqual([
      { id: 'history.map', label: 'A' }])
    expect(sanitizeTeachingActions(many)).toHaveLength(6)
    expect(sanitizeTeachingActions(null)).toEqual([])
  })
})

describe('Replay не резолвить дії', () => {
  it('обробник дії є лише в живому редагуванні тьютора', () => {
    // Кімнати в тестах не монтуються (пам'ять проєкту), тому стережемо умову
    // в самому шарі оверлеїв: без обробника рендерер кнопок не малює.
    const src = readFileSync(resolve(__dirname,
      '../../winterboard/components/canvas/WBOverlayLayer.vue'), 'utf-8')
    expect(src).toMatch(/onRunAction: wbStore\.mode === 'edit' && props\.isTutor\s*\n?\s*\?/)
    expect(src).toMatch(/loadActions: wbStore\.mode === 'edit' && props\.isTutor\s*\n?\s*\?/)
  })

  it('картка, яку кладе план, не несе списку дій — лише entity_ref', () => {
    const src = readFileSync(resolve(__dirname, '../boardActions.js'), 'utf-8')
    expect(src).not.toMatch(/next_actions/)
  })
})
