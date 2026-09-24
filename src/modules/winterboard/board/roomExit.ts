/**
 * Куди веде кнопка виходу з дошки.
 *
 * Власник 2026-09-24: «з дошки-шаблона на студію це добре, а от з дошки-урока
 * мало би вести до вкладки мої уроки, а не студія». Дошка-шаблон живе у
 * «Студії уроків», а урок відкривають кнопкою «Провести» з «Моїх уроків» —
 * туди вихід і має повертати.
 *
 * Правило чисте (без компонента), щоб його ловив тест: кімнати в тестах не
 * монтуються.
 */
export interface RoomExitInput {
  /** Маршрут /winterboard/prepare/:id — шаблон у Студії. */
  constructorMode: boolean
  /** `session.is_lesson_play` — дошку відкрито як урок. */
  isLessonPlay: boolean
  /** `session.origin_lesson_id` — дошка народилась з уроку. */
  hasOriginLesson: boolean
}

export interface RoomExit {
  path: string
  /** Ключ i18n: напис мусить казати, КУДИ веде кнопка. */
  label: string
}

export const EXIT_TO_STUDIO: RoomExit = {
  path: '/winterboard/boards',
  label: 'winterboard.room.exitToStudio',
}
export const EXIT_TO_LESSONS: RoomExit = {
  path: '/knowledge/my-lessons',
  label: 'winterboard.room.exitToLessons',
}

export function roomExitTarget(input: RoomExitInput): RoomExit {
  // Конструктор — завжди Студія, навіть коли шаблон зроблено з уроку:
  // там його й редагують, і кнопка «Оновити шаблон» веде туди ж.
  if (input.constructorMode) return EXIT_TO_STUDIO
  return input.isLessonPlay || input.hasOriginLesson ? EXIT_TO_LESSONS : EXIT_TO_STUDIO
}
