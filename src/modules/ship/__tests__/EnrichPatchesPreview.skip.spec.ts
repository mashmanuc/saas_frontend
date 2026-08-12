/**
 * B-T2: тьютор бачить, що AI СВІДОМО пропустив.
 *
 * Пропуск — цінний сигнал методиста, а не тиша: якщо модель подумала над
 * задачею й вирішила не додавати картку, тьютор має це побачити. Тести
 * фіксують саме видимість, бо зламати її можна непомітно — блок просто
 * перестане рендеритись, і все виглядатиме як «пропусків не було».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

const enrich = vi.fn()

vi.mock('../shipApi', () => ({
  shipApi: {
    enrich: (...args: unknown[]) => enrich(...args),
    enrichApply: vi.fn(),
  },
}))

// Enrich пише на дошку серверним шляхом; у цьому тесті полотно не задіяне.
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

const PATCH = {
  task_ref: 'nmt-sc-1', action: 'add_card',
  card_data: { title: 'Опора', body: 'текст', badge: 'Теорія' },
  latex_valid: true, latex_error: '',
}

async function run(wrapper: ReturnType<typeof mountPreview>, response: Record<string, unknown>) {
  enrich.mockResolvedValue(response)
  await wrapper.find('textarea').setValue('додай опори')
  await wrapper.findAll('button').find(b => b.text().includes('Проаналізувати'))?.trigger('click')
    ?? await wrapper.findAll('button')[1].trigger('click')
  await flushPromises()
}

describe('B-T2 — блок свідомих пропусків', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    enrich.mockReset()
  })

  it('показує, скільки задач модель пропустила', async () => {
    const wrapper = mountPreview()
    await run(wrapper, {
      patches: [PATCH], error: null, processed_tasks: 2, total_tasks: 2,
      failed_task_refs: [],
      skipped: [{ task_ref: 'nmt-sc-9', reason: 'тривіальне обчислення' }],
    })

    const toggle = wrapper.find('.enrich-patches-preview__skipped-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toContain('1')
  })

  it('причина прихована до розгортання і читається після нього', async () => {
    const wrapper = mountPreview()
    await run(wrapper, {
      patches: [], error: null, processed_tasks: 1, total_tasks: 1,
      failed_task_refs: [],
      // 2026-08-12: підпис задачі — це УМОВА, а не ID банку. «Задача: 10719»
      // тьютору нічого не казало (живий тест власника), тож BE тепер шле
      // `task_title`, а ID у прев'ю не потрапляє взагалі.
      skipped: [{
        task_ref: 'nmt-sc-9',
        task_title: 'Обчисліть суму кутів опуклого десятикутника',
        reason: 'тривіальне обчислення',
      }],
    })

    expect(wrapper.text()).not.toContain('тривіальне обчислення')
    await wrapper.find('.enrich-patches-preview__skipped-toggle').trigger('click')
    expect(wrapper.text()).toContain('тривіальне обчислення')
    expect(wrapper.text()).toContain('суму кутів опуклого десятикутника')
    // ID банку тьютор бачити не мусить
    expect(wrapper.text()).not.toContain('nmt-sc-9')
  })

  it('лічильники показують і запропоноване, і пропущене', async () => {
    const wrapper = mountPreview()
    await run(wrapper, {
      patches: [PATCH, PATCH], error: null, processed_tasks: 3, total_tasks: 3,
      failed_task_refs: [],
      skipped: [{ task_ref: 'a', reason: 'r' }],
    })

    const tally = wrapper.find('.enrich-patches-preview__tally')
    expect(tally.exists()).toBe(true)
    expect(tally.text()).toContain('2')
    expect(tally.text()).toContain('1')
  })

  it('без пропусків блоку немає — порожній список не займає місця', async () => {
    const wrapper = mountPreview()
    await run(wrapper, {
      patches: [PATCH], error: null, processed_tasks: 1, total_tasks: 1,
      failed_task_refs: [], skipped: [],
    })

    expect(wrapper.find('.enrich-patches-preview__skipped').exists()).toBe(false)
  })

  it('BE без поля `skipped` не ламає прев\'ю', async () => {
    const wrapper = mountPreview()
    await run(wrapper, {
      patches: [PATCH], error: null, processed_tasks: 1, total_tasks: 1,
      failed_task_refs: [],
    })

    expect(wrapper.find('.enrich-patches-preview__skipped').exists()).toBe(false)
    expect(wrapper.find('.enrich-patches-preview__list').exists()).toBe(true)
  })

  it('друга інструкція починається з чистого списку пропусків', async () => {
    const wrapper = mountPreview()
    await run(wrapper, {
      patches: [], error: null, processed_tasks: 1, total_tasks: 1,
      failed_task_refs: [], skipped: [{ task_ref: 'x', reason: 'причина' }],
    })
    await wrapper.find('.enrich-patches-preview__skipped-toggle').trigger('click')
    expect(wrapper.text()).toContain('причина')

    await run(wrapper, {
      patches: [PATCH], error: null, processed_tasks: 1, total_tasks: 1,
      failed_task_refs: [], skipped: [],
    })
    expect(wrapper.find('.enrich-patches-preview__skipped').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('причина')
  })
})

/**
 * Живий прогін 2026-08-10: текст у полі є, а «Запустити» сіра.
 * Причина — голосове введення / розширення пишуть у DOM напряму, без
 * події `input`, тож `v-model` лишається порожнім. Кнопка більше не
 * залежить від v-model, а значення читається з елемента при кліку.
 */
describe('EnrichPatchesPreview — введення повз v-model', () => {
  beforeEach(() => {
    enrich.mockReset()
    setActivePinia(createPinia())
  })

  it('кнопка НЕ заблокована при порожньому v-model', () => {
    const wrapper = mountPreview()
    const btn = wrapper.find('.enrich-patches-preview__input button')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('запускає з текстом, вставленим у DOM без події input', async () => {
    enrich.mockResolvedValue({
      patches: [], error: null, processed_tasks: 1, total_tasks: 1,
      failed_task_refs: [], skipped: [],
    })
    const wrapper = mountPreview()
    const ta = wrapper.find('textarea').element as HTMLTextAreaElement
    // Дзеркало поведінки розширення: пишемо значення, події НЕ шлемо.
    ta.value = 'Додай приклад із життя'

    await wrapper.find('.enrich-patches-preview__input button').trigger('click')
    await flushPromises()

    expect(enrich).toHaveBeenCalledWith('a1', 'Додай приклад із життя')
  })

  it('порожнє поле → чесне повідомлення, не мовчазна відмова', async () => {
    const wrapper = mountPreview()
    await wrapper.find('.enrich-patches-preview__input button').trigger('click')
    await flushPromises()

    expect(enrich).not.toHaveBeenCalled()
    expect(wrapper.find('.enrich-patches-preview__error').text()).toContain('інструкцію')
  })
})
