/**
 * Один намір дії — один ключ повтору (review Лови F3). Поки сервер не дав визначеної відповіді (відповідь загубилася
 * в мережі), повторне натискання тієї самої дії з тими самими параметрами йде з ТИМ САМИМ ключем і точно тим самим
 * тілом — сервер упізнає повтор і не створить другого уроку / підсумку / зміни. Відповідь сервера (успіх чи відмова)
 * завершує саме свій намір; нові параметри — окремий намір. Незавершені наміри з іншими параметрами не губляться:
 * повернення до них — знову той самий ключ (review F3b: завершення однієї спроби не стирає ключ іншої).
 * Автоматичних повторів немає.
 */
import { errorStatus } from './api/learningProgramsApi'

export interface Intent<B> { sig: string; key: string; body: B }

export function createIntent<B>() {
  const pending = new Map<string, Intent<B>>()
  return {
    take(sig: string, build: (key: string) => B): Intent<B> {
      let intent = pending.get(sig)
      if (!intent) {
        const key = crypto.randomUUID()
        intent = { sig, key, body: build(key) }
        pending.set(sig, intent)
      }
      return intent
    },
    /** Після спроби: без помилки або з відповіддю сервера — цей намір завершено; без відповіді — лишається. */
    settle(intent: Intent<B>, error?: unknown) {
      if ((error === undefined || errorStatus(error) !== null) && pending.get(intent.sig) === intent) {
        pending.delete(intent.sig)
      }
    },
  }
}

/** Чи дійшла відповідь сервера (інакше — мережа, результат невідомий). */
export function answered(error: unknown): boolean {
  return errorStatus(error) !== null
}

/** Захист від запізнілих відповідей (review F4): лише остання розпочата спроба має право оновити екран. */
export function latestOnly() {
  let seq = 0
  return {
    start(): number {
      seq += 1
      return seq
    },
    isCurrent(token: number): boolean {
      return token === seq
    },
  }
}
