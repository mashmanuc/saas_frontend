/**
 * Маршрути дошки очима палітри — ЧИСТІ предикати, без роутера і стора.
 *
 * Чому окремим файлом (2026-09-06, ТЗ_LIVE_LESSON_2026-09-07): палітру в
 * тестах ніхто не монтує (вона тягне роутер, стор, голос — див.
 * pageContext.spec.js «перевіряємо контракт, а не CommandPalette»). А саме
 * тут 09-05/09-06 сталися дві помилки, які НЕ ловив жоден тест:
 *   1. класна кімната не була в списку дощок → Інтегралик сліпий до дошки
 *      на живому уроці («відкрийте дошку з фігурою» при відкритій дошці);
 *   2. я «сховала» палітру в кімнаті, а onIntegralykAsk починається з
 *      `if (!enabled.value) return` → фраза з пульта мовчки викидалась.
 * Обидві тепер під спеком boardRoute.spec.js.
 */

/** Кімнати, де людина САМА готує дошку: тут доречно «опублікувати / зберегти як урок». */
export const AUTHORING_ROUTES = ['winterboard-solo', 'winterboard-prepare']

/** Живий урок: дошка та сама (глобальний useWBStore), але id приходить не з URL. */
export const CLASSROOM_ROUTE = 'winterboard-classroom'

export function isAuthoringRoute(routeName) {
  return AUTHORING_ROUTES.includes(routeName)
}

/**
 * Id дошки, яку зараз бачить палітра.
 * - solo/prepare: з URL (`/winterboard/:id`, `/winterboard/prepare/:id`) — як і було;
 * - classroom: `:lessonId` в URL — це урок, не дошка. Справжній id кімната
 *   пише в `store.workspaceId` при ініціалізації (WBClassroomRoom
 *   `initBoardWithSession`); палітра підхоплює його ледачим watch і передає
 *   сюди як `classroomBoardId`. Поки кімната не записала — чесний null.
 */
export function resolveBoardId({ routeName, params, classroomBoardId }) {
  if (isAuthoringRoute(routeName)) return params?.id ?? null
  if (routeName === CLASSROOM_ROUTE) return classroomBoardId ?? null
  return null
}

/**
 * Де палітри НЕ має бути взагалі.
 * - /staff: адмінка, інструменти тьютора там не мають сенсу (2026-07-27);
 * - /remote: телефон-пульт. У нього ВЛАСНИЙ голос (push-to-talk → `phrase` →
 *   ноутбук → m4sh:integralyk-ask). Палітра на телефоні була б сліпою
 *   кнопкою поруч зі справжнім мікрофоном (рішення власника 2026-09-06).
 * ⛔ Класна кімната сюди НЕ входить — див. шапку файла, помилка №2.
 */
export function isPaletteHiddenRoute({ name, path }) {
  if (typeof path === 'string' && path.startsWith('/staff')) return true
  if (name === 'winterboard-remote') return true
  return false
}
