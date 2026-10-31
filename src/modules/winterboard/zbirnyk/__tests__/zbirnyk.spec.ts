/**
 * «Збірник» на дошці (власник 2026-10-28: «гортати і притягувати завдання собі»; НАШ збірник із задач банку).
 *
 *   ZB-1  вкладку бачить лише пілот `zbirnyk` з /me
 *   ZB-2  сервер питаємо раз; невдачу не кешуємо («Спробувати ще» питає знову)
 *   ZB-3  задача на дошку: картка від сервера (як у генератора уроку) → один asset `nmt_task`, у межах аркуша
 *   ZB-4  невдача — тост, без asset; повторний натиск, поки йде, — ігнор
 *   ZB-5  вкладка: розділи → рівень → задачі з формулами; «+» і перетягування несуть лише непрозорий id;
 *         відповідь — лише у вкладці, по натиску
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import uk from '@/i18n/locales/uk.json'

vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('@/utils/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notifyWarning: vi.fn(), notifyInfo: vi.fn() }))
vi.mock('@/modules/learning-content', () => ({ learningContentApi: { getBySlug: vi.fn() }, renderContentToSvgDataUrl: vi.fn() }))

import apiClient from '@/utils/apiClient'
import { notifyError } from '@/utils/notify'
import {
  ZBIRNYK_TASK_MIME, _resetZbirnykCache, getZbirnykOverview, getZbirnykTheme, zbirnykAdding,
} from '../zbirnykApi'
import { useContentDrop } from '../../composables/useContentDrop'
import { ADD_TOOL_TO_BOARD_KEY } from '../../composables/useAddToolToBoard'
import ZbirnykTab from '../../components/sidebar/ZbirnykTab.vue'

const get = vi.mocked(apiClient.get)
const SIDEBAR = readFileSync('src/modules/winterboard/components/sidebar/GroupContentSidebar.vue', 'utf8')

const OVERVIEW = {
  status: 'ready', collection: { id: 'c', version: 2, title: 'Збірник НМТ' }, themes: [
    { id: 'real-numbers', number: '1', title: 'Дійсні числа', levels: [{ level: 1, count: 2 }, { level: 2, count: 1 }] },
    // v5: категорії за типом із назвами від сервера; порожня — бліда й не натискається
    { id: 'integral', number: '15', title: 'Інтеграл', levels: [
      { level: 1, count: 0, title: 'Тести' }, { level: 2, count: 0, title: 'Відповідність' },
      { level: 3, count: 4, title: 'Коротка відповідь' }] },
    { id: 'sequences', number: '2', title: 'Прогресії', levels: [{ level: 1, count: 0 }] },
  ],
}
const THEME = {
  status: 'ready', id: 'real-numbers', number: '1', title: 'Дійсні числа', levels: [
    { level: 1, tasks: [
      { ref: { provider: 'm4sh_bank', id: 'nmt-sc-1' }, number: 1, type: 'single_choice', text: 'Обчисліть $\\frac{1}{2}+\\frac{1}{2}$.',
        choices: [{ label: 'А', text: '$1$' }, { label: 'Б', text: '$2$' }], answer: 'А' },
      { ref: { provider: 'm4sh_bank', id: 'nmt-oa-2' }, number: 3, type: 'open_answer', text: 'Знайдіть $x$.', answer: null },
    ] },
    { level: 2, tasks: [
      { ref: { provider: 'm4sh_bank', id: 'nmt-mt-3' }, number: 7, type: 'matching', text: 'Установіть відповідність.',
        left: [{ id: '1', text: '$a$' }], right: [{ id: 'А', text: '$b$' }], answer: '1 — А' },
    ] },
  ],
}
const CARD = { status: 'ready', type: 'nmt_task', w: 860, h: 440, data: { externalId: 'nmt-sc-1', presentationScale: 2, question: 'Q' } }

function routeGet(overrides: { overview?: unknown; theme?: unknown; card?: unknown } = {}) {
  get.mockImplementation(((url: string) => Promise.resolve(
    url.includes('/card/') ? (overrides.card ?? CARD)
      : url.includes('/themes/') ? (overrides.theme ?? THEME)
        : (overrides.overview ?? OVERVIEW))) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  _resetZbirnykCache()
  setActivePinia(createPinia())
})

describe('ZB-1 вкладку бачить лише пілот', () => {
  it('кнопка й вміст вкладки — лише за zbirnyk у pilots з /me, не в локальному режимі', () => {
    expect(SIDEBAR).toMatch(/pilots\?\.includes\('zbirnyk'\)/)
    // 31.10: zbirnykShown = пілот zbirnyk і не історик без математики (власник: «для історика… прибрати збірник»)
    expect(SIDEBAR).toMatch(/const zbirnykShown = computed\(\(\) => zbirnykEnabled\.value && gateOpts\.value\.mathTools\)/)
    expect(SIDEBAR).toMatch(/v-if="zbirnykShown && !localMode"[\s\S]{0,300}@click="pickTab\('zbirnyk'\)"/)
    expect(SIDEBAR).toMatch(/v-else-if="activeTab === 'zbirnyk' && zbirnykShown"[\s\S]{0,40}<ZbirnykTab \/>/)
  })
})

describe('ZB-2 сервер і кеш', () => {
  it('огляд — один запит; тема — один запит', async () => {
    routeGet()
    await getZbirnykOverview()
    await getZbirnykOverview()
    await getZbirnykTheme('real-numbers')
    await getZbirnykTheme('real-numbers')
    expect(get.mock.calls.map(c => c[0])).toEqual([
      '/v1/learning-content/zbirnyk/', '/v1/learning-content/zbirnyk/themes/real-numbers/',
    ])
  })

  it('«недоступно» і помилку не кешуємо', async () => {
    get.mockResolvedValueOnce({ status: 'unavailable' } as never)
    expect((await getZbirnykOverview()).status).toBe('unavailable')
    get.mockRejectedValueOnce(new Error('net'))
    await expect(getZbirnykOverview()).rejects.toThrow('net')
    get.mockResolvedValueOnce(OVERVIEW as never)
    expect((await getZbirnykOverview()).status).toBe('ready')
    get.mockResolvedValueOnce({ status: 'unavailable' } as never)
    await getZbirnykTheme('real-numbers')
    get.mockResolvedValueOnce(THEME as never)
    expect((await getZbirnykTheme('real-numbers')).status).toBe('ready')
    expect(get).toHaveBeenCalledTimes(5)
  })
})

describe('ZB-3/4 задача на дошку', () => {
  function setup(canDraw = ref(true)) {
    const onAssetAdd = vi.fn()
    const drop = useContentDrop({
      sessionId: ref('sess-1'), lessonId: ref(null), canDraw, onAssetAdd,
      screenToCanvas: (x, y) => ({ x, y }),
    })
    return { drop, onAssetAdd }
  }

  it('картка від сервера → один asset `nmt_task` з даними сервера; верх — біля точки, де відпустили', async () => {
    routeGet()
    const { drop, onAssetAdd } = setup()
    drop.addAtPosition(ZBIRNYK_TASK_MIME, JSON.stringify({ id: 'nmt-sc-1' }), { x: 960, y: 540 })
    expect(zbirnykAdding.has('nmt-sc-1')).toBe(true)
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/v1/learning-content/zbirnyk/tasks/nmt-sc-1/card/')
    expect(onAssetAdd).toHaveBeenCalledOnce()
    const a = onAssetAdd.mock.calls[0][0]
    expect(a).toMatchObject({ type: 'nmt_task', src: '', x: 960 - 430, y: 540 - 24, w: 860, h: 440, rotation: 0, locked: false })
    expect(a.data).toEqual(CARD.data)
    expect(a.id).toMatch(/^tsk-/)
    expect(zbirnykAdding.size).toBe(0)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('«+» кладе від верху аркуша (власник 29.10), де б не був центр огляду', async () => {
    routeGet()
    const { drop, onAssetAdd } = setup()
    drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1","at":"top"}', { x: 960, y: 732 })
    await flushPromises()
    expect(onAssetAdd.mock.calls[0][0]).toMatchObject({ x: 960 - 430, y: 24 })
  })

  it('біля краю — картка не вилазить за аркуш', async () => {
    routeGet()
    const { drop, onAssetAdd } = setup()
    drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1"}', { x: 5, y: 5 })
    await flushPromises()
    const a = onAssetAdd.mock.calls[0][0]
    expect([a.x, a.y]).toEqual([0, 0])
  })

  it('збірник недоступний / запит упав — тост, без asset', async () => {
    const { drop, onAssetAdd } = setup()
    get.mockResolvedValueOnce({ status: 'unavailable' } as never)
    drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1"}', { x: 500, y: 500 })
    await flushPromises()
    get.mockRejectedValueOnce(new Error('404'))
    drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1"}', { x: 500, y: 500 })
    await flushPromises()
    expect(onAssetAdd).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledTimes(2)
    expect(zbirnykAdding.size).toBe(0)
  })

  it('зламаний payload — нічого не питаємо', async () => {
    const { drop, onAssetAdd } = setup()
    drop.addAtPosition(ZBIRNYK_TASK_MIME, 'не json', { x: 500, y: 500 })
    drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":5}', { x: 500, y: 500 })
    await flushPromises()
    expect(get).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
  })

  it('повторний натиск, поки йде, — ігнор; дошку закрили на час запиту — без asset, з тостом', async () => {
    let release!: (v: unknown) => void
    get.mockReturnValueOnce(new Promise(r => { release = r }) as never)
    const { drop, onAssetAdd } = setup()
    drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1"}', { x: 500, y: 500 })
    drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1"}', { x: 500, y: 500 })
    release(CARD)
    await flushPromises()
    expect(get).toHaveBeenCalledOnce()
    expect(onAssetAdd).toHaveBeenCalledOnce()

    const editable = ref(true)
    const other = setup(editable)
    get.mockImplementationOnce((async () => {
      editable.value = false
      return CARD
    }) as never)
    other.drop.addAtPosition(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1"}', { x: 500, y: 500 })
    await flushPromises()
    expect(other.onAssetAdd).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledOnce()
  })

  it('перетягування на дошку йде тим самим шляхом', async () => {
    routeGet()
    const { drop, onAssetAdd } = setup()
    const data: Record<string, string> = { [ZBIRNYK_TASK_MIME]: '{"id":"nmt-oa-2"}' }
    await drop.handleCanvasDrop({
      preventDefault: () => {}, clientX: 900, clientY: 600,
      dataTransfer: { getData: (m: string) => data[m] ?? '', types: Object.keys(data), files: [] },
    } as unknown as DragEvent)
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/v1/learning-content/zbirnyk/tasks/nmt-oa-2/card/')
    expect(onAssetAdd.mock.calls[0][0]).toMatchObject({ x: 900 - 430, y: 600 - 24 })
  })
})

describe('ZB-5 вкладка', () => {
  function mountTab(add = vi.fn()) {
    const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })
    return { add, w: mount(ZbirnykTab, { global: { plugins: [i18n], provide: { [ADD_TOOL_TO_BOARD_KEY as symbol]: add } } }) }
  }

  it('розділи → рівень → задачі з формулами; «+» несе лише id; відповідь — по натиску', async () => {
    routeGet()
    const { w, add } = mountTab()
    await flushPromises()
    expect(w.get('[data-testid="zbirnyk-theme-real-numbers"]').text()).toContain('Дійсні числа')
    expect(w.get('[data-testid="zbirnyk-theme-real-numbers"]').text()).toContain('3')
    await w.get('[data-testid="zbirnyk-theme-real-numbers"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid^="zbirnyk-task-"]').map(x => x.attributes('data-testid')))
      .toEqual(['zbirnyk-task-1', 'zbirnyk-task-3'])
    const first = w.get('[data-testid="zbirnyk-task-1"]')
    // Формула відрендерена KaTeX, варіанти показано.
    expect(first.find('.zb__text .katex').exists()).toBe(true)
    expect(first.findAll('.zb__choice').map(c => c.text().slice(0, 2))).toEqual(['А)', 'Б)'])
    // Відповідь схована; у задачі без відповіді кнопки немає.
    expect(first.find('[data-testid="zbirnyk-answer-1"]').text()).toBe('Відповідь')
    expect(w.find('[data-testid="zbirnyk-answer-3"]').exists()).toBe(false)
    await w.get('[data-testid="zbirnyk-answer-1"]').trigger('click')
    expect(w.get('[data-testid="zbirnyk-answer-1"]').text()).toBe('Відповідь: А')

    await w.get('[data-testid="zbirnyk-add-1"]').trigger('click')
    expect(add).toHaveBeenCalledWith(ZBIRNYK_TASK_MIME, '{"id":"nmt-sc-1","at":"top"}')

    await w.get('[data-testid="zbirnyk-level-2"]').trigger('click')
    expect(w.findAll('[data-testid^="zbirnyk-task-"]').map(x => x.attributes('data-testid'))).toEqual(['zbirnyk-task-7'])
    expect(w.findAll('.zb__match-col')).toHaveLength(2)

    const setData = vi.fn()
    await w.get('[data-testid="zbirnyk-task-7"]').trigger('dragstart', { dataTransfer: { setData, effectAllowed: '' } })
    expect(setData).toHaveBeenCalledWith(ZBIRNYK_TASK_MIME, '{"id":"nmt-mt-3"}')
  })

  it('категорії з назвами від сервера; порожня — неактивна, відкривається перша з задачами', async () => {
    routeGet()
    const { w } = mountTab()
    await flushPromises()
    await w.get('[data-testid="zbirnyk-theme-integral"]').trigger('click')
    await flushPromises()
    expect(w.findAll('.zb__level').map(b => b.text())).toEqual(['Тести', 'Відповідність', 'Коротка відповідь'])
    expect(w.get('[data-testid="zbirnyk-level-1"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="zbirnyk-level-2"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="zbirnyk-level-3"]').classes()).toContain('zb__level--active')
  })

  it('поки задача йде на дошку — «Додаю…» замість «+»', async () => {
    routeGet()
    const { w } = mountTab()
    await flushPromises()
    await w.get('[data-testid="zbirnyk-theme-real-numbers"]').trigger('click')
    await flushPromises()
    zbirnykAdding.add('nmt-sc-1')
    await flushPromises()
    expect(w.find('[data-testid="zbirnyk-add-1"]').exists()).toBe(false)
    expect(w.get('[data-testid="zbirnyk-task-1"]').text()).toContain('Додаю…')
  })

  it('збірник не відкрився — пояснення і «Спробувати ще», що питає сервер знову; місце в темі зберігається', async () => {
    get.mockResolvedValueOnce({ status: 'unavailable' } as never)
    const { w } = mountTab()
    await flushPromises()
    expect(w.get('[data-testid="zbirnyk-failed"]').text()).toContain('Збірник зараз не відкрився.')
    routeGet()
    await w.get('[data-testid="zbirnyk-failed"] button').trigger('click')
    await flushPromises()
    await w.get('[data-testid="zbirnyk-theme-real-numbers"]').trigger('click')
    await flushPromises()
    w.unmount()
    const again = mountTab().w
    await flushPromises()
    expect(again.find('[data-testid="zbirnyk-task-1"]').exists()).toBe(true)
  })
})
