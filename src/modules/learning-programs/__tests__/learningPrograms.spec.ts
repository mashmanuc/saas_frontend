// Програми навчання: запит підсумку за контрактом, «Ще раз», вхід до модуля лише з відповіді сервера,
// безпечний показ без повного DTO, кнопка на дошці лише з учнем уроку.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/utils/apiClient', () => ({ default: { get: (...a: any[]) => get(...a), post: (...a: any[]) => post(...a) } }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), resolve: () => ({ href: '/tutor/programs/x' }) }),
  useRoute: () => ({ params: { id: 'p1' } }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 5, role: 'tutor' } }) }))

import { bodies, learningProgramsApi, materialRoute, type ProgramDetail, type ProgramLesson } from '../api/learningProgramsApi'
import LessonOutcomeActions from '../components/LessonOutcomeActions.vue'
import LearnerProgramPanel from '../components/LearnerProgramPanel.vue'
import PrepareLessonDialog from '../components/PrepareLessonDialog.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', messages: { uk } })

const PROGRAM = {
  id: 'p1', route_revision: 4, title: 'НМТ', status: 'active',
  target: { kind: 'learner', group_ref: null, participants: [
    { participant_id: 'part-1', learner: { id: 7, display_name: 'Аня', has_account: false }, joined_at: '', left_at: null },
  ] },
} as unknown as ProgramDetail
const LESSON = {
  lesson_id: 'l1', title: 'Лінійні рівняння', role: 'TOPIC', unit_refs: ['linear-quadratic-rational-equations.linear'],
  credit_state: 'open', material: {
    state: 'prepared', request_id: 'r1', material_ref: { provider: 'winterboard.board', id: 'b1' },
    open: { provider: 'winterboard.prepare', id: 'b1' }, prepared_at: '', test_adapter: false,
  },
} as unknown as ProgramLesson

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('тіло підсумку', () => {
  it('«далі» зараховує рівно це заняття й особисто учневі; ревізія з програми', async () => {
    post.mockResolvedValue({ route_revision: 5 })
    await learningProgramsApi.sendOutcome('p1', 'l1',
      bodies.outcome(PROGRAM, 'l1', { attendance: 'held', action: 'next' }, crypto.randomUUID()))
    const body = post.mock.calls[0][1]
    expect(post.mock.calls[0][0]).toBe('/v1/learning-programs/p1/lessons/l1/outcome/')
    expect(body).toMatchObject({
      expected_revision: 4, attendance: 'held', pedagogical_action: 'next', credited_lesson_ids: ['l1'],
      participant_outcomes: [{ participant_id: 'part-1', personal_action: 'next', personal_credited_lesson_ids: ['l1'] }],
      calendar_ref: null, kind: 'outcome', corrects_event_id: null,
    })
    expect(body.event_id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('«ще раз» нічого не зараховує; «не відбувся» — без дії й без матеріалів', async () => {
    const repeat = bodies.outcome(PROGRAM, 'l1', { attendance: 'held', action: 'repeat' }, 'e1')
    const notHeld = bodies.outcome(PROGRAM, 'l1', {
      attendance: 'not_held', action: 'next',
      materials: [{ material_ref: { provider: 'winterboard.board', id: 'b1' }, usage: 'whole', content_refs_used: [] }],
    }, 'e2')
    expect(repeat).toMatchObject({ event_id: 'e1', pedagogical_action: 'repeat', credited_lesson_ids: [] })
    expect(notHeld).toMatchObject({
      attendance: 'not_held', pedagogical_action: 'none', credited_lesson_ids: [], materials_used: [],
    })
  })

  it('пропозиція йде з ключем наміру в заголовку', async () => {
    post.mockResolvedValue({})
    await learningProgramsApi.sendProposal('p1', bodies.addReview(PROGRAM, 'l1', ['t']), 'k-1')
    expect(post.mock.calls[0][0]).toBe('/v1/learning-programs/p1/proposals/')
    expect(post.mock.calls[0][2].headers['Idempotency-Key']).toBe('k-1')
    expect(post.mock.calls[0][1]).toEqual({
      kind: 'add_review', expected_revision: 4,
      payload: { after_lesson_id: 'l1', lessons: 1, review_unit_refs: ['t'] },
    })
  })
})

describe('materialRoute', () => {
  it('урок генератора відкривається в Студії; невідомий постачальник — без кнопки', () => {
    expect(materialRoute({ provider: 'winterboard.prepare', id: 'b1' })).toEqual({ name: 'winterboard-prepare', params: { id: 'b1' } })
    expect(materialRoute({ provider: 'knowledge.lesson', id: 'k1' })).toBeNull()
    expect(materialRoute(null)).toBeNull()
  })
})

describe('useProgramsAvailability', () => {
  it('вхід лише після 200 сервера; 404 — модуля немає; не вчитель — без запиту', async () => {
    vi.resetModules()
    const { useProgramsAvailability } = await import('../composables/useProgramsAvailability')
    const a = useProgramsAvailability()
    expect(await a.ensure(1, 'student')).toBe(false)
    expect(get).not.toHaveBeenCalled()
    get.mockRejectedValueOnce({ response: { status: 404 } })
    expect(await a.ensure(2, 'tutor')).toBe(false)
    expect(await a.ensure(2, 'tutor')).toBe(false)          // вдруге не питаємо
    expect(get).toHaveBeenCalledTimes(1)
    get.mockResolvedValueOnce({ count: 0, results: [] })
    expect(await a.ensure(3, 'tutor')).toBe(true)
  })
})

describe('LessonOutcomeActions', () => {
  it('без явного підтвердження «усі» не оголошує підготовлені задачі розв’язаними', async () => {
    post.mockResolvedValue({ route_revision: 5 })
    const w = mount(LessonOutcomeActions, { props: { program: PROGRAM, lesson: LESSON }, global: { plugins: [i18n()] } })
    await w.get('[data-testid=lp-held-next]').trigger('click')
    await flushPromises()
    expect(post.mock.calls[0][1].materials_used[0].usage).toBe('unknown')
    w.unmount()
  })

  it('«Відбувся — ще раз» → пропозиція повторення → «Додати» шле add_review з темою заняття', async () => {
    post.mockResolvedValueOnce({ route_revision: 5 }).mockResolvedValueOnce({ route_revision: 6 })
    const w = mount(LessonOutcomeActions, { props: { program: PROGRAM, lesson: LESSON }, global: { plugins: [i18n()] } })
    await w.get('[data-testid=lp-usage-whole]').setValue(true)
    await w.get('[data-testid=lp-held-repeat]').trigger('click')
    await flushPromises()
    expect(post.mock.calls[0][1].materials_used).toEqual([
      { material_ref: { provider: 'winterboard.board', id: 'b1' }, usage: 'whole', content_refs_used: [] },
    ])
    await w.get('[data-testid=lp-add-review]').trigger('click')
    await flushPromises()
    expect(post.mock.calls[1][1]).toMatchObject({
      kind: 'add_review', expected_revision: 5,
      payload: { after_lesson_id: 'l1', review_unit_refs: ['linear-quadratic-rational-equations.linear'] },
    })
    expect(w.get('[data-testid=lp-outcome-saved]').text()).toContain('Повторення додано')
    expect(w.emitted('changed')).toHaveLength(2)
  })

  it('«не знаю» про задачі — використання невідоме, не «розв\'язано»', async () => {
    post.mockResolvedValue({ route_revision: 5 })
    const w = mount(LessonOutcomeActions, { props: { program: PROGRAM, lesson: LESSON }, global: { plugins: [i18n()] } })
    await w.get('[data-testid=lp-usage-unknown]').setValue(true)
    await w.get('[data-testid=lp-held-next]').trigger('click')
    await flushPromises()
    expect(post.mock.calls[0][1].materials_used[0].usage).toBe('unknown')
    expect(w.find('[data-testid=lp-offer-review]').exists()).toBe(false)
  })
})

describe('LearnerProgramPanel', () => {
  it('читає ЛИШЕ безпечну адресу learner-view', async () => {
    get.mockResolvedValue({
      id: 'p1', title: 'НМТ', goal_label_key: null, current_topic: 'Рівняння',
      plan: [{ title: 'Числа', state: 'done' }, { title: 'Рівняння', state: 'now' }],
      progress: { done_lessons: 3, planned_lessons: 12 }, next_steps: [{ title: 'Лінійні рівняння' }], materials: [],
    })
    const w = mount(LearnerProgramPanel, { props: { programId: 'p1' }, global: { plugins: [i18n()] } })
    await flushPromises()
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/v1/learning-programs/p1/learner-view/'])
    expect(w.text()).toContain('Пройдено 3 з 12')
  })
})


const deferred = () => {
  let resolve!: (value: unknown) => void
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}
const view = (title: string) => ({ id: title, title, current_topic: null, plan: [],
  progress: { done_lessons: 0, planned_lessons: 1 }, next_steps: [], materials: [] })

describe('мережеві регресії (review Лови F3/F4)', () => {
  it('пізня відповідь попередньої програми не підміняє поточний безпечний показ', async () => {
    const a = deferred(), b = deferred()
    get.mockImplementation((url: string) => (url.includes('/a/') ? a.promise : b.promise))
    const w = mount(LearnerProgramPanel, { props: { programId: 'a' }, global: { plugins: [i18n()] } })
    await w.setProps({ programId: 'b' })
    b.resolve(view('Програма другого учня'))
    await flushPromises()
    a.resolve(view('Програма першого учня'))
    await flushPromises()
    expect(w.text()).toContain('Програма другого учня')
    expect(w.text()).not.toContain('Програма першого учня')
  })

  it('повтор після втраченої відповіді — той самий request_id; нові параметри — новий намір', async () => {
    vi.useFakeTimers()
    const caps = { status: 'available', level: { codes: ['balanced', 'hard'], default: 'balanced' },
      volume: { min: 1, max: 30, default: 10 } }
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/capabilities/') ? caps : {
      status: 'prepared', material_ref: { provider: 'winterboard.board', id: 'board-1' }, shortage: [],
    }))
    let writes = 0
    post.mockImplementation((url: string, body: any) => {
      if (url.endsWith('/preview/')) return Promise.resolve({ can_prepare: true,
        context: { unit_refs: [], role: 'PRACTICE', route_revision: 1 }, warnings: [], shortage: [] })
      writes++
      return writes === 1 ? Promise.reject(new Error('відповідь загубилася'))
        : Promise.resolve({ request_id: body.request_id, status: 'prepared' })
    })
    const w = mount(PrepareLessonDialog, {
      props: { open: true, program: { id: 'p', route_revision: 1 } as any, lesson: { lesson_id: 'l', title: 'Урок' } as any },
      global: { plugins: [i18n()], stubs: { Modal: { template: '<div><slot/><slot name="footer"/></div>' } } },
    })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    await w.get('[data-testid=lp-prepare-go]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Відповідь не дійшла')
    await w.get('[data-testid=lp-prepare-go]').trigger('click')
    await flushPromises()
    const sent = post.mock.calls.filter(([url]) => String(url).endsWith('/preparations/'))
    expect(sent).toHaveLength(2)
    expect(sent[1][1]).toEqual(sent[0][1])                       // той самий намір — те саме тіло й request_id
    vi.useRealTimers()
  })
})

