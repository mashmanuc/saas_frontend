import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import uk from '@/i18n/locales/uk.json'

vi.mock('@/modules/winterboard/api/materials', () => ({
  default: { read: vi.fn(), extract: vi.fn(), confirm: vi.fn(), reset: vi.fn() },
}))

import materialsApi from '@/modules/winterboard/api/materials'
import MaterialExtractPanel from '../MaterialExtractPanel.vue'
import MaterialLessonDialog from '../MaterialLessonDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

const COST = {
  kind: 'pdf', total_pages: 12, vision_calls: 2, ocr_calls: 10, total_calls: 12,
  text_layer_pages: 0, cached_pages: 0, skipped_pages: [], blocked_pages: [],
  max_pages: 30, billing_key: 'monthly_ai_requests', ocr_enabled: true,
  upper_bound: true, error: '',
}

const PAGE = {
  page_no: 1, text: 'текст', source: 'ocr' as const, evidence: 'inferred' as const,
  status: 'done' as const, error: '', model: 'm', tokens: 0, warnings: [],
  blocks_count: 3, needs_review: true, confirmed_at: null, updated_at: '',
}

function mountPanel() {
  return mount(MaterialExtractPanel, {
    props: { assetId: 7, assetName: 'zbirnyk.pdf' },
    global: { plugins: [i18n] },
  })
}

describe('MaterialExtractPanel · ціна до запуску', () => {
  beforeEach(() => {
    vi.mocked(materialsApi.read).mockReset().mockResolvedValue({
      asset_id: 7, name: 'zbirnyk.pdf', content_type: 'application/pdf',
      pages: [], cost_estimate: COST,
    } as never)
    vi.mocked(materialsApi.extract).mockReset()
    vi.mocked(materialsApi.confirm).mockReset().mockResolvedValue({} as never)
  })

  it('показує ціну ДО того, як щось запускати', async () => {
    const w = mountPanel()
    await flushPromises()
    const cost = w.find('.material-panel__cost')
    expect(cost.exists()).toBe(true)
    expect(cost.text()).toContain('12')
  })

  it('ціна стоїть ПЕРЕД кнопкою запуску, не після', async () => {
    // Головна чесність 6-1: тьютор бачить, скільки спишеться, перш ніж
    // натиснути. Тултип або підпис знизу цього не дають.
    const w = mountPanel()
    await flushPromises()
    const html = w.html()
    expect(html.indexOf('material-panel__cost'))
      .toBeLessThan(html.indexOf('material-panel__actions'))
  })

  it('розкладка називає всі три гілки', async () => {
    const w = mountPanel()
    await flushPromises()
    const detail = w.find('.material-panel__cost-detail').text()
    expect(detail).toContain('0')   // текстовий шар
    expect(detail).toContain('2')   // vision
    expect(detail).toContain('10')  // ocr
  })

  it('стеля показується, коли сторінок більше за ліміт', async () => {
    vi.mocked(materialsApi.read).mockResolvedValue({
      asset_id: 7, name: 'x', content_type: 'application/pdf', pages: [],
      cost_estimate: { ...COST, total_pages: 40, skipped_pages: [31, 32] },
    } as never)
    const w = mountPanel()
    await flushPromises()
    expect(w.text()).toContain('30')
  })
})

describe('MaterialExtractPanel · 202 це не «готово»', () => {
  beforeEach(() => {
    vi.mocked(materialsApi.read).mockReset().mockResolvedValue({
      asset_id: 7, name: 'x', content_type: 'application/pdf',
      pages: [], cost_estimate: COST,
    } as never)
  })

  it('черга дає стан «читаю», а не готовий звіт', async () => {
    vi.mocked(materialsApi.extract).mockResolvedValue({
      task_id: 't1', asset_id: 7, cost_estimate: COST,
    } as never)
    const w = mountPanel()
    await flushPromises()
    await w.find('.material-panel__actions button').trigger('click')
    await flushPromises()

    expect(w.find('.material-panel__running').exists()).toBe(true)
    expect(w.text()).toContain('Читаю')
  })

  it('синхронний звіт не лишає стан «читаю»', async () => {
    vi.mocked(materialsApi.extract).mockResolvedValue({
      asset_id: 7, total_pages: 1, vision_calls: 1, ocr_calls: 0, total_calls: 1,
      text_layer_pages: 0, cached_pages: 0, skipped_pages: [], message: '',
      error: '', pages: [],
    } as never)
    const w = mountPanel()
    await flushPromises()
    await w.find('.material-panel__actions button').trigger('click')
    await flushPromises()

    expect(w.find('.material-panel__running').exists()).toBe(false)
  })
})

