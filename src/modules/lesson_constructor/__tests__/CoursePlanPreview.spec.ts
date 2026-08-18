import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import uk from '@/i18n/locales/uk.json'
import { type CoursePlan, type PlannedLesson } from '../api/courseApi'
import CoursePlanPreview from '../components/CoursePlanPreview.vue'
import MaterializeReport from '../components/MaterializeReport.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

const lesson = (n: number, over: Partial<PlannedLesson> = {}): PlannedLesson => ({
  order: n,
  topic_id: 'real-numbers.fractions',
  title: `Урок ${n}`,
  lesson_type: 'practice',
  objective: '',
  prerequisites: [],
  prereq_kind: 'ordering',
  checkpoint: false,
  tasks: 6,
  density: 100,
  spec: {},
  ...over,
})

const PLAN: CoursePlan = {
  v: 1, evidence_version: '1', warnings: [], density: {},
  lessons: [lesson(1), lesson(2, { checkpoint: true, lesson_type: 'control' }), lesson(3)],
}

function mountPreview(props = {}) {
  return mount(CoursePlanPreview, {
    props: {
      plan: PLAN,
      selectedOrders: new Set([1, 2, 3]),
      selectable: true,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

describe('CoursePlanPreview', () => {
  it('рендерить усі уроки плану', () => {
    const w = mountPreview()
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })

  it('warnings ВИДНО, і вони не сховані', () => {
    // Головна чесність планувальника: «тему пропущено — 0 задач».
    const w = mountPreview({ warnings: ['тему «Похідна» пропущено: 0 задач'] })
    const box = w.find('.course-plan-preview__warnings')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('Похідна')
  })

  it('без warnings блок не рендериться', () => {
    const w = mountPreview({ warnings: [] })
    expect(w.find('.course-plan-preview__warnings').exists()).toBe(false)
  })

  it('чекбокси є на кожному уроці й позначені', () => {
    const w = mountPreview()
    const boxes = w.findAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(3)
    expect((boxes[0].element as HTMLInputElement).checked).toBe(true)
  })

  it('зняття чекбокса емітить toggle з order', async () => {
    const w = mountPreview()
    await w.findAll('input[type="checkbox"]')[1].setValue(false)
    expect(w.emitted('toggle')?.[0]).toEqual([2, false])
  })

  it('checkpoint позначено', () => {
    const w = mountPreview()
    expect(w.text()).toContain('контрольна')
  })

  it('density згорнутий у details', () => {
    const w = mountPreview({ density: { 'real-numbers.fractions': { n_bank: 120 } } })
    const d = w.find('details')
    expect(d.exists()).toBe(true)
    expect(d.attributes('open')).toBeUndefined()
  })
})

describe('CourseLessonRow · prereq_kind', () => {
  it('ordering → підпис «йде після», НЕ «потребує»', () => {
    // C9: графи передумов немає, і UI не вдає, що є.
    const w = mountPreview({
      plan: { ...PLAN, lessons: [lesson(1, {
        prerequisites: ['real-numbers.divisibility'], prereq_kind: 'ordering',
      })] },
    })
    expect(w.text()).toContain('йде після')
    expect(w.text()).not.toContain('потребує')
  })

  it('невідомий prereq_kind → нічого не показуємо', () => {
    // Контракт, якого ми не бачили, не можна мовчки називати «йде після».
    const w = mountPreview({
      plan: { ...PLAN, lessons: [lesson(1, {
        prerequisites: ['real-numbers.divisibility'], prereq_kind: 'prerequisite',
      })] },
    })
    expect(w.text()).not.toContain('йде після')
  })
})

describe('MaterializeReport', () => {
  const report = {
    course_id: 1,
    created: [{ order: 1, session_id: 's1' }],
    skipped: [{ order: 2, reason: 'already_materialized', session_id: 's2' }],
    failed: [{ order: 3, error: 'TaskSelectionError', detail: 'мало задач для теми' }],
    total_requested: 3,
  }

  it('рендерить УСІ ТРИ списки', () => {
    const w = mount(MaterializeReport, { props: { report }, global: { plugins: [i18n] } })
    expect(w.find('.materialize-report__block--created').exists()).toBe(true)
    expect(w.find('.materialize-report__block--skipped').exists()).toBe(true)
    expect(w.find('.materialize-report__block--failed').exists()).toBe(true)
  })

  it('failed показує ПРИЧИНУ, не просто номер', () => {
    // Якщо 2 з 8 уроків не зібрались — тьютор має побачити чому зараз,
    // а не на уроці перед учнем.
    const w = mount(MaterializeReport, { props: { report }, global: { plugins: [i18n] } })
    const failed = w.find('.materialize-report__block--failed')
    expect(failed.text()).toContain('TaskSelectionError')
    expect(failed.text()).toContain('мало задач для теми')
  })

  it('порожній звіт каже про це прямо', () => {
    const w = mount(MaterializeReport, {
      props: { report: { ...report, created: [], skipped: [], failed: [] } },
      global: { plugins: [i18n] },
    })
    expect(w.find('.materialize-report__empty').exists()).toBe(true)
  })
})
