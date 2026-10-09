// «Згенерувати урок історії» (2026-10-09): вікно — вибір теми, кроки, результат.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HistoryGenerateModal from '../components/HistoryGenerateModal.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, p?: Record<string, unknown>) => (p ? `${key}:${JSON.stringify(p)}` : key) }),
}))

vi.mock('../api/historyGeneratorApi', () => ({
  startHistoryGeneration: vi.fn(),
  fetchHistoryJob: vi.fn(),
  httpStatusOf: (e: { response?: { status?: number } }) => e?.response?.status ?? null,
  FINAL_STATUSES: ['ready', 'refused', 'failed'],
}))

import { fetchHistoryJob, startHistoryGeneration } from '../api/historyGeneratorApi'

const PROGRAM = {
  grades: [
    { grade: 7, sections: [{ id: 's7', title: 'Розділ 7', items: [{ id: 'i7', text: 'Заснування міста Київ' }] }] },
    { grade: 8, sections: [{ id: 's8', title: 'Розділ 8', items: [{ id: 'i8', text: 'Берестецька битва' }] }] },
  ],
}

function mountModal() {
  return mount(HistoryGenerateModal, {
    props: { program: PROGRAM },
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
}

describe('HistoryGenerateModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('пункт програми береться з обраного класу й розділу', async () => {
    const w = mountModal()
    await w.find('select').setValue('8')
    await flushPromises()
    expect((w.findAll('select')[2].element as HTMLSelectElement).value).toBe('i8')
  })

  it('опитує стан до «готово», показує кроки й віддає урок наверх', async () => {
    vi.mocked(startHistoryGeneration).mockResolvedValue({ job_id: 'j1' })
    vi.mocked(fetchHistoryJob)
      .mockResolvedValueOnce({ id: 'j1', status: 'writing', content_id: 'i7', topic: '' })
      .mockResolvedValueOnce({ id: 'j1', status: 'ready', content_id: 'i7', topic: '', lesson_id: 'L1',
        title: 'Заснування Києва — сценарій уроку', scenes: 5, articles: ['Київ'] })
    const w = mountModal()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(startHistoryGeneration).toHaveBeenCalledWith('i7', '')
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.text()).toContain('knowledge.historyGen.steps.writing')
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.text()).toContain('Заснування Києва — сценарій уроку')
    expect(w.emitted('created')?.[0]).toEqual(['L1'])
    await w.findAll('button').find((b) => b.text() === 'knowledge.historyGen.conduct')!.trigger('click')
    expect(w.emitted('conduct')?.[0]).toEqual(['L1'])
  })

  it('чесна відмова — з причиною, без уроку', async () => {
    vi.mocked(startHistoryGeneration).mockResolvedValue({ job_id: 'j2' })
    vi.mocked(fetchHistoryJob).mockResolvedValue({ id: 'j2', status: 'refused', content_id: 'i7', topic: '',
      reason: 'у Вікіпедії не знайшлося статей на цю тему' })
    const w = mountModal()
    await w.find('form').trigger('submit')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.text()).toContain('knowledge.historyGen.refused')
    expect(w.text()).toContain('у Вікіпедії не знайшлося статей на цю тему')
    expect(w.emitted('created')).toBeUndefined()
  })

  it('409 — «попередній урок ще генерується», вікно лишається на виборі теми', async () => {
    vi.mocked(startHistoryGeneration).mockRejectedValue({ response: { status: 409 } })
    const w = mountModal()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('knowledge.historyGen.busy')
    expect(w.find('form').exists()).toBe(true)
    expect(fetchHistoryJob).not.toHaveBeenCalled()
  })
})
