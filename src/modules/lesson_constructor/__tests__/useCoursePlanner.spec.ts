import { beforeEach, describe, expect, it, vi } from 'vitest'

import useCoursePlanner from '../composables/useCoursePlanner'

vi.mock('../api/courseApi', () => ({
  default: {
    plan: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    detail: vi.fn(),
    materialize: vi.fn(),
    publish: vi.fn(),
  },
}))

import courseApi from '../api/courseApi'

const PLAN = {
  v: 1,
  evidence_version: '1',
  warnings: ['тему «Похідна» пропущено: 0 задач'],
  density: { 'real-numbers.fractions': { n_bank: 120, by_difficulty: {} } },
  lessons: [1, 2, 3].map((n) => ({
    order: n,
    topic_id: 'real-numbers.fractions',
    title: `Урок ${n}`,
    lesson_type: 'practice' as const,
    objective: '',
    prerequisites: [],
    prereq_kind: 'ordering',
    checkpoint: false,
    tasks: 6,
    density: 120,
    spec: {},
  })),
}

describe('useCoursePlanner', () => {
  beforeEach(() => {
    vi.mocked(courseApi.plan).mockReset().mockResolvedValue({
      plan: PLAN, warnings: PLAN.warnings, density: PLAN.density,
    } as never)
    vi.mocked(courseApi.create).mockReset().mockResolvedValue({ id: 42 } as never)
    vi.mocked(courseApi.materialize).mockReset().mockResolvedValue({
      course_id: 42, created: [], skipped: [], failed: [], total_requested: 0,
    } as never)
  })

  it('«Побудувати план» НЕ створює курс', async () => {
    // Головний інваріант пакета: прев'ю можна кликати скільки завгодно —
    // BE `plan/` нічого не пише, і UI не має цього ламати.
    const p = useCoursePlanner()
    await p.buildPlan()
    expect(courseApi.plan).toHaveBeenCalledTimes(1)
    expect(courseApi.create).not.toHaveBeenCalled()
    expect(courseApi.materialize).not.toHaveBeenCalled()
  })

  it('повторне прев\'ю теж нічого не створює', async () => {
    const p = useCoursePlanner()
    await p.buildPlan()
    await p.buildPlan()
    await p.buildPlan()
    expect(courseApi.create).not.toHaveBeenCalled()
  })

  it('після побудови всі уроки вибрані', async () => {
    const p = useCoursePlanner()
    await p.buildPlan()
    expect(p.selectedCount.value).toBe(3)
    expect(p.warnings.value).toHaveLength(1)
  })

  it('шле лише ВИБРАНІ orders', async () => {
    const p = useCoursePlanner()
    await p.buildPlan()
    p.toggleLesson(2, false)
    await p.saveAndMaterialize()
    expect(courseApi.materialize).toHaveBeenCalledWith(42, [1, 3])
  })

  it('orders відсортовані за зростанням', async () => {
    const p = useCoursePlanner()
    await p.buildPlan()
    p.setAllSelected(false)
    p.toggleLesson(3, true)
    p.toggleLesson(1, true)
    await p.saveAndMaterialize()
    expect(courseApi.materialize).toHaveBeenCalledWith(42, [1, 3])
  })

  it('«Зберегти курс» не матеріалізує', async () => {
    const p = useCoursePlanner()
    await p.buildPlan()
    await p.saveCourse()
    expect(courseApi.create).toHaveBeenCalledTimes(1)
    expect(courseApi.materialize).not.toHaveBeenCalled()
  })

  it('404 з BE перетворюється на notFound, не на «немає прав»', async () => {
    vi.mocked(courseApi.plan).mockRejectedValueOnce({ response: { status: 404 } })
    const p = useCoursePlanner()
    await p.buildPlan()
    expect(p.error.value).toBe('notFound')
  })

  it('збій прев\'ю не лишає старий план', async () => {
    const p = useCoursePlanner()
    await p.buildPlan()
    vi.mocked(courseApi.plan).mockRejectedValueOnce(new Error('boom'))
    await p.buildPlan()
    expect(p.plan.value).toBeNull()
    expect(p.hasPlan.value).toBe(false)
  })

  it('topics_scope зберігає порядок, який задав тьютор', async () => {
    // Вхід tie-break §3.3.2: якби порядок губився, ми б відновили на UI
    // рівно той баг, який виправляли на BE.
    const p = useCoursePlanner()
    p.spec.value.topics_scope = ['real-numbers.divisibility', 'real-numbers.fractions']
    await p.buildPlan()
    expect(vi.mocked(courseApi.plan).mock.calls[0][0].topics_scope)
      .toEqual(['real-numbers.divisibility', 'real-numbers.fractions'])
  })
})
