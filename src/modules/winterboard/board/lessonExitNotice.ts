/**
 * Підтвердження після «← Мої уроки» з уроку, проведеного з шаблону.
 *
 * Власник 2026-10-03: учитель змінив дошку на уроці, натиснув «← Мої уроки» — і
 * «втратив» зміни. Насправді вони не губляться: дошка цього проведення лежить у
 * «Мої уроки» → «Проведені уроки». Але шаблон лишається старим, наступне «Провести»
 * стартує з нього, а де зміни — учитель не знає. Вікно-питання після кожного уроку
 * власник відхилив («учитель майже завжди щось пише» → «закрити й не читати»). Тому
 * коротке підтвердження, що НЕ блокує вихід, і поруч дія «Зберегти як новий шаблон».
 *
 * Невдале збереження — не тут: вихід із незбереженою чергою скасовує
 * `useUnsecuredQueueGuard` (LAW §4–§5), тоді й підтвердження не буде.
 *
 * Правило чисте (без компонента), щоб його ловив тест: кімнати в тестах не монтуються.
 */

/**
 * Операції, що лише переходять між сторінками, а не змінюють урок. `page_navigate`
 * дошка шле на КОЖНЕ гортання (для Replay), тож якби вона рахувалась, підтвердження
 * з'являлося б після кожного уроку, де вчитель просто гортав.
 */
const NAVIGATION_ONLY_OPS: ReadonlySet<string> = new Set(['page_navigate'])

/** Чи змінює операція сам урок (а не лише показану сторінку). */
export function isLessonContentOp(opType: string): boolean {
  return !NAVIGATION_ONLY_OPS.has(opType)
}

export interface LessonExitNoticeInput {
  /** Умова кнопки «Зберегти як новий шаблон»: власник, урок із шаблону, хмарна дошка, не Студія. */
  canSaveAsNewTemplate: boolean
  /** Кнопка веде в «Мої уроки» (а не в Студію). */
  toLessons: boolean
  /**
   * За цей візит урок змінювали (операції вмісту, див. `isLessonContentOp`), і ці зміни ще не
   * збережено «Зберегти як новий шаблон».
   */
  contentChanged: boolean
  /** Черги немає й синхронізація в нормі — усі зміни на сервері, не лише в копії на комп'ютері. */
  allOnServer: boolean
}

/**
 * Показувати лише тоді, коли є що сказати. Без змін вмісту (чи все вже збережено як новий
 * шаблон) — тиша. Зміни лише в копії на комп'ютері (нема мережі) — теж тиша: «збережено в
 * Проведених» було б неправдою.
 */
export function shouldShowLessonExitNotice(i: LessonExitNoticeInput): boolean {
  return i.canSaveAsNewTemplate && i.toLessons && i.contentChanged && i.allOnServer
}

/** Параметри «Моїх уроків», за якими сторінка відкриває вікно «Зберегти як новий шаблон». */
export const SAVE_COPY_QUERY = 'save_copy'
export const SAVE_COPY_TITLE_QUERY = 'save_copy_title'

/** Куди веде дія сповіщення: «Мої уроки» з відкритим вікном копії саме цього проведення. */
export function saveCopyHref(lessonsPath: string, sessionId: string, defaultTitle: string): string {
  const q = new URLSearchParams({ [SAVE_COPY_QUERY]: sessionId })
  if (defaultTitle) q.set(SAVE_COPY_TITLE_QUERY, defaultTitle)
  return `${lessonsPath}?${q.toString()}`
}
