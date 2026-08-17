/**
 * N1 Фаза 5 — режим review у ТОМУ САМОМУ прев'ю (ТЗ §5.1: розширити пропсом,
 * не форкати). Стережемо: авто-запуск при відкритті, групи за категорією,
 * значок «Графік» для add_graph, чесний підсумок «показано/відсіяно», і те,
 * що apply отримує ЛИШЕ відмічене (DoD: без явної галочки нічого не летить).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

const enrich = vi.fn()
const enrichApply = vi.fn()
const enrichProgress = vi.fn()
const reviewLesson = vi.fn()

vi.mock('../shipApi', () => ({
  shipApi: {
    enrich: (...args: unknown[]) => enrich(...args),
    enrichApply: (...args: unknown[]) => enrichApply(...args),
    enrichProgress: (...args: unknown[]) => enrichProgress(...args),
    reviewLesson: (...args: unknown[]) => reviewLesson(...args),
  },
}))
vi.mock('@/modules/winterboard/stores/opsSyncStore', () => ({
  useOpsSyncStore: () => ({ catchUp: vi.fn().mockResolvedValue({ status: 'applied', lastSeq: 1 }) }),
}))
vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({ applyCatchUpState: vi.fn() }),
}))


import EnrichPatchesPreview from '../EnrichPatchesPreview.vue'
import uk from '@/i18n/locales/uk.json'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

function mountPreview(mode: 'enrich' | 'review' = 'review') {
  return mount(EnrichPatchesPreview, {
    props: { artifactId: 'a1', visible: true, mode },
    global: { plugins: [i18n] },
  })
}

const REVIEW = {
  proposals: [
    { task_ref: '2', action: 'add_formula', category: 'формула', description: 'Табличні похідні',
      card_data: { title: 'Похідна степеневої', body: "(x^n)' = n x^{n-1}", badge: 'Формула' },
      latex_valid: true, latex_error: '' },
    { task_ref: '', action: 'add_card', category: 'теорія', description: 'Що таке похідна',
      card_data: { title: 'Геометричний зміст', body: 'Кутовий коефіцієнт дотичної.', badge: 'Теорія' },
      latex_valid: true, latex_error: '' },
    { task_ref: '2', action: 'add_graph', category: 'графік', description: 'Функція і похідна',
      graph_data: { expressions: [{ src: 'x^3' }, { src: '3*x^2' }], params: {} },
      card_data: { title: 'Функція і похідна', body: 'y = x^3, 3*x^2', badge: 'Графік' },
      latex_valid: true, latex_error: '' },
    { task_ref: '', action: 'add_formula', category: 'формула', description: 'Похідна суми',
      card_data: { title: 'Похідна суми', body: "(u+v)' = u' + v'", badge: 'Формула' },
      latex_valid: true, latex_error: '' },
  ],
  rejected: { UNKNOWN_FUNC: 1, DUPLICATE: 2 },
  categories: ['формула', 'теорія', 'графік'],
  error: null,
}

describe('EnrichPatchesPreview — mode="review"', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    enrich.mockReset(); enrichApply.mockReset(); enrichProgress.mockReset(); reviewLesson.mockReset()
    enrichProgress.mockResolvedValue(null)
  })

  it('стартує сам при відкритті, без композера й без enrich', async () => {
    reviewLesson.mockResolvedValueOnce(REVIEW)
    const w = mountPreview('review')
    await flushPromises()
    expect(reviewLesson).toHaveBeenCalledTimes(1)
    expect(reviewLesson.mock.calls[0][0]).toBe('a1')
    expect(enrich).not.toHaveBeenCalled()
    expect(w.find('.enrich-patches-preview__composer').exists()).toBe(false)
  })

  it('режим enrich (default) НЕ кличе review і показує композер — Фаза 4 не зачеплена', async () => {
    const w = mount(EnrichPatchesPreview, { props: { artifactId: 'a1', visible: true }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(reviewLesson).not.toHaveBeenCalled()
    expect(w.find('.enrich-patches-preview__composer').exists()).toBe(true)
  })

  it('групує за категорією: заголовок перед першою пропозицією групи, формули поруч', async () => {
    reviewLesson.mockResolvedValueOnce(REVIEW)
    const w = mountPreview()
    await flushPromises()
    const heads = w.findAll('.enrich-patches-preview__category').map(h => h.text())
    expect(heads).toEqual(['формула', 'теорія', 'графік'])
    // обидві формули — під одним заголовком (стабільне сортування за групою)
    const titles = w.findAll('.enrich-patches-preview__preview strong').map(x => x.text())
    expect(titles).toEqual(['Похідна степеневої', 'Похідна суми', 'Геометричний зміст', 'Функція і похідна'])
  })

  it('add_graph має значок «Графік»; чесний підсумок «показано / відсіяно»', async () => {
    reviewLesson.mockResolvedValueOnce(REVIEW)
    const w = mountPreview()
    await flushPromises()
    const badges = w.findAll('.enrich-patches-preview__badge').map(b => b.text())
    expect(badges).toContain('Графік')
    expect(w.find('.enrich-patches-preview__review-bar').text()).toContain('Пропозицій: 4')
    expect(w.find('.enrich-patches-preview__review-bar').text()).toContain('відсіяно валідатором: 3')
    // «Оброблено X/Y задач» — метрика enrich, у review не показується
    expect(w.text()).not.toContain('Оброблено')
  })

  it('apply отримує ЛИШЕ відмічене — індекси галочок не зсунуті групуванням', async () => {
    reviewLesson.mockResolvedValueOnce(REVIEW)
    enrichApply.mockResolvedValueOnce({ sections_added: 1, error: null, page_numbers: [1] })
    const w = mountPreview()
    await flushPromises()
    // Знімаємо всі, лишаємо лише графік (у DOM він 4-й після групування,
    // а в масиві патчів — 3-й: перевіряємо, що застосовується САМЕ графік).
    const boxes = w.findAll('input[type="checkbox"]')
    for (const b of boxes) await b.setValue(false)
    const rows = w.findAll('.enrich-patches-preview__item')
    const graphRow = rows.find(r => r.text().includes('Функція і похідна'))!
    await graphRow.find('input[type="checkbox"]').setValue(true)
    await w.find('.enrich-patches-preview__actions button').trigger('click')
    await flushPromises()
    expect(enrichApply).toHaveBeenCalledTimes(1)
    const sent = enrichApply.mock.calls[0][1]
    expect(sent).toHaveLength(1)
    expect(sent[0].action).toBe('add_graph')
    expect(sent[0].graph_data.expressions.map((e: any) => e.src)).toEqual(['x^3', '3*x^2'])
  })

  it('«Переглянути ще раз» перезапускає з нуля', async () => {
    reviewLesson.mockResolvedValueOnce(REVIEW).mockResolvedValueOnce({ ...REVIEW, proposals: [], rejected: {} })
    const w = mountPreview()
    await flushPromises()
    expect(w.findAll('.enrich-patches-preview__item')).toHaveLength(4)
    // Кнопок у смузі тепер дві («Чому відсіяно» + «Переглянути ще раз») —
    // беремо саме перезапуск, не першу-ліпшу.
    const again = w.findAll('.enrich-patches-preview__review-bar button')
      .find(b => b.text().includes('Переглянути ще раз'))!
    await again.trigger('click')
    await flushPromises()
    expect(reviewLesson).toHaveBeenCalledTimes(2)
    expect(w.findAll('.enrich-patches-preview__item')).toHaveLength(0)
  })

  it('підсумок apply лишається на екрані: скільки і куди + кнопка «Готово»', async () => {
    // Лаунчер більше не закриває вікно на @applied — інакше цей підсумок
    // ніхто не встигав прочитати, а тост на дошці вивести нікуди
    // (ToastContainer живе в PageShell, дошка його не рендерить).
    reviewLesson.mockResolvedValueOnce(REVIEW)
    enrichApply.mockResolvedValueOnce({ sections_added: 2, error: null, page_numbers: [3, 10] })
    const w = mountPreview()
    await flushPromises()
    await w.find('.enrich-patches-preview__actions button').trigger('click')
    await flushPromises()
    const summary = w.find('.enrich-patches-preview__result')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('2')
    expect(summary.text()).toContain('3, 10')   // розрізнені сторінки — через кому
    await summary.find('button').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })

  it('apply без жодної доданої секції — так і сказано, не порожній підсумок', async () => {
    reviewLesson.mockResolvedValueOnce(REVIEW)
    enrichApply.mockResolvedValueOnce({ sections_added: 0, error: null, page_numbers: [] })
    const w = mountPreview()
    await flushPromises()
    await w.find('.enrich-patches-preview__actions button').trigger('click')
    await flushPromises()
    expect(w.find('.enrich-patches-preview__result').text()).toContain('Нічого не додано')
  })

  it('порожній результат каже про себе, а не мовчить', async () => {
    reviewLesson.mockResolvedValueOnce({ proposals: [], rejected: {}, categories: [], error: null })
    const w = mountPreview()
    await flushPromises()
    expect(w.find('.enrich-patches-preview__review-bar').text()).toContain('не знайшов, що додати')
  })

  it('«Чому відсіяно» розкриває причини людською мовою', async () => {
    reviewLesson.mockResolvedValueOnce(REVIEW)
    const w = mountPreview()
    await flushPromises()
    expect(w.find('.enrich-patches-preview__rejected-list').exists()).toBe(false)
    const why = w.findAll('.enrich-patches-preview__review-bar button')
      .find(b => b.text().includes('Чому відсіяно'))!
    await why.trigger('click')
    const rows = w.findAll('.enrich-patches-preview__rejected-list li').map(li => li.text())
    expect(rows.join(' | ')).toContain('Графік, який рушій не намалює')
    expect(rows.join(' | ')).toContain('Таке вже є в уроці')
  })

  it('помилка BE показується, не ковтається', async () => {
    reviewLesson.mockResolvedValueOnce({ proposals: [], rejected: { BAD_JSON: 1 }, categories: [], error: 'Модель відповіла не за контрактом.' })
    const w = mountPreview()
    await flushPromises()
    expect(w.find('.enrich-patches-preview__error').text()).toContain('не за контрактом')
  })
})
