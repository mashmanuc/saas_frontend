/**
 * Переслати помилку, яку перехопив error boundary, глобальному обробнику
 * (`app.config.errorHandler`), на який підписаний збирач помилок (modules/diagnostics).
 *
 * Навіщо: boundary повертає `false` з `onErrorCaptured`, і Vue після цього НЕ кличе
 * `app.config.errorHandler` — падіння всередині boundary не доходило до звітів
 * зовсім, лише в консоль (знайдено 2026-09-26, рев'ю пакета staff).
 *
 * Обробник береться з контексту застосунку, а не імпортом diagnostics: так boundary
 * не тягне за собою модуль, який сам може бути причиною падіння.
 */
import type { AppConfig, ComponentPublicInstance } from 'vue'

export function reportCapturedError(
  appConfig: AppConfig | undefined,
  err: unknown,
  instance: ComponentPublicInstance | null,
  info: string,
): void {
  try {
    appConfig?.errorHandler?.(err, instance, info)
  } catch (reportError) {
    // Звіт не сміє зламати сам екран помилки — але й мовчати не можна.
    console.error('[reportCapturedError] звіт про помилку не вдався', reportError)
  }
}
