/**
 * «Повторити необроблені» — дозбір лише впалих задач.
 *
 * BE при частковому збої пакета віддає `failed_task_refs` (і патчі з пакетів,
 * що спрацювали). Раніше FE їх не читав — тьютор бачив «Оброблено 12/24» і не
 * мав що натиснути, крім «увесь урок наново». Тепер у блоці помилки є кнопка,
 * яка кличе enrich(task_ids=failed_task_refs): наявні патчі лишаються, нові
 * докидаються, галочки перераховуються лише для доданих.
 *
 * Найкрихкіше — ЗЛИТТЯ: другий виклик не має затерти перший (це та сама
 * пастка, що з error+patches: «є помилка → викинули готове»).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

const enrich = vi.fn()
const enrichApply = vi.fn()
const enrichProgress = vi.fn()

vi.mock('../shipApi', () => ({
  shipApi: {
    enrich: (...args: unknown[]) => enrich(...args),
    enrichApply: (...args: unknown[]) => enrichApply(...args),
    enrichProgress: (...args: unknown[]) => enrichProgress(...args),
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

function patch(title: string) {
  return {
    task_ref: `nmt-${title}`, action: 'add_card',
    card_data: { title, body: 'текст', badge: 'Формула' },
    latex_valid: true, latex_error: '', already_on_board: false,
  }
}

const RETRY = '.enrich-patches-preview__retry'

async function firstRun(wrapper: ReturnType<typeof mountPreview>) {
  // 24 задачі, другий пакет впав: 12 патчів є, 12 рефів у failed_task_refs.
  enrich.mockResolvedValueOnce({
    patches: [patch('A1'), patch('A2')], error: 'Оброблено 12/24 задач. 12 не вдалося: 500',
    processed_tasks: 12, total_tasks: 24,
    failed_task_refs: ['t13', 't14'], skipped: [],
  })
  const ta = wrapper.find('textarea').element as HTMLTextAreaElement
  ta.value = 'додай формули'
  await wrapper.find('.enrich-patches-preview__run').trigger('click')
  await flushPromises()
}

function titles(wrapper: ReturnType<typeof mountPreview>): string[] {
  return wrapper.findAll('.enrich-patches-preview__preview strong').map(w => w.text())
}

describe('enrich — «Повторити необроблені»', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    enrich.mockReset()
    enrichApply.mockReset()
    enrichProgress.mockReset()
    enrichProgress.mockResolvedValue(null)
  })

  it('кнопка з\'являється лише при failed_task_refs і показує їх кількість', async () => {
    const wrapper = mountPreview()
    await firstRun(wrapper)
    const btn = wrapper.find(RETRY)
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('2')
  })

  it('без failed_task_refs кнопки немає, навіть якщо є текст помилки', async () => {
    const wrapper = mountPreview()
    enrich.mockResolvedValueOnce({
      patches: [], error: 'Урок не містить задач для аналізу.',
      processed_tasks: 0, total_tasks: 0, failed_task_refs: [], skipped: [],
    })
    const ta = wrapper.find('textarea').element as HTMLTextAreaElement
    ta.value = 'x'
    await wrapper.find('.enrich-patches-preview__run').trigger('click')
    await flushPromises()
    expect(wrapper.find(RETRY).exists()).toBe(false)
  })

  it('клік кличе enrich САМЕ з failed_task_refs і тією ж інструкцією', async () => {
    const wrapper = mountPreview()
    await firstRun(wrapper)
    enrich.mockResolvedValueOnce({
      patches: [patch('B1')], error: null, processed_tasks: 12, total_tasks: 24,
      failed_task_refs: [], skipped: [],
    })
    await wrapper.find(RETRY).trigger('click')
    await flushPromises()

    expect(enrich).toHaveBeenCalledTimes(2)
    const [aid, instruction, taskIds] = enrich.mock.calls[1]
    expect(aid).toBe('a1')
    expect(instruction).toBe('додай формули')
    expect(taskIds).toEqual(['t13', 't14'])
  })

  it('дозбір ДОКИДАЄ патчі, не затираючи перші; галочки нових увімкнені', async () => {
    const wrapper = mountPreview()
    await firstRun(wrapper)
    enrich.mockResolvedValueOnce({
      patches: [patch('B1'), patch('B2')], error: null, processed_tasks: 12, total_tasks: 24,
      failed_task_refs: [], skipped: [],
    })
    await wrapper.find(RETRY).trigger('click')
    await flushPromises()

    expect(titles(wrapper)).toEqual(['A1', 'A2', 'B1', 'B2'])
    const boxes = wrapper.findAll('.enrich-patches-preview__item input[type="checkbox"]')
    expect(boxes).toHaveLength(4)
    expect(boxes.every(b => (b.element as HTMLInputElement).checked)).toBe(true)
    // після вдалого дозбору кнопки й помилки більше нема
    expect(wrapper.find(RETRY).exists()).toBe(false)
    expect(wrapper.find('.enrich-patches-preview__error').exists()).toBe(false)
  })

  it('якщо і дозбір частково впав — кнопка лишається з новим лічильником', async () => {
    const wrapper = mountPreview()
    await firstRun(wrapper)
    enrich.mockResolvedValueOnce({
      patches: [patch('B1')], error: 'Оброблено 1/2 задач. 1 не вдалося: timeout',
      processed_tasks: 1, total_tasks: 2, failed_task_refs: ['t14'], skipped: [],
    })
    await wrapper.find(RETRY).trigger('click')
    await flushPromises()

    expect(titles(wrapper)).toEqual(['A1', 'A2', 'B1'])
    expect(wrapper.find(RETRY).text()).toContain('1')
  })

  it('звичайний запуск НІКОЛИ не стає дозбором — task_ids не передаються', async () => {
    // Пастка: `@click="runEnrich"` без дужок передав би Event першим аргументом.
    // Стережемо контракт: перший виклик без task_ids, четвертий аргумент — progress_id.
    const wrapper = mountPreview()
    await firstRun(wrapper)
    const [, , taskIds, progressId] = enrich.mock.calls[0]
    expect(taskIds).toBeUndefined()
    expect(typeof progressId).toBe('string')
  })

  it('застосування після дозбору шле і старі, і нові вибрані патчі', async () => {
    enrichApply.mockResolvedValue({ sections_added: 3, page_numbers: [1] })
    const wrapper = mountPreview()
    await firstRun(wrapper)
    enrich.mockResolvedValueOnce({
      patches: [patch('B1')], error: null, processed_tasks: 12, total_tasks: 24,
      failed_task_refs: [], skipped: [],
    })
    await wrapper.find(RETRY).trigger('click')
    await flushPromises()

    await wrapper.find('.enrich-patches-preview__actions button').trigger('click')
    await flushPromises()
    const sent = enrichApply.mock.calls[0][1] as any[]
    expect(sent.map(p => p.card_data.title)).toEqual(['A1', 'A2', 'B1'])
  })
})
