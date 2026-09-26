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
import type { RouteLocationNormalizedLoaded } from 'vue-router'

const ended = ref(false)

export const sessionEnded = readonly(ended)

export function endSessionView(): void {
  ended.value = true
}

export function resetSessionEndedView(): void {
  ended.value = false
}

/** Публічна сторінка (вхід, стартова, екран блокування) — її ховати не треба. */
export function isPublicRoute(route: Pick<RouteLocationNormalizedLoaded, 'matched'>): boolean {
  return route.matched.some(record => record.meta?.requiresAuth === false)
}

/** Чи прибрати сторінку: сесію завершено, а маршрут показує дані акаунта. */
export function shouldHidePage(isEnded: boolean, route: Pick<RouteLocationNormalizedLoaded, 'matched'>): boolean {
  return isEnded && !isPublicRoute(route)
}
