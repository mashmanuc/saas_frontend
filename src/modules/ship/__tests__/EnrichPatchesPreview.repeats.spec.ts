/**
 * Повтори не заступають роботу.
 *
 * Живий гейт B-T1 (2026-08-13): другий прогін enrich дав 13 пропозицій, з
 * них 12 уже лежали в уроці. Кожна була чесно позначена ♻️ і з знятою
 * галочкою — і саме це вбило екран: тьютор бачив стіну попереджень і мусив
 * вишукувати в ній єдину нову картку.
 *
 * Тому повтори йдуть у кінець і згорнуті, як пропуски. Вони НЕ зникають:
 * інколи ту саму опору справді ставлять удруге.
 *
 * Найкрихкіше місце тут — не видимість, а НУМЕРАЦІЯ: `selected` і
 * `rendered` індексуються оригінальним індексом патча, а показ переставляє
 * рядки. Тест на застосування нижче стереже саме це — помилка зсуву
 * виглядала б як «поставив галочку на одній картці, на дошку лягла інша».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

const enrich = vi.fn()
const enrichApply = vi.fn()

vi.mock('../shipApi', () => ({
  shipApi: {
    enrich: (...args: unknown[]) => enrich(...args),
    enrichApply: (...args: unknown[]) => enrichApply(...args),
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

function mountPreview() {
  return mount(EnrichPatchesPreview, {
    props: { artifactId: 'a1', visible: true },
    global: { plugins: [i18n] },
  })
}

function patch(title: string, already = false) {
  return {
    task_ref: `nmt-${title}`, action: 'add_card',
    card_data: { title, body: 'текст', badge: 'Формула' },
    latex_valid: true, latex_error: '', already_on_board: already,
  }
}

async function run(wrapper: ReturnType<typeof mountPreview>, patches: unknown[]) {
  enrich.mockResolvedValue({
    patches, error: null, processed_tasks: patches.length,
    total_tasks: patches.length, failed_task_refs: [], skipped: [],
  })
  const ta = wrapper.find('textarea').element as HTMLTextAreaElement
  ta.value = 'додай формули'
  // `__run` — явний клас кнопки запуску (рев'ю 2026-08-15: композер із чіпами
  // й мікрофоном; старий `__input button` ловив би тепер чіп або мік).
  await wrapper.find('.enrich-patches-preview__run').trigger('click')
  await flushPromises()
}

/** Видимі картки — в порядку показу. v-show лишає вузол у DOM. */
function visibleTitles(wrapper: ReturnType<typeof mountPreview>): string[] {
  return wrapper.findAll('.enrich-patches-preview__item')
    .filter(w => (w.element as HTMLElement).style.display !== 'none')
    .map(w => w.find('.enrich-patches-preview__preview strong').text())
}

describe('enrich — повтори згорнуті в окремий блок', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    enrich.mockReset()
    enrichApply.mockReset()
  })

  it('свіжа картка видна, повтори сховані', async () => {
    const wrapper = mountPreview()
    await run(wrapper, [patch('Стара 1', true), patch('Нова'), patch('Стара 2', true)])

    expect(visibleTitles(wrapper)).toEqual(['Нова'])
    // самі вузли лишаються — це згортання, не викидання
    expect(wrapper.findAll('.enrich-patches-preview__item')).toHaveLength(3)
  })

  it('заголовок блоку каже, скільки саме повторів', async () => {
    const wrapper = mountPreview()
    await run(wrapper, [patch('Нова'), patch('Стара 1', true), patch('Стара 2', true)])

    const toggles = wrapper.findAll('.enrich-patches-preview__skipped-toggle')
    expect(toggles).toHaveLength(1)
    expect(toggles[0].text()).toContain('2')
  })

  it('розгортання показує повтори — і вони йдуть ПІСЛЯ свіжого', async () => {
    const wrapper = mountPreview()
    await run(wrapper, [patch('Стара 1', true), patch('Нова'), patch('Стара 2', true)])

    await wrapper.find('.enrich-patches-preview__skipped-toggle').trigger('click')
    expect(visibleTitles(wrapper)).toEqual(['Нова', 'Стара 1', 'Стара 2'])
  })

  it('без повторів блоку немає — звичайний список не обростає кнопкою', async () => {
    const wrapper = mountPreview()
    await run(wrapper, [patch('Нова 1'), patch('Нова 2')])

    expect(wrapper.find('.enrich-patches-preview__skipped-toggle').exists()).toBe(false)
    expect(visibleTitles(wrapper)).toEqual(['Нова 1', 'Нова 2'])
  })

  it('усе — повтори: список не порожній, лише згорнутий', async () => {
    const wrapper = mountPreview()
    await run(wrapper, [patch('Стара 1', true), patch('Стара 2', true)])

    expect(visibleTitles(wrapper)).toEqual([])
    expect(wrapper.find('.enrich-patches-preview__skipped-toggle').exists()).toBe(true)
    await wrapper.find('.enrich-patches-preview__skipped-toggle').trigger('click')
    expect(visibleTitles(wrapper)).toEqual(['Стара 1', 'Стара 2'])
  })

  it('галочка на повторі застосовує САМЕ його — перестановка не зсуває нумерацію', async () => {
    enrichApply.mockResolvedValue({ sections_added: 1, page_numbers: [1] })
    const wrapper = mountPreview()
    await run(wrapper, [patch('Стара 1', true), patch('Нова'), patch('Стара 2', true)])
    await wrapper.find('.enrich-patches-preview__skipped-toggle').trigger('click')

    // третій рядок у ПОКАЗІ — це «Стара 2», хоча в масиві вона теж третя;
    // беремо чекбокс саме того вузла, чий заголовок бачимо.
    const rows = wrapper.findAll('.enrich-patches-preview__item')
    const target = rows.find(
      r => r.find('.enrich-patches-preview__preview strong').text() === 'Стара 2',
    )!
    await target.find('input[type="checkbox"]').setValue(true)

    await wrapper.find('.enrich-patches-preview__actions button').trigger('click')
    await flushPromises()

    const sent = enrichApply.mock.calls[0][1] as any[]
    expect(sent.map(p => p.card_data.title)).toEqual(['Нова', 'Стара 2'])
  })

  it('нова інструкція починається зі згорнутого блоку', async () => {
    // Друга інструкція можлива лише після застосування: поки список
    // патчів висить, форма схована (див. умову у шаблоні).
    enrichApply.mockResolvedValue({ sections_added: 1, page_numbers: [1] })
    const wrapper = mountPreview()
    await run(wrapper, [patch('Стара 1', true), patch('Нова')])
    await wrapper.find('.enrich-patches-preview__skipped-toggle').trigger('click')
    expect(visibleTitles(wrapper)).toHaveLength(2)

    await wrapper.find('.enrich-patches-preview__actions button').trigger('click')
    await flushPromises()

    await run(wrapper, [patch('Стара 3', true), patch('Нова 2')])
    expect(visibleTitles(wrapper)).toEqual(['Нова 2'])
  })
})
