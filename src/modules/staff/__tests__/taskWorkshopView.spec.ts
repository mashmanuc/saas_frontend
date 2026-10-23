/**
 * Staff: майстерня банку задач (власник 2026-10-23; ТЗ saas_docs/domains/learning_program/TZ_TASK_WORKSHOP_ADMIN_2026-10-23.md).
 * Стережемо: тема → список → задача «як побачить учень»; правка шле ЛИШЕ змінені поля з версією; «перевірено мною»
 * вимагає рівень і шле його з версією; клавіші 1–5 ставлять рівень, Enter — перевірено й наступна; автоперевірка
 * ловить зламане екранування формул («зі \\(180\\)»).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

vi.mock('@/modules/staff/api/taskWorkshopApi', () => ({
  READY_PER_LEVEL: 10,
  getWorkshopTopics: vi.fn(),
  listWorkshopTasks: vi.fn(),
  getWorkshopTask: vi.fn(),
  updateWorkshopTask: vi.fn(),
  verifyWorkshopTask: vi.fn(),
  rejectWorkshopTask: vi.fn(),
  unrejectWorkshopTask: vi.fn(),
  revertWorkshopEdit: vi.fn(),
}))

import * as api from '@/modules/staff/api/taskWorkshopApi'
import StaffTaskWorkshopView from '../views/StaffTaskWorkshopView.vue'

const TASK = {
  id: 7, external_id: 'gen3-x-1', problem_type: 'single_choice', text: 'Катети $3$ і $4$. Знайдіть гіпотенузу.',
  content: { choices: [{ label: 'А', text: '$5$', is_correct: true }, { label: 'Б', text: '$7$', is_correct: false }] },
  solution: '$\\sqrt{25}=5$', raw_topics: ['right-triangles'], topic: 'right-triangles', tags: [], source: 'generator:v3',
  difficulty: 2, computed_difficulty: 2, resources: [], revision: 'rev-1', verification: null, rejection: null,
  edited: false, edits: [], duplicates: 0, foreign: false,
}

function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  return mount(StaffTaskWorkshopView, { global: { plugins: [i18n] }, attachTo: document.body })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getWorkshopTopics).mockResolvedValue({ topics: [
    { id: 'right-triangles', label: 'Прямокутні трикутники', parent: null, total: 12, verified: 3,
      levels: [1, 1, 1, 0, 0], ready: false },
    { id: 'right-triangles.pythagoras', label: 'Теорема Піфагора', parent: 'right-triangles', total: 5, verified: 1,
      levels: [0, 1, 0, 0, 0], ready: false },
  ] })
  vi.mocked(api.listWorkshopTasks).mockResolvedValue({ items: [
    { id: 7, external_id: 'gen3-x-1', problem_type: 'single_choice', text: TASK.text, topic: 'right-triangles',
      level: null, verified: false, stale: false, rejected: false, edited: false, foreign: false },
    { id: 8, external_id: 'gen3-x-2', problem_type: 'single_choice', text: 'Друга', topic: 'right-triangles',
      level: null, verified: false, stale: false, rejected: false, edited: false, foreign: false },
  ], total: 2, page: 1, page_size: 30 })
  vi.mocked(api.getWorkshopTask).mockImplementation(async (id: number) => ({ ...TASK, id }))
  vi.mocked(api.updateWorkshopTask).mockImplementation(async (id, payload) => ({ ...TASK, id, ...(payload as object),
    revision: 'rev-2', edited: true }))
  vi.mocked(api.verifyWorkshopTask).mockImplementation(async (id, payload) => ({ ...TASK, id,
    verification: { level: payload.level, note: '', at: '2026-10-23T10:00:00Z', by: 'o@m4sh', stale: false, topics: [] } }))
})

describe('StaffTaskWorkshopView', () => {
  it('shows topics with counts, the task as the student sees it, and the answer', async () => {
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-testid="ws-topic-right-triangles"]').text()).toContain('3/12')
    expect(w.find('[data-testid="ws-preview"]').html()).toContain('katex')
    expect(w.find('[data-testid="ws-preview"] li.correct').text()).toContain('А')
    w.unmount()
  })

  it('saves only changed fields with the revision, then verifies with level and moves on', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('[data-testid="ws-edit-text"]').setValue('Катети $6$ і $8$. Знайдіть гіпотенузу.')
    await w.find('[data-testid="ws-save"]').trigger('click')
    await flushPromises()
    expect(api.updateWorkshopTask).toHaveBeenCalledWith(7, { expected_revision: 'rev-1', reason: '',
      text: 'Катети $6$ і $8$. Знайдіть гіпотенузу.' })

    // Без рівня — ні кнопкою (неактивна, причина під нею), ні клавішею Enter.
    expect(w.find('[data-testid="ws-verify"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="ws-level-required"]').text()).toContain('рівень')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(api.verifyWorkshopTask).not.toHaveBeenCalled()
    expect(w.find('[data-testid="ws-message"]').text()).toContain('рівень')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))
    await flushPromises()
    expect(w.find('[data-testid="ws-verify"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-testid="ws-level-required"]').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(api.verifyWorkshopTask).toHaveBeenCalledWith(7, { level: 3, note: '', expected_revision: 'rev-2' })
    expect(api.getWorkshopTask).toHaveBeenLastCalledWith(8)                  // наступна задача
    w.unmount()
  })

  it('counts a first check in the topic tree at once, a repeated check does not count twice', async () => {
    const w = mountView()
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(w.find('[data-testid="ws-topic-right-triangles"]').text()).toContain('4/12')

    vi.mocked(api.getWorkshopTask).mockImplementation(async (id: number) => ({ ...TASK, id,
      verification: { level: 2, note: '', at: '2026-10-23T10:00:00Z', by: 'o@m4sh', stale: false, topics: [] } }))
    await w.find('[data-testid="ws-prev"]').trigger('click')                 // уже перевірена — перевіряємо вдруге
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(api.verifyWorkshopTask).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="ws-topic-right-triangles"]').text()).toContain('4/12')
    expect(api.getWorkshopTopics).toHaveBeenCalledTimes(1)                   // без перерахунку всієї бази
    w.unmount()
  })

  it('shows how far the chosen topic is from ready, level by level, and moves a check between levels', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('[data-testid="ws-topic-right-triangles"]').trigger('click')
    await flushPromises()
    const box = w.find('[data-testid="ws-readiness"]')
    expect(box.text()).toContain('Ще не готова')
    expect(box.text()).toContain('Рівень 1: 1/10')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(w.find('[data-testid="ws-readiness"]').text()).toContain('Рівень 4: 1/10')

    vi.mocked(api.getWorkshopTopics).mockResolvedValue({ topics: [
      { id: 'right-triangles', label: 'Прямокутні трикутники', parent: null, total: 60, verified: 50,
        levels: [10, 10, 10, 10, 10], ready: true },
    ] })
    await w.find('[data-testid="ws-source-ours"]').trigger('click')       // перечитати дерево
    await flushPromises()
    expect(w.find('[data-testid="ws-readiness"]').text()).toContain('Тема готова')
    expect(w.find('[data-testid="ws-topic-right-triangles"] .ws-ready-mark').exists()).toBe(true)
    w.unmount()
  })

  it('a foreign task is view-only: no editor and no check, but it can be rejected', async () => {
    vi.mocked(api.getWorkshopTask).mockImplementation(async (id: number) => ({ ...TASK, id, foreign: true,
      source: 'mongo:geometria_8k' }))
    const w = mountView()
    await flushPromises()
    await w.find('[data-testid="ws-source-foreign"]').trigger('click')
    await flushPromises()
    expect(api.getWorkshopTopics).toHaveBeenLastCalledWith('foreign')
    expect(api.listWorkshopTasks).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'foreign' }))
    expect(w.find('[data-testid="ws-foreign"]').exists()).toBe(true)
    expect(w.find('[data-testid="ws-edit-text"]').exists()).toBe(false)
    expect(w.find('[data-testid="ws-verify"]').exists()).toBe(false)
    expect(w.find('[data-testid="ws-reject"]').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(api.verifyWorkshopTask).not.toHaveBeenCalled()
    w.unmount()
  })

  it('flags broken formula escaping as an automatic check', async () => {
    vi.mocked(api.getWorkshopTask).mockResolvedValue({ ...TASK, text: 'Ціна зменшилась зі \\\\(180\\\\) грн.' })
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-testid="ws-checks"] li').classes()).toContain('bad')
    w.unmount()
  })
})
