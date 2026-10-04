/**
 * Б-116 (рішення власника 2026-10-04): «Завершити урок» спершу закриває відкритий запис.
 *
 * Раніше урок завершувався, учитель ішов на головну, а запис лишався відкритим, доки його не
 * закривав сторож (зв’язку з дошкою немає понад 90 с, перевірка раз на 30 с), тобто хвилини
 * через дві. Учитель одразу відкривав «Мої записи» й запису там не бачив.
 *
 * Шлях той самий, що в кнопки «Завершити запис» (INV-22): усі дії на сервер (`flushAll`, не
 * `flush`), потім finalize з бар’єром на останньому прийнятому seq. Вікна бар’єра тут немає:
 * учитель уже в діалозі «Завершити урок» із «Завершення…». Невдача — не причина не завершити
 * урок: запис закриє сторож, і він з’явиться в «Моїх записах» трохи згодом (так і кажемо).
 * Одна спроба, без повторів (LAW §12).
 *
 * Чиста функція (без компонента), щоб її ловив тест: кімнати в тестах не монтуються.
 */
import type { FinalizeRecordingResult } from '../api/replay'

export interface EndLessonRecordingDeps {
  /** Усі дії на сервер; кидає, якщо не вдалося (DESYNC / PAUSED / мережа). */
  flushAll: () => Promise<void>
  /** Останній прийнятий сервером seq — читається ПІСЛЯ flushAll. */
  serverSeq: () => number
  finalizeWithBarrier: (sessionId: string, flushedLastSeq: number) => Promise<FinalizeRecordingResult>
}

export type EndLessonRecordingResult =
  | { outcome: 'saved'; result: FinalizeRecordingResult }
  | { outcome: 'later'; error: unknown }

/** Закрити запис перед «Завершити урок». Не кидає: невдачу повертає, щоб кімната сказала про неї. */
export async function closeRecordingBeforeEndLesson(
  sessionId: string,
  deps: EndLessonRecordingDeps,
): Promise<EndLessonRecordingResult> {
  try {
    await deps.flushAll()
    const result = await deps.finalizeWithBarrier(sessionId, deps.serverSeq())
    return { outcome: 'saved', result }
  } catch (error) {
    return { outcome: 'later', error }
  }
}
