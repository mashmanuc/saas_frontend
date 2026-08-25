/**
 * Людське повідомлення з відповіді помилки — для палітри Інтегралика.
 *
 * ── Навіщо окремий модуль ────────────────────────────────────────────────
 * Бекенд віддає помилки у ТРЬОХ формах, і читання «в лоб» (`d.error`) працює
 * рівно для однієї. Виміряно 2026-08-26 по коду:
 *
 *   1. ПЛОСКА ВЕЛИКИМИ — `{"error": "TASK_SELECTION_FAILED", "detail": "…"}`
 *      `apps/intent/api/views.py:80` (усі CapabilityError), :70, :161, :248.
 *      Це ОСНОВНИЙ шлях палітри, і для нього мапа працює.
 *
 *   2. ВКЛАДЕНА — `{"error": {"code": "AUTH_FORBIDDEN", "detail": "…"}}`
 *      `apps/core/errors.py:279`, глобальний DRF-обробник. Приходить, коли
 *      падає не capability, а сам DRF: `IsAuthenticated`/`IsIntegralykUser`
 *      не пройшли, throttle, необроблений 500.
 *      ⚠️ Тут `d.error` — ОБ'ЄКТ: у мапі не знайдеться, а `d.detail` порожній
 *      (він усередині `error`). Тому читач падав аж до `e.message` і показував
 *      тьютору «Request failed with status code 403».
 *
 *   3. ПЛОСКА МАЛИМИ — `{"error": "task_selection_failed", "detail": "…"}`
 *      `apps/lesson_constructor/api/views.py:127`. Палітра ходить туди не
 *      напряму, а через capability (яка перевидає код ВЕЛИКИМИ), але форма
 *      існує, і нормалізація регістру коштує один виклик.
 *
 * ── Чого цей модуль НЕ робить ────────────────────────────────────────────
 * Не змінює контракт бекенда. Три форми лишаються трьома — це борг BE, і
 * зводити його треба окремим рішенням (INV-UX-1: контракт і UX не міняють
 * одним пакетом). Тут лише читач, який чесно розуміє всі три.
 */

/** Код помилки з будь-якої з трьох форм, нормалізований до ВЕЛИКИХ. */
export function errorCodeOf(data) {
  const raw = typeof data?.error === 'string' ? data.error : data?.error?.code
  return typeof raw === 'string' ? raw.toUpperCase() : null
}

/** Технічний `detail` з будь-якої форми (у вкладеній він усередині `error`). */
export function errorDetailOf(data) {
  const nested = typeof data?.error === 'object' ? data?.error?.detail : null
  const flat = typeof data?.detail === 'string' ? data.detail : null
  return flat || nested || null
}

/**
 * Повідомлення для показу.
 *
 * Порядок навмисний: людський текст → технічний detail з бекенда → текст
 * винятку axios → загальне. Кожен наступний гірший за попередній, тому
 * падати на нього треба лише коли попереднього справді немає.
 */
export function humanErrorMessage(err, messages, fallback = 'Помилка') {
  const data = err?.response?.data
  const code = errorCodeOf(data)
  return (
    (code && messages?.[code]) ||
    errorDetailOf(data) ||
    err?.message ||
    fallback
  )
}
