/**
 * Канонічне порівняння кодів планів (PR-1 білінгу, інваріант 4).
 *
 * Публічний каталог віддає `free`/`pro`, entitlement — `FREE`/`PRO`, а
 * pending-запис може прийти як завгодно. Строге `===` між ними означало, що
 * активний Free міг не позначатись активним і людині пропонували «обрати»
 * план, який у неї вже є. Порівнюємо ЛИШЕ через цей модуль — жодних
 * `.toUpperCase()` по компонентах.
 *
 * Чистий модуль без залежностей: `free`, `FREE`, ` Free ` — один план.
 */

export function normalizePlanCode(code: unknown): string {
  if (typeof code !== 'string') return ''
  return code.trim().toUpperCase()
}

/** Обидва коди непорожні й канонічно рівні. Порожній код ніколи не «той самий». */
export function isSamePlan(a: unknown, b: unknown): boolean {
  const na = normalizePlanCode(a)
  const nb = normalizePlanCode(b)
  return na !== '' && na === nb
}

export function isFreePlanCode(code: unknown): boolean {
  return normalizePlanCode(code) === 'FREE'
}

/**
 * Родина Pro: `PRO`, `PRO-USD` (той самий тариф, інша валюта/провайдер —
 * рішення 2026-09-01, бейдж «Рекомендовано» отримують обидва).
 */
export function isProFamilyPlanCode(code: unknown): boolean {
  return normalizePlanCode(code).startsWith('PRO')
}

export function isBusinessPlanCode(code: unknown): boolean {
  return normalizePlanCode(code) === 'BUSINESS'
}

/**
 * Tier (рівень доступу) — код до першого дефіса: `PRO-USD` → `PRO`.
 * PRO (гривня, Plata) і PRO-USD (долар, Paddle) — один і той самий доступ з
 * одним набором фіч/лімітів; різняться лише ціна й рейки. Тому картка
 * PRO-USD у людини з чинним PRO — «Поточний», а не «Оплатити»: другий
 * платіж за той самий доступ створювати не можна. Дзеркало серверного
 * правила в `apps/billing/services/plan_tier.py`.
 */
export function planTier(code: unknown): string {
  const n = normalizePlanCode(code)
  return n.split('-', 1)[0]
}

export function isSameTier(a: unknown, b: unknown): boolean {
  const ta = planTier(a)
  const tb = planTier(b)
  return ta !== '' && ta === tb
}