describe('MaterialExtractPanel · вимкнено на сервері', () => {
  it('403 дає чесний текст, а не «сталася помилка»', async () => {
    vi.mocked(materialsApi.read).mockReset()
      .mockRejectedValue({ response: { status: 403 } })
    const w = mountPanel()
    await flushPromises()

    const box = w.find('.material-panel__disabled')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('вимкнено')
    expect(w.find('.material-panel__error').exists()).toBe(false)
  })

  it('інша помилка лишається помилкою', async () => {
    vi.mocked(materialsApi.read).mockReset()
      .mockRejectedValue({ response: { status: 500 } })
    const w = mountPanel()
    await flushPromises()

    expect(w.find('.material-panel__error').exists()).toBe(true)
    expect(w.find('.material-panel__disabled').exists()).toBe(false)
  })
})

describe('МАСОВОЇ кнопки підтвердження НЕМАЄ', () => {
  beforeEach(() => {
    vi.mocked(materialsApi.read).mockReset().mockResolvedValue({
      asset_id: 7, name: 'x', content_type: 'application/pdf',
      pages: [PAGE, { ...PAGE, page_no: 2 }], cost_estimate: COST,
    } as never)
  })

  it('тест на те, чого немає — і він тут навмисно', async () => {
    // Ворота 6-2 існують тому, що роздільника рукопису в нас немає і людина
    // лишається єдиним роздільником. «Підтвердити всі» перетворює ворота на
    // клікання й робить 6-1, 6-1b і 6-2 декорацією. Без цього тесту кнопку
    // колись додадуть «для зручності».
    const w = mountPanel()
    await flushPromises()

    const text = w.text().toLowerCase()
    expect(text).not.toContain('підтвердити всі')
    expect(text).not.toContain('підтвердити все')
    expect(w.find('[data-confirm-all]').exists()).toBe(false)
  })

  it('кожна сторінка підтверджується окремо', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.material-page__confirm-btn')).toHaveLength(2)
  })

  it('підтвердження шле рівно одну сторінку', async () => {
    const w = mountPanel()
    await flushPromises()
    const row = w.findAllComponents({ name: 'MaterialPageRow' })[0]
    await row.find('.material-page__toggle').trigger('click')
    await row.find('.material-page__confirm-btn').trigger('click')
    await flushPromises()

    expect(materialsApi.confirm).toHaveBeenCalledWith(7, [1])
  })
})

describe('MaterialLessonDialog', () => {
  const result = {
    task_count: 6,
    shortfall: { requested: 10, got: 6, detail: 'банк у цьому режимі не добирає' },
    rejected: [
      { reason: 'script_collapsed', detail: 'текст розпізнався літерами-двійниками', page_no: 21, number: '2.19' },
      { reason: 'script_collapsed', detail: 'текст розпізнався літерами-двійниками', page_no: 21, number: '2.20' },
      { reason: 'theory_not_supported', detail: 'це теорія, а не задача', page_no: 25 },
    ],
  }

  const mountDialog = (props = {}) =>
    mount(MaterialLessonDialog, { props, global: { plugins: [i18n] } })

  it('три режими підписані людською мовою, без enum-ів', () => {
    const text = mountDialog().text()
    expect(text).toContain('лише з мого матеріалу')
    expect(text).toContain('мій матеріал, решту з банку')
    expect(text).toContain('лише з банку')
    expect(text).not.toContain('bank_only')
  })

  it('rejected рендериться з причинами від BE', () => {
    const w = mountDialog({ result })
    const box = w.find('.material-lesson__rejected')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('літерами-двійниками')
    expect(box.text()).toContain('це теорія')
  })

  it('однакові причини згруповано з лічильником', () => {
    const w = mountDialog({ result })
    expect(w.findAll('.material-lesson__rejected li')).toHaveLength(2)
    expect(w.find('.material-lesson__rejected').text()).toContain('2.19')
  })

  it('shortfall видно окремим блоком', () => {
    const w = mountDialog({ result })
    const box = w.find('.material-lesson__shortfall')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('10')
    expect(box.text()).toContain('6')
  })

  it('blocked чесно вимикає кнопку й пояснює чому', () => {
    // BE не приймає source_policy — мовчазна генерація з банку була б
    // брехнею, тож кнопка заблокована, а причина написана.
    const w = mountDialog({ blocked: true })
    expect(w.find('.material-lesson__blocked').exists()).toBe(true)
    expect(w.findAll('.material-lesson__actions button')[0].attributes('disabled'))
      .toBeDefined()
  })

  it('без blocked кнопка працює', () => {
    const w = mountDialog()
    expect(w.findAll('.material-lesson__actions button')[0].attributes('disabled'))
      .toBeUndefined()
  })
})
