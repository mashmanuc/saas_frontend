/**
 * Сесію в цій вкладці завершено — вміст сторінки прибирається ДО будь-якого переходу.
 *
 * Прийняття власника 2026-09-26: «відкликана сесія не повинна залишати дошку видимою,
 * навіть якщо йде запис і користувач скасував «Покинути сайт?»». ТЗ спільного екрана, R6:
 * розмонтувати, а не накрити.
 *
 * Чому до переходу: під час ручного запису кімната дошки ставить `beforeunload` з
 * підтвердженням. Якщо спершу переходити, браузер питає «Покинути сайт?», а «Залишитись»
 * лишав дошку попереднього вчителя на екрані. Коли вміст прибрано першим, кімната
 * розмонтовується разом зі своїм `beforeunload`, і питати вже нікому; а якби хтось інший
 * спитав і людина лишилась — на екрані нейтральна сторінка, не дошка.
 *
 * `App.vue` показує `SessionEndedView` замість сторінки, поки прапорець стоїть і
 * маршрут не публічний. Знімає прапорець новий вхід.
 */
import { readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

const ended = ref(false)
// Б-41: документ пережив сесію. На відміну від `ended`, новий вхід цей прапорець НЕ знімає:
// чистим документ робить лише перезавантаження.
let documentOutlivedSession = false

export const sessionEnded = readonly(ended)

export function endSessionView(): void {
  ended.value = true
}

/**
 * Б-41: сесія, що ЖИЛА в цьому документі (bootstrap завершено), померла. Ставить
 * `authStore.forceLogout`. Відмова refresh усередині самого bootstrap сюди не йде: там
 * жоден стор ще не вантажив даних акаунта, і вхід після неї лишається без зайвого
 * перезавантаження (найчастіший шлях учителя, що повернувся за тиждень).
 */
export function markDocumentOutlivedSession(): void {
  documentOutlivedSession = true
}

export function resetSessionEndedView(): void {
  ended.value = false
}

/** Публічна сторінка (вхід, стартова, екран блокування) — її ховати не треба. */
export function isPublicRoute(route: Pick<RouteLocationNormalizedLoaded, 'matched'>): boolean {
  return route.matched.some(record => record.meta?.requiresAuth === false)
}

/**
 * Б-36: чи адреса вкладки — публічна сторінка. Саме з адреси, а не з `currentRoute`:
 * bootstrap іде до першої навігації роутера (`main.js`), і `currentRoute` там — ще
 * порожній початковий маршрут.
 */
export function isPublicLocation(router: Pick<Router, 'resolve'>, href: string): boolean {
  return isPublicRoute(router.resolve(href))
}

/**
 * Б-36: вкладка стоїть на публічній сторінці. Роутер імпортується ліниво — він сам тягне
 * `authStore`. Не визначили — вважаємо непублічною (поведінка до Б-36), не мовчки.
 */
export async function isTabOnPublicPage(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const { default: router } = await import('@/router')
    return isPublicLocation(router, window.location.pathname + window.location.search)
  } catch (error) {
    console.warn('[auth] Не вдалося визначити, чи сторінка публічна:', error)
    return false
  }
}

/** Чи прибрати сторінку: сесію завершено, а маршрут показує дані акаунта. */
export function shouldHidePage(isEnded: boolean, route: Pick<RouteLocationNormalizedLoaded, 'matched'>): boolean {
  return isEnded && !isPublicRoute(route)
}

/**
 * Б-41 (2026-09-27): чи відкривати сторінку повним завантаженням, а не SPA-переходом.
 *
 * Сесія вже вмирала в цьому документі без перезавантаження: вихід в іншій вкладці,
 * 401 перехоплювача, завершення з іншого пристрою. Частину сторів вихід свідомо не
 * скидає (`STORES_KEPT_ON_LOGOUT` в `authStore.js`: модуль дошки під SYSTEM_LAW, `replay`,
 * легасі-кімната), і новий вхід у тому самому документі успадковував їхні дані —
 * наступний учитель бачив теку й пошук «Моїх записів» попереднього (відтворено наживо).
 * Повне завантаження дає чистий застосунок, як і кнопка `SessionEndedView`. Публічні
 * сторінки (вхід, стартова, публічний запис) нічого з акаунта не показують — туди
 * SPA-переходи лишаються, і перегляд публічного запису не переривається.
 */
export function needsFreshDocument(route: Pick<RouteLocationNormalizedLoaded, 'matched'>): boolean {
  return documentOutlivedSession && !isPublicRoute(route)
}

/** Лише для тестів: у житті документ «оновлює» тільки перезавантаження. */
export function resetDocumentOutlivedSessionForTests(): void {
  documentOutlivedSession = false
}
