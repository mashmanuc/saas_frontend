/**
 * Б-205 (власник 2026-10-16): «Зберегти як урок» має межу розміру дошки, і вчитель дізнавався про неї
 * лише після того, як усе написав («Не вдалося зберегти урок» без причини). Прод 16.10: 5 сторінок
 * рукопису планшетом = 2 099 514 байт при межі 2 МБ.
 *
 * Тут — заповненість дошки відносно ТІЄЇ Ж межі, що на сервері: байти компактного JSON стану
 * (`backend/apps/knowledge/services/save_lesson_service.py` — `MAX_LESSON_SNAPSHOT_BYTES`,
 * `_check_snapshot_size`). Лише підказка вчителю: дошку, операції й стан не чіпає.
 */
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

/** = `MAX_LESSON_SNAPSHOT_BYTES` на сервері. */
export const LESSON_SNAPSHOT_LIMIT_BYTES = 2 * 1024 * 1024

/** З якої заповненості показувати смужку. */
export const GAUGE_SHOW_FROM = 0.75

/** Не частіше — рахувати розмір великої дошки (JSON кількох МБ) кожну дію марно. */
export const MEASURE_INTERVAL_MS = 3000

export type LessonSizeLevel = 'none' | 'warn' | 'full'

const encoder = new TextEncoder()

export function boardStateBytes(state: unknown): number {
  return encoder.encode(JSON.stringify(state)).byteLength
}

export function lessonFillPercent(bytes: number): number {
  return Math.floor((bytes / LESSON_SNAPSHOT_LIMIT_BYTES) * 100)
}

export function lessonSizeLevel(bytes: number): LessonSizeLevel {
  if (bytes > LESSON_SNAPSHOT_LIMIT_BYTES) return 'full'
  if (bytes >= LESSON_SNAPSHOT_LIMIT_BYTES * GAUGE_SHOW_FROM) return 'warn'
  return 'none'
}

/** Відповідь сервера «дошка завелика для уроку» (`error: 'board_too_large'`). */
export function isBoardTooLargeError(err: unknown): boolean {
  const e = err as { response?: { data?: { error?: unknown } }; data?: { error?: unknown } }
  return (e?.response?.data?.error ?? e?.data?.error) === 'board_too_large'
}

export interface LessonSizeGaugeOptions {
  /** Чи стосується дошки збереження уроком (власник, хмарна дошка). */
  enabled: Ref<boolean>
  /** Сигнал «на сервері нова дія» — розмір змінюється лише з діями. */
  seq: () => number
  /** Стан дошки так, як він іде на сервер. */
  getState: () => unknown
}

export function useLessonSizeGauge(opts: LessonSizeGaugeOptions) {
  const bytes = ref(0)
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastRun = 0

  function measure(): void {
    timer = null
    lastRun = Date.now()
    try {
      bytes.value = boardStateBytes(opts.getState())
    } catch (err) {
      // Лише підказка: не вдалось порахувати — смужки не показуємо, дошка працює далі.
      console.warn('[lessonSizeGauge] не вдалося порахувати розмір дошки', err)
      bytes.value = 0
    }
  }

  function schedule(): void {
    if (!opts.enabled.value || timer) return
    timer = setTimeout(measure, Math.max(0, MEASURE_INTERVAL_MS - (Date.now() - lastRun)))
  }

  watch(() => [opts.enabled.value, opts.seq()], schedule, { immediate: true })
  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  const level = computed<LessonSizeLevel>(() => (opts.enabled.value ? lessonSizeLevel(bytes.value) : 'none'))
  const percent = computed(() => lessonFillPercent(bytes.value))
  return { bytes, level, percent, measureNow: measure }
}
