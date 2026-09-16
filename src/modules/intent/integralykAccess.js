/**
 * TLV2-RC1 · хто й коли бачить Інтегралика — без клієнтських build-прапорців.
 *
 * Межа після прибирання клієнтських прапорців (ТЗ 44 §4.2):
 *   • оболонку бачить авторизований tutor/staff там, де дозволяє маршрут
 *     (`boardRoute.isPaletteHiddenRoute`: адмінка й телефон-пульт — ні);
 *   • `UserSettings.integralyk_enabled === false` — персональний вимикач: ховає
 *     маскот, AI, підказки, провідник і голос;
 *   • голос — лише коли браузер його підтримує і AI-режим доступний;
 *   • бекенд `FEATURE_UIA` / `FEATURE_UIA_AI` лишаються операційними kill-switch:
 *     вимкнений сервер відповідає 404 ще до DRF (Django `Http404`, тіло без коду
 *     помилки). FE не зникає через локальний env, а чесно каже, що на сервері вимкнено.
 */
import { isPaletteHiddenRoute } from './boardRoute'
import { errorCodeOf } from './errorMessage'

/** Ролі, яким доступна палітра (плюс будь-який `is_staff`). */
export const INTEGRALYK_ROLES = Object.freeze(['tutor', 'admin', 'staff', 'superadmin'])

/** Чи доступна оболонка Інтегралика цьому користувачу на цьому маршруті. */
export function canUseIntegralyk(user, route) {
  if (!user) return false
  if (isPaletteHiddenRoute(route)) return false
  return INTEGRALYK_ROLES.includes(user.role) || user.is_staff === true
}

/** Персональний вимикач: показувати, доки користувач явно не вимкнув. */
export function isIntegralykOn(settings) {
  return settings?.integralyk_enabled !== false
}

/**
 * Чи це відповідь сервера з вимкненим Інтеграликом (kill-switch), а не помилка команди.
 * Вимкнений `FEATURE_UIA` / `FEATURE_UIA_AI` дає 404 на `/v1/intents/*` без коду помилки;
 * справжня capability-помилка «не знайдено» має JSON-код (`NOT_FOUND`) і сюди не потрапляє.
 */
export function isIntegralykServerDisabled(err) {
  const res = err?.response
  if (res?.status !== 404) return false
  const url = String(res.config?.url ?? err?.config?.url ?? '')
  if (!url.includes('/intents/')) return false
  return errorCodeOf(res.data) === null
}

/** Людське повідомлення для вимкненого на сервері Інтегралика. */
export const INTEGRALYK_SERVER_DISABLED_MESSAGE = 'Інтегралик вимкнено на цьому сервері.'
