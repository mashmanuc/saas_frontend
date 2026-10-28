/**
 * Один намір дії — один ключ повтору (review Лови F3). Поки сервер не відповів (відповідь загубилася в мережі),
 * повторне натискання тієї самої дії з тими самими параметрами йде з ТИМ САМИМ ключем і точно тим самим тілом —
 * сервер упізнає повтор і не створить другого уроку / підсумку / зміни. Нові параметри або відповідь сервера
 * (успіх чи відмова) завершують намір: наступне натискання — новий намір. Автоматичних повторів немає.
 */
import { errorStatus } from './api/learningProgramsApi'

export interface Intent<B> { sig: string; key: string; body: B }

export function createIntent<B>() {
  let pending: Intent<B> | null = null
  return {
    take(sig: string, build: (key: string) => B): Intent<B> {
      if (!pending || pending.sig !== sig) {
        const key = crypto.randomUUID()
        pending = { sig, key, body: build(key) }
      }
      return pending
    },
    /** Викликати після спроби: без помилки або з відповіддю сервера — намір завершено; без відповіді — лишається. */
    settle(error?: unknown) {
      if (error === undefined || errorStatus(error) !== null) pending = null
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