const CAPS = { status: 'available', level: { codes: ['balanced'], default: 'balanced' }, volume: { min: 1, max: 30, default: 10 } }
const previewOf = (unit: string) => ({ can_prepare: true, context: { unit_refs: [unit], role: 'PRACTICE', route_revision: 1 },
  warnings: [], shortage: [] })
const mountPrepare = (lessonId: string) => mount(PrepareLessonDialog, {
  props: { open: true, program: { id: 'p', route_revision: 1 } as any, lesson: { lesson_id: lessonId, title: lessonId } as any },
  global: { plugins: [i18n()], stubs: { Modal: { template: '<div><slot/><slot name="footer"/></div>' } } },
})
const settle = async () => { await flushPromises(); await vi.advanceTimersByTimeAsync(300); await flushPromises() }
const writes = () => post.mock.calls.filter(([url]) => String(url).endsWith('/preparations/'))

describe('підготовка: команда й її результат окремо (review Лови F3b/F4b)', () => {
  it('оновлення тієї самої програми після підготовки не прибирає «Відкрити урок»', async () => {
    vi.useFakeTimers()
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/capabilities/') ? CAPS
      : { status: 'prepared', material_ref: { provider: 'winterboard.board', id: 'board-1' }, shortage: [] }))
    post.mockImplementation((url: string, body: any) => Promise.resolve(url.endsWith('/preview/')
      ? previewOf('t') : { request_id: body.request_id, status: 'prepared' }))
    const w = mountPrepare('l')
    await settle()
    await w.get('[data-testid=lp-prepare-go]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid=lp-open-prepared]').exists()).toBe(true)
    // Батьківський екран перечитав DTO після події prepared: той самий id, новий об'єкт.
    await w.setProps({ program: { id: 'p', route_revision: 2 } as any }); await settle()
    expect(w.find('[data-testid=lp-open-prepared]').exists()).toBe(true)
    expect(writes()).toHaveLength(1)
    w.unmount()
    vi.useRealTimers()
  })

  it('прийнята підготовка + збій читання стану → повтор тим самим request_id, урок той самий', async () => {
    vi.useFakeTimers()
    let reads = 0
    get.mockImplementation((url: string) => {
      if (url.endsWith('/capabilities/')) return Promise.resolve(CAPS)
      reads++
      return reads === 1 ? Promise.reject({ response: { status: 503, data: { error: 'unavailable' } } })
        : Promise.resolve({ status: 'prepared', material_ref: { provider: 'winterboard.board', id: 'board-1' }, shortage: [] })
    })
    post.mockImplementation((url: string, body: any) => Promise.resolve(url.endsWith('/preview/')
      ? previewOf('t') : { request_id: body.request_id, status: 'prepared' }))
    const w = mountPrepare('l')
    await settle()
    await w.get('[data-testid=lp-prepare-go]').trigger('click'); await flushPromises()
    expect(w.text()).toContain('Запит прийнято, але результат не дійшов')
    await w.get('[data-testid=lp-prepare-go]').trigger('click'); await flushPromises()
    expect(writes()).toHaveLength(2)
    expect(writes()[1][1]).toEqual(writes()[0][1])
    expect(w.find('[data-testid=lp-open-prepared]').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('«ще готується» — не дозвіл на новий урок: наступне натискання з тим самим request_id', async () => {
    vi.useFakeTimers()
    let reads = 0
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/capabilities/') ? CAPS
      : ++reads === 1 ? { status: 'requested', material_ref: null, shortage: [] }
        : { status: 'prepared', material_ref: { provider: 'winterboard.board', id: 'board-1' }, shortage: [] }))
    post.mockImplementation((url: string, body: any) => Promise.resolve(url.endsWith('/preview/')
      ? previewOf('t') : { request_id: body.request_id, status: 'requested' }))
    const w = mountPrepare('l')
    await settle()
    await w.get('[data-testid=lp-prepare-go]').trigger('click'); await flushPromises()
    expect(w.text()).toContain('Урок ще готується')
    await w.get('[data-testid=lp-prepare-go]').trigger('click'); await flushPromises()
    expect(writes()[1][1].request_id).toBe(writes()[0][1].request_id)
    vi.useRealTimers()
  })

  it('закрили підготовку A й відкрили B: результат, перегляд і «зайнято» від A у вікні B не з\'являються', async () => {
    vi.useFakeTimers()
    const oldWrite = deferred(), oldPreview = deferred()
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/capabilities/') ? CAPS
      : { status: 'prepared', material_ref: { provider: 'winterboard.board', id: 'board-a' }, shortage: [] }))
    let previews = 0
    post.mockImplementation((url: string) => {
      if (!url.endsWith('/preview/')) return oldWrite.promise
      previews++
      return previews === 1 ? Promise.resolve(previewOf('a')) : previews === 2 ? oldPreview.promise : Promise.resolve(previewOf('b'))
    })
    const w = mountPrepare('A')
    await settle()
    await w.get('[data-testid=lp-prepare-go]').trigger('click'); await flushPromises()   // підготовка A висить
    await w.findAll('.pld__step')[1].trigger('click'); await settle()                     // і друга перевірка A
    await w.setProps({ open: false }); await flushPromises()
    await w.setProps({ open: true, lesson: { lesson_id: 'B', title: 'B' } as any }); await flushPromises()
    oldPreview.resolve({ can_prepare: false, context: { unit_refs: ['a'], role: 'PRACTICE', route_revision: 1 },
      warnings: [], shortage: [{ available: 1, requested: 11 }] })
    oldWrite.resolve({ request_id: 'x', status: 'prepared' })
    await flushPromises()
    expect(w.find('[data-testid=lp-preview-fail]').exists()).toBe(false)
    expect(w.find('[data-testid=lp-open-prepared]').exists()).toBe(false)
    await settle()
    expect(w.find('[data-testid=lp-preview-ok]').exists()).toBe(true)
    expect(w.find('[data-testid=lp-open-prepared]').exists()).toBe(false)
    expect(w.get('[data-testid=lp-prepare-go]').attributes('disabled')).toBeUndefined()
    expect(w.emitted('prepared')).toHaveLength(1)                 // програма оновлюється: урок A лишається своїм
    vi.useRealTimers()
  })
})

describe('createIntent', () => {
  it('завершення одного наміру не стирає ключ іншого; повернення до незавершеного — той самий ключ', async () => {
    const { createIntent } = await import('../intent')
    const box = createIntent<{ n: number }>()
    const a = box.take('A', () => ({ n: 1 }))
    const b = box.take('B', () => ({ n: 2 }))
    box.settle(b)
    expect(box.take('A', () => ({ n: 3 })).key).toBe(a.key)
    box.settle(a, new Error('мережа'))                            // без відповіді — лишається
    expect(box.take('A', () => ({ n: 4 })).key).toBe(a.key)
    box.settle(a, { response: { status: 409 } })
    expect(box.take('A', () => ({ n: 5 })).key).not.toBe(a.key)
  })
})
