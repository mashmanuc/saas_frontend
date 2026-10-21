/**
 * «📝 Запропонувати домашку» (власник 2026-10-19: «тупо домашні завдання, які вчитель скидає учневі»).
 *
 * Кнопка — лише коли на уроці є задачі з банку; натиск нічого не кладе на дошку, а відкриває вікно з
 * пропозицією списку (сервер добирає, модель не викликається). «Інші задачі» — без повторів; відповіді — лише
 * вчителю; «Скопіювати картинку» — картка з формулами й підписом M4SH (власник 19.10: текст «очі ріже»);
 * «Додати в урок» — ОДНА картка-список на новій останній сторінці.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import { useWBStore } from '../board/state/boardStore'
import { HOMEWORK_TITLE, homeworkPage, lessonHasBankTasks } from '../board/homeworkCard'

const mocks = vi.hoisted(() => ({
  propose: vi.fn(),
  image: vi.fn(),
  order: [] as string[],
  sync: { mode: 'SYNC', inputLocked: false, flushAll: vi.fn() },
}))
vi.mock('@/modules/intent/homeworkApi', () => ({ proposeHomework: mocks.propose, homeworkImage: mocks.image }))
vi.mock('../stores/opsSyncStore', () => ({ useOpsSyncStore: () => mocks.sync }))

import WBHomeworkButton from '../components/homework/WBHomeworkButton.vue'
import TheoryCardRenderer from '../components/board/objects/TheoryCardRenderer.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const task = (ext: string) => ({ id: `a-${ext}`, type: 'nmt_task', x: 0, y: 0, w: 560, h: 380,
  data: { externalId: ext, question: 'Обчисліть $1+1$.' } })
const proposal = (ids: string[]) => ({
  title: HOMEWORK_TITLE, lesson: 'Дроби', task_count: ids.length, requested: 10,
  message: `${ids.length} задачі, такі самі, як на уроці.`,
  date: '20 жовтня',
  instruction: 'Обчисліть.',
  items: ids.map(id => ({ id, text: `Задача ${id}: $\\frac{1}{2}$`, short: `$\\frac{1}{2}+${id.length}$`, answer: `(А) ${id}` })),
  copy_text: ['Домашнє завдання — Дроби', ...ids.map((id, i) => `${i + 1}. Задача ${id}: 1/2`)].join('\n'),
})

function mountButton() {
  return mount(WBHomeworkButton, {
    props: { boardId: 'board-1' },
    global: { plugins: [i18n()], stubs: { Teleport: true } },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.order.length = 0
  mocks.propose.mockReset()
  mocks.propose.mockImplementation(async () => { mocks.order.push('post'); return proposal(['a', 'b', 'c']) })
  mocks.sync.mode = 'SYNC'
  mocks.sync.inputLocked = false
  mocks.sync.flushAll.mockReset()
  mocks.sync.flushAll.mockImplementation(async () => { mocks.order.push('flush') })
  const store = useWBStore()
  store.workspaceId = 'board-1'
  store.pages = [{ id: 'p1', name: 'p1', strokes: [], assets: [task('L1')] }] as never
  store.currentPageIndex = 0
  store.setMode('edit')
})

describe('кнопка — лише там, де є з чого складати', () => {
  it('є задачі з банку й режим редагування — кнопка зі словами', () => {
    const w = mountButton()
    expect(w.get('[data-testid="wb-homework-button"]').text()).toContain('Запропонувати домашку')
  })

  it('немає задач з банку (картки, графіки) — кнопки немає', () => {
    useWBStore().pages = [{ id: 'p1', name: 'p1', strokes: [], assets: [{ id: 'c', type: 'theory_card', data: {} }] }] as never
    expect(mountButton().find('[data-testid="wb-homework-button"]').exists()).toBe(false)
  })

  it('не в режимі редагування (учень, Replay) — кнопки немає', () => {
    useWBStore().setMode('readonly')
    expect(mountButton().find('[data-testid="wb-homework-button"]').exists()).toBe(false)
  })

  it('lessonHasBankTasks: лише nmt_task з externalId', () => {
    expect(lessonHasBankTasks([{ assets: [{ type: 'nmt_task', data: { externalId: 'x' } }] }])).toBe(true)
    expect(lessonHasBankTasks([{ assets: [{ type: 'nmt_task', data: { externalId: '' } }] }])).toBe(false)
    expect(lessonHasBankTasks([{ assets: [{ type: 'theory_card', data: { externalId: 'x' } }] }])).toBe(false)
  })
})

describe('вікно пропозиції', () => {
  it('натиск: спершу доносить дії дошки, потім просить сервер; дошка не змінюється', async () => {
    let release: () => void = () => {}
    mocks.sync.flushAll.mockImplementation(() => new Promise<void>(resolve => {
      release = () => { mocks.order.push('flush'); resolve() }
    }))
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    // Поки добирає — Інтегралик думає, як під час генерації уроку (власник 20.10)
    expect(w.find('[data-testid="wb-homework-thinking"] [data-testid="integralyk-loader"]').exists()).toBe(true)
    release()
    await flushPromises()
    expect(w.find('[data-testid="wb-homework-thinking"]').exists()).toBe(false)
    expect(mocks.order).toEqual(['flush', 'post'])
    expect(mocks.propose).toHaveBeenCalledWith({ boardId: 'board-1', count: 10, exclude: [], level: null })
    expect(w.findAll('[data-testid="wb-homework-list"] li')).toHaveLength(3)
    expect(useWBStore().pages).toHaveLength(1)
  })

  it('«Інші задачі» — пропускає щойно запропоновані; кількість −/+ від 1 до 20', async () => {
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="wb-homework-others"]').trigger('click')
    await flushPromises()
    expect(mocks.propose).toHaveBeenLastCalledWith({ boardId: 'board-1', count: 10, exclude: ['a', 'b', 'c'], level: null })
    const plus = w.findAll('.wb-homework__step')[1]
    for (let i = 0; i < 15; i++) await plus.trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="wb-homework-count"]').text()).toBe('20')
  })

  it('відповіді — лише після «Показати відповіді»', async () => {
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="wb-homework-answer"]')).toHaveLength(0)
    await w.get('[data-testid="wb-homework-answers"]').trigger('click')
    expect(w.findAll('[data-testid="wb-homework-answer"]')).toHaveLength(3)
  })

  it('«Скопіювати картинку» — картинка з сервера за цими задачами в буфер; без буфера — «Завантажити»', async () => {
    const png = new Blob(['png'], { type: 'image/png' })
    mocks.image.mockResolvedValue(png)
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
    vi.stubGlobal('ClipboardItem', class { constructor(public items: Record<string, unknown>) {} })
    const createObjectURL = vi.fn(() => 'blob:hw')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="wb-homework-copy"]').trigger('click')
    await flushPromises()
    expect(mocks.image).toHaveBeenCalledWith({ boardId: 'board-1', ids: ['a', 'b', 'c'], answers: false, level: null })
    expect(write).toHaveBeenCalledTimes(1)
    expect(Object.keys((write.mock.calls[0][0] as { items: Record<string, unknown> }[])[0].items)).toEqual(['image/png'])
    expect(w.get('[data-testid="wb-homework-copy"]').text()).toContain('Скопійовано')
    write.mockRejectedValue(new Error('NotAllowedError'))
    await w.get('[data-testid="wb-homework-copy"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="wb-homework-download"]').attributes('href')).toBe('blob:hw')
    vi.unstubAllGlobals()
  })

  it('картинку не намалювали — вчитель бачить пояснення сервера, а не загальне «Не вдалося…» (тіло — Blob)', async () => {
    const detail = 'Частини задач уже немає в банку — запропонуйте домашку ще раз.'
    const failed = Promise.reject({ response: { status: 400, data: new Blob([JSON.stringify({ detail })], { type: 'application/json' }) } })
    failed.catch(() => {})   // обіцянку споживає сам компонент; тут — щоб тест не бачив «необробленої»
    mocks.image.mockReturnValue(failed)
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="wb-homework-copy"]').trigger('click')
    await flushPromises()
    await new Promise(r => setTimeout(r, 0))   // Blob.text() — макрозадача в jsdom
    await flushPromises()
    expect(w.get('[data-testid="wb-homework-error"]').text()).toBe(detail)
  })

  it('«Показати відповіді» → копія з відповідями; перемкнув — «Скопійовано» скинуто (власник 20.10)', async () => {
    mocks.image.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
    vi.stubGlobal('ClipboardItem', class { constructor(public items: Record<string, unknown>) {} })
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="wb-homework-answers"]').trigger('click')
    expect(w.get('[data-testid="wb-homework-copy"]').text()).toBe('Скопіювати з відповідями')
    await w.get('[data-testid="wb-homework-copy"]').trigger('click')
    await flushPromises()
    expect(mocks.image).toHaveBeenLastCalledWith({ boardId: 'board-1', ids: ['a', 'b', 'c'], answers: true, level: null })
    expect(w.get('[data-testid="wb-homework-copy"]').text()).toContain('Скопійовано')
    await w.get('[data-testid="wb-homework-answers"]').trigger('click')
    expect(w.get('[data-testid="wb-homework-copy"]').text()).toBe('Скопіювати картинку')
    vi.unstubAllGlobals()
  })

  it('спільна вказівка — один раз угорі, рядки — самі вирази двома колонками', async () => {
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="wb-homework-instruction"]').text()).toBe('Обчисліть.')
    expect(w.get('[data-testid="wb-homework-list"]').classes()).toContain('wb-homework__list--grid')
    expect(w.text()).toContain('20 жовтня')
  })

  it('«Додати в урок» — одна картка-список на новій ОСТАННІЙ сторінці, без відповідей; ↶ прибирає', async () => {
    const store = useWBStore()
    store.pages = [...store.pages, { id: 'p2', name: 'p2', strokes: [], assets: [], background: 'dots', backgroundColor: '#fde2c8' }] as never
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="wb-homework-add"]').trigger('click')
    expect(store.pages.map(p => p.name)).toEqual(['p1', 'p2', HOMEWORK_TITLE])
    expect(store.currentPageIndex).toBe(2)
    const [card] = store.pages[2].assets as unknown as { type: string; data: Record<string, unknown> }[]
    expect(store.pages[2].assets).toHaveLength(1)
    expect(card.type).toBe('theory_card')
    expect(card.data.items).toEqual(['$\\frac{1}{2}+1$', '$\\frac{1}{2}+1$', '$\\frac{1}{2}+1$'])
    expect(card.data.instruction).toBe('Обчисліть.')
    expect(JSON.stringify(card.data)).not.toContain('(А)')
    expect(card.data.taskIds).toEqual(['a', 'b', 'c'])  // наступна пропозиція їх не повторить
    // Колір і візерунок — як в останньої сторінки уроку (власник 20.10)
    expect(store.pages[2]).toMatchObject({ background: 'dots', backgroundColor: '#fde2c8' })
    expect(w.find('[data-testid="wb-homework-modal"]').exists()).toBe(false)
    store.undo()
    expect(store.pages.map(p => p.name)).toEqual(['p1', 'p2'])
  })

  it('дошка заблокована для змін — не додає й каже чому', async () => {
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    mocks.sync.mode = 'DESYNC'
    await w.get('[data-testid="wb-homework-add"]').trigger('click')
    expect(useWBStore().pages).toHaveLength(1)
    expect(w.get('[data-testid="wb-homework-error"]').text()).toContain('недоступна')
  })

  it('пояснення сервера («немає задач з банку») — у вікні', async () => {
    mocks.propose.mockRejectedValue({ response: { data: { detail: 'На цьому уроці немає задач з банку — додайте задачі або назвіть тему.' } } })
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="wb-homework-error"]').text()).toContain('немає задач з банку')
  })

  it('Інтегралик («дай домашку на 6») відкриває те саме вікно з його кількістю', async () => {
    const w = mountButton()
    const detail = { count: 6, handled: false }
    window.dispatchEvent(new CustomEvent('m4sh:homework-propose', { detail }))
    await flushPromises()
    expect(detail.handled).toBe(true)
    expect(mocks.propose).toHaveBeenCalledWith({ boardId: 'board-1', count: 6, exclude: [], level: null })
    expect(w.find('[data-testid="wb-homework-modal"]').exists()).toBe(true)
    w.unmount()
  })
})

describe('картка «Домашнє завдання» показує список рядками', () => {
  const mountCard = (data: Record<string, unknown>) => mount(TheoryCardRenderer, {
    props: { asset: { id: 't1', type: 'theory_card', src: '', x: 0, y: 0, w: 1200, h: 400, rotation: 0, data } as never, canFit: false },
    global: { plugins: [i18n()] },
  })

  it('є `items` — нумерований список, кожна задача свій рядок', () => {
    const page = homeworkPage(proposal(['a', 'b']) as never)
    const w = mountCard(page.assets[0].data as never)
    expect(w.findAll('[data-testid="theory-card-list"] li')).toHaveLength(2)
    expect(w.find('.theory-card__text').exists()).toBe(false)
    expect(w.get('[data-testid="theory-card-instruction"]').text()).toBe('Обчисліть.')
    expect(w.get('[data-testid="theory-card-list"]').classes()).toContain('theory-card__list--grid')
    expect(w.text()).toContain('m4sh.org')
  })

  it('звичайна картка без `items` — як і була, текстом', () => {
    const w = mountCard({ version: 1, title: 'Правило', body: 'Текст правила' })
    expect(w.find('[data-testid="theory-card-list"]').exists()).toBe(false)
    expect(w.get('.theory-card__text').text()).toContain('Текст правила')
  })
})

describe('сторінка домашки — того ж кольору, що й попередні (власник 20.10)', () => {
  it('бере колір і візерунок останньої сторінки; фото у фоні не копіює', async () => {
    const { lastPageLook } = await import('../board/homeworkCard')
    expect(lastPageLook([{ backgroundColor: '#fff' }, { background: 'grid', backgroundColor: '#dbeafe' }]))
      .toEqual({ background: 'grid', backgroundColor: '#dbeafe' })
    expect(lastPageLook([{ background: { type: 'image', url: 'x' } as never, backgroundColor: '#fef9c3' }]))
      .toEqual({ background: 'white', backgroundColor: '#fef9c3' })
    expect(lastPageLook([])).toEqual({ background: 'white', backgroundColor: '#ffffff' })
  })
})

// Рівень складності (власник 2026-10-21: «кнопку з можливістю вибору складності… 1-2 чи 2-3 чи 3-4 чи 4-5»)
describe('рівень домашки', () => {
  it('рядок «Рівень:» — «Як на уроці» (обрано) і чотири діапазони', async () => {
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    const levels = w.get('[data-testid="wb-homework-levels"]')
    expect(levels.text()).toContain('Рівень:')
    expect(levels.findAll('button').map(b => b.text())).toEqual(['Як на уроці', '1–2', '2–3', '3–4', '4–5'])
    expect(w.get('[data-testid="wb-homework-level-lesson"]').attributes('aria-pressed')).toBe('true')
  })

  it('вибір рівня — новий набір цього рівня тієї самої кількості; «Інші задачі» й картинка — з тим самим рівнем', async () => {
    const w = mountButton()
    await w.get('[data-testid="wb-homework-button"]').trigger('click')
    await flushPromises()
    mocks.propose.mockImplementation(async () => ({ ...proposal(['x', 'y']), level: [3, 4], level_label: 'рівень 3–4' }))
    await w.get('[data-testid="wb-homework-level-3-4"]').trigger('click')
    await flushPromises()
    expect(mocks.propose).toHaveBeenLastCalledWith({ boardId: 'board-1', count: 10, exclude: [], level: [3, 4] })
    expect(w.get('[data-testid="wb-homework-level-3-4"]').attributes('aria-pressed')).toBe('true')
    await w.get('[data-testid="wb-homework-others"]').trigger('click')
    await flushPromises()
    expect(mocks.propose).toHaveBeenLastCalledWith({ boardId: 'board-1', count: 10, exclude: ['x', 'y'], level: [3, 4] })
    mocks.image.mockReturnValue(new Promise(() => {}))
    await w.get('[data-testid="wb-homework-copy"]').trigger('click')
    expect(mocks.image).toHaveBeenLastCalledWith({ boardId: 'board-1', ids: ['x', 'y'], answers: false, level: [3, 4] })
    // той самий рівень ще раз — запиту немає
    const calls = mocks.propose.mock.calls.length
    await w.get('[data-testid="wb-homework-level-3-4"]').trigger('click')
    expect(mocks.propose.mock.calls.length).toBe(calls)
  })

  it('картка на дошці: рівень у шапці й у даних (для копії картинки з картки)', () => {
    const page = homeworkPage({ ...proposal(['a']), level: [2, 3], level_label: 'рівень 2–3' } as never) as never as {
      assets: Array<{ data: { badge: string; level?: number[] } }>
    }
    expect(page.assets[0].data.badge).toBe(`${HOMEWORK_TITLE} · рівень 2–3`)
    expect(page.assets[0].data.level).toEqual([2, 3])
    const plain = homeworkPage(proposal(['a']) as never) as never as { assets: Array<{ data: { badge: string; level?: number[] } }> }
    expect(plain.assets[0].data.badge).toBe(HOMEWORK_TITLE)
    expect('level' in plain.assets[0].data).toBe(false)
  })
})
