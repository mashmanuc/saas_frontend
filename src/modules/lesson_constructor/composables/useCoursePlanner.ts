import { computed, ref } from 'vue'

import courseApi, {
  type Course,
  type CoursePlan,
  type CourseSpec,
  type MaterializeReport,
} from '../api/courseApi'

/**
 * Стан планувальника курсів (Ф7 7-3).
 *
 * Логіка живе тут, а не в компонентах: головні інвааріанти пакета —
 * «прев'ю нічого не зберігає» і «матеріалізуємо лише вибране» — мають бути
 * перевіряними без монтування Vue-дерева.
 */
export function useCoursePlanner() {
  const spec = ref<CourseSpec>({
    title: '',
    level: '',
    subject: 'math',
    n_lessons: 8,
    tasks_per_lesson: 6,
    topics_scope: [],
    checkpoint_every: null,
  })

  const plan = ref<CoursePlan | null>(null)
  const warnings = ref<string[]>([])
  const density = ref<Record<string, { n_bank: number }>>({})

  /** Номери уроків, які підуть у матеріалізацію. За замовчуванням — усі. */
  const selectedOrders = ref<Set<number>>(new Set())

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const report = ref<MaterializeReport | null>(null)
  const savedCourse = ref<Course | null>(null)

  const hasPlan = computed(() => !!plan.value && plan.value.lessons.length > 0)
  const selectedCount = computed(() => selectedOrders.value.size)

  function _fail(e: unknown): string {
    const anyE = e as { detail?: string; message?: string; response?: { status?: number } }
    if (anyE?.response?.status === 404) return 'notFound'
    return anyE?.detail || anyE?.message || 'unknown'
  }

  /**
   * Побудувати прев'ю. НЕ створює курс — це окрема явна дія.
   * Можна кликати скільки завгодно разів (BE `plan/` нічого не пише).
   */
  async function buildPlan(): Promise<boolean> {
    loading.value = true
    error.value = null
    report.value = null
    try {
      const res = await courseApi.plan(spec.value)
      plan.value = res.plan
      warnings.value = res.warnings || []
      density.value = (res.density || {}) as Record<string, { n_bank: number }>
      // Усі уроки увімкнені за замовчуванням: тьютор знімає зайве, а не
      // збирає з нуля — це вибір на його користь при типовому сценарії.
      selectedOrders.value = new Set(res.plan.lessons.map((l) => l.order))
      return true
    } catch (e) {
      error.value = _fail(e)
      plan.value = null
      return false
    } finally {
      loading.value = false
    }
  }

  function toggleLesson(order: number, on?: boolean): void {
    const next = new Set(selectedOrders.value)
    const want = on === undefined ? !next.has(order) : on
    if (want) next.add(order)
    else next.delete(order)
    selectedOrders.value = next
  }

  function setAllSelected(on: boolean): void {
    selectedOrders.value = on && plan.value
      ? new Set(plan.value.lessons.map((l) => l.order))
      : new Set()
  }

  /** Зберегти курс як чернетку. Нічого не збирає. */
  async function saveCourse(): Promise<Course | null> {
    if (!plan.value) return null
    saving.value = true
    error.value = null
    try {
      const course = await courseApi.create(spec.value, plan.value)
      savedCourse.value = course
      return course
    } catch (e) {
      error.value = _fail(e)
      return null
    } finally {
      saving.value = false
    }
  }

  /**
   * Зберегти й зібрати ВИБРАНІ уроки.
   * Шле рівно `selectedOrders` — не «усі», навіть якщо вибрані всі: явний
   * список робить намір видимим у логах BE.
   */
  async function saveAndMaterialize(): Promise<MaterializeReport | null> {
    const course = await saveCourse()
    if (!course) return null
    saving.value = true
    try {
      const orders = Array.from(selectedOrders.value).sort((a, b) => a - b)
      const res = await courseApi.materialize(course.id, orders)
      report.value = res
      return res
    } catch (e) {
      error.value = _fail(e)
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    spec, plan, warnings, density, selectedOrders, loading, saving, error,
    report, savedCourse, hasPlan, selectedCount,
    buildPlan, toggleLesson, setAllSelected, saveCourse, saveAndMaterialize,
  }
}

export default useCoursePlanner
