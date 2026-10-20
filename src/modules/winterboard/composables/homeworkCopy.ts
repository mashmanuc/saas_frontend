/**
 * «📋 Скопіювати картинку» на картці «Домашнє завдання» на дошці (власник 2026-10-20: «вчитель згенерував домашку
 * і додав на дошку, а учневі не скопіював — додати кнопку скопіювати, як у генераторі домашки»).
 *
 * Картинку малює той самий сервер, що й у вікні домашки (`homeworkImage`), за задачами картки (`data.taskIds`):
 * та сама картка з формулами й підписом M4SH, без відповідей. Сервер віддає її лише власнику дошки — тому кімната
 * передає id дошки лише вчителю-власнику (`provideHomeworkCopyBoard`); поза кімнатою, у записі уроку чи в учня id
 * немає, і кнопки немає.
 */
import { inject, provide, type InjectionKey, type Ref } from 'vue'

const HOMEWORK_COPY_BOARD: InjectionKey<Readonly<Ref<string | null>>> = Symbol('wb-homework-copy-board')

/** Кімната: id дошки, коли глядач — її власник (інакше `null`). */
export function provideHomeworkCopyBoard(boardId: Readonly<Ref<string | null>>): void {
  provide(HOMEWORK_COPY_BOARD, boardId)
}

/** Картка: id дошки для копіювання або `null` — тоді кнопки немає. */
export function useHomeworkCopyBoard(): Readonly<Ref<string | null>> | null {
  return inject(HOMEWORK_COPY_BOARD, null)
}

/** Задачі банку, з яких складено домашку на картці. Картка без них (стара чи з іншого джерела) — без кнопки. */
export function homeworkTaskIds(data: unknown): string[] {
  const ids = (data as { taskIds?: unknown } | null | undefined)?.taskIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && id !== '') : []
}

/**
 * Пояснення сервера для вчителя («Частини задач уже немає в банку…»). Картинку просимо як `blob`, тож і тіло
 * помилки приходить `Blob` — читаємо з нього `detail`. Немає пояснення — `null`, і картка покаже загальне.
 */
export async function serverDetail(e: unknown): Promise<string | null> {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  if (data && typeof data === 'object' && typeof (data as { detail?: unknown }).detail === 'string') {
    return (data as { detail: string }).detail
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const detail = (JSON.parse(await data.text()) as { detail?: unknown }).detail
      return typeof detail === 'string' ? detail : null
    } catch {
      return null   // тіло не JSON — загальне пояснення
    }
  }
  return null
}
