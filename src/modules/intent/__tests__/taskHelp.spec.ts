/**
 * Пакет 3 «один Інтегралик» (19.10, LAW §9 v1.33): «💡 Підказка» і «⚠ Типова помилка» на виділеній задачі.
 *
 * Хто бачить значки (те саме право, що ✍ Інтегралика), що летить на сервер (закрите `quick`, без
 * історії розмови), де лягає картка (поруч із задачею штатним `add_card`) і що бачить учитель, коли
 * картки не буде (причина словами).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import WBCardWindowControls from '@/modules/winterboard/components/canvas/WBCardWindowControls.vue'
import { NO_WINDOW_ACTIONS, cardWindowActions } from '@/modules/winterboard/board/windowActions'

type Asset = { id: string; type: string; x: number; y: number; w: number; h: number; data: Record<string, any> }
let pages: { id: string; width: number; height: number; assets: Asset[] }[] = []

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    get currentPage() { return pages[pages.length - 1] },
    addAsset: (asset: Asset) => { pages[pages.length - 1].assets.push(asset) },
    updateAsset: vi.fn(),
    addStroke: vi.fn(),
    addPageUndoable: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))
vi.mock('@/utils/notify', () => ({ notifyInfo: vi.fn(), notifyWarning: vi.fn(), notifyError: vi.fn() }))

import { runBoardAction } from '../boardActions'
import { announceTaskActions, askTaskHelp, claimOnceTip, ONCE_TIP_EVENT, taskHelpBusy, TASK_HELP_CARD } from '../taskHelp'
import { notifyInfo } from '@/utils/notify'

const TASK = { id: 'task', type: 'nmt_task', x: 100, y: 100, w: 600, h: 300, data: { version: 1, question: '2x + 4 = 10' } }
const SOLVER = { isTutor: true, mode: 'edit', canSolve: true }
const card = (type: string, data: Record<string, unknown> = {}, src = '') =>
  ({ id: `${type}-1`, type, src, x: 0, y: 0, w: 400, h: 300, rotation: 0, locked: false, data: { version: 1, ...data } }) as any

beforeEach(() => {
  pages = [{ id: 'p1', width: 1920, height: 1080, assets: [{ ...TASK }] }]
  taskHelpBusy.value = null
  vi.mocked(notifyInfo).mockClear()
})

describe('хто бачить 💡 і ⚠', () => {
  it('те саме право, що ✍ Інтегралика: задача, картка, картинка — у власника з Інтеграликом', () => {
    for (const asset of [card('nmt_task'), card('theory_card'), card('image', {}, 'https://x.test/a.png')]) {
      expect(cardWindowActions(asset, SOLVER).taskHelp).toBe(true)
    }
    // задача з готовим розв'язком — теж: підказка не розв'язок
    expect(cardWindowActions(card('nmt_task', { solution: '$x=3$' }), SOLVER).taskHelp).toBe(true)
  })

  it('без права Інтегралика, поза редагуванням, учень, сама картка-підказка — немає', () => {
    expect(cardWindowActions(card('nmt_task'), { isTutor: true, mode: 'edit' }).taskHelp).toBe(false)
    expect(cardWindowActions(card('nmt_task'), { ...SOLVER, mode: 'replay' }).taskHelp).toBe(false)
    expect(cardWindowActions(card('nmt_task'), { ...SOLVER, isTutor: false })).toEqual(NO_WINDOW_ACTIONS)
    expect(cardWindowActions(card('theory_card', { preset: 'tip' }), SOLVER).taskHelp).toBe(false)
    expect(cardWindowActions(card('theory_card', { preset: 'common mistake' }), SOLVER).taskHelp).toBe(false)
    expect(cardWindowActions(card('image', {}, 'data:image/png;base64,AA'), SOLVER).taskHelp).toBe(false)
  })
})

describe('значки в групі дій', () => {
  const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const render = (taskHelpBusy: 'hint' | 'mistake' | null = null) => mount(WBCardWindowControls, {
    props: { actions: { ...NO_WINDOW_ACTIONS, taskHelp: true }, isExpanded: false, taskHelpBusy },
    global: { plugins: [i18n()] },
  })

  it('два значки без напису, назва — у спливній підказці; натиск каже, яку картку', async () => {
    const w = render()
    const hint = w.get('[data-testid="wb-card-window-task-help-hint"]')
    const mistake = w.get('[data-testid="wb-card-window-task-help-mistake"]')
    expect([hint.text(), mistake.text()]).toEqual(['💡', '⚠'])
    expect(hint.attributes('aria-label')).toBe('Підказка до задачі')
    expect(mistake.attributes('aria-label')).toBe('Типова помилка в задачі')
    // Власник 19.10: «чи всі мають підписи» — назва й у спливній підказці.
    expect([hint.attributes('title'), mistake.attributes('title')]).toEqual(['Підказка до задачі', 'Типова помилка в задачі'])
    await mistake.trigger('click')
    expect(w.emitted('taskHelp')).toEqual([['mistake']])
  })

  it('поки Інтегралик складає картку — обидва не натискаються, натиснутий пульсує', () => {
    const w = render('hint')
    const hint = w.get('[data-testid="wb-card-window-task-help-hint"]')
    expect(hint.attributes('disabled')).toBeDefined()
    expect(hint.classes()).toContain('wb-card-window-controls__btn--busy')
    expect(w.get('[data-testid="wb-card-window-task-help-mistake"]').attributes('disabled')).toBeDefined()
  })
})

describe('запит і картка', () => {
  const deps = (reply: any) => {
    const parse = vi.fn().mockResolvedValue(reply)
    return {
      parse,
      d: { boardId: 'b1', locale: 'uk', summary: vi.fn().mockResolvedValue({ items: [] }), parse,
           run: runBoardAction, info: vi.fn(), warn: vi.fn() },
    }
  }
  const CARD = { status: 'board_action', action: { kind: 'add_card', payload: {
    title: 'Обидві частини', body: 'Ділити треба обидві частини.', badge: 'Підказка', preset: 'tip' } } }

  it('закрите quick, без історії розмови; картка — праворуч від задачі', async () => {
    const { parse, d } = deps(CARD)
    expect(await askTaskHelp('hint', TASK, d)).toBe('placed')
    const args = parse.mock.calls[0]
    expect(args[1]).toBe('b1')
    expect(args[2]).toEqual([])
    expect(args[9]).toEqual({ quick: 'hint' })
    const placed = pages[0].assets[1]
    expect(placed.type).toBe('theory_card')
    expect(placed.data).toMatchObject({ badge: 'Підказка', preset: 'tip' })
    expect([placed.x, placed.y, placed.w, placed.h]).toEqual([100 + 600 + 24, 100, TASK_HELP_CARD.w, TASK_HELP_CARD.h])
    expect(taskHelpBusy.value).toBeNull()
  })

  it('праворуч не влазить — під задачею', async () => {
    pages[0].assets[0] = { ...TASK, x: 1400 }
    const { d } = deps(CARD)
    await askTaskHelp('hint', pages[0].assets[0], d)
    const placed = pages[0].assets[1]
    expect([placed.x, placed.y]).toEqual([1400, 100 + 300 + 24])
  })

  it('картки не буде — учитель бачить причину словами сервера', async () => {
    const { d } = deps({ status: 'none', explain: 'Цього разу підказка вийшла з відповіддю — на дошку її не кладу.' })
    expect(await askTaskHelp('mistake', TASK, d)).toBe('refused')
    expect(d.info).toHaveBeenCalledWith('Цього разу підказка вийшла з відповіддю — на дошку її не кладу.')
    expect(pages[0].assets).toHaveLength(1)
  })

  it('одна дія за раз: поки складає — другий натиск лише каже «уже складаю»', async () => {
    taskHelpBusy.value = { id: 'task', kind: 'hint' }
    const { parse, d } = deps(CARD)
    expect(await askTaskHelp('mistake', TASK, d)).toBe('busy')
    expect(parse).not.toHaveBeenCalled()
    expect(notifyInfo).toHaveBeenCalledWith('Уже складаю картку — зачекайте мить.')
  })
})

describe('одноразова підказка маскота (власник 19.10: «мінімалізм і простота»)', () => {
  const memory = () => {
    const box = new Map<string, string>()
    return { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => { box.set(k, v) } }
  }

  it('значки на виділеній задачі пояснюються одним рядком — один раз у цьому браузері', () => {
    const storage = memory()
    expect(claimOnceTip('task-actions', storage)).toBe(true)
    expect(claimOnceTip('task-actions', storage)).toBe(false)
    expect(claimOnceTip('other', storage)).toBe(true)      // інша можливість — своя одна підказка
  })

  it('недоступне сховище (приватний режим) — показуємо, але нічого не ламаємо', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(claimOnceTip('task-actions', broken)).toBe(true)
  })

  it('дошка шле вікну Інтегралика рядок про ✍ 💡 ⚠', () => {
    const seen: any[] = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(ONCE_TIP_EVENT, listener)
    announceTaskActions()
    window.removeEventListener(ONCE_TIP_EVENT, listener)
    expect(seen).toEqual([{ key: 'task-actions',
      text: 'Виділили задачу: ✍ — розв\'язок рукою, 💡 — підказка, ⚠ — типова помилка.' }])
  })
})

describe('звичайна картка Інтегралика — як була', () => {
  it('без `near` — 520×380 у вільному місці', async () => {
    await runBoardAction({ kind: 'add_card', payload: { title: 'T', body: 'B', badge: 'Теорія' } })
    const placed = pages[0].assets[1]
    expect([placed.w, placed.h]).toEqual([520, 380])
  })
})
