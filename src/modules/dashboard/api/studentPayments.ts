// Облік передоплат учня (власник 2026-10-14: «з учня треба реєструвати плату… платять наперед, за кілька
// уроків або за місяць»). Сервер — `apps/booking/services/student_payments.py`.
import apiClient from '@/utils/apiClient'
import { buildV1Url } from '@/config/apiPrefixes'

export interface PaymentBalance {
  /** false — оплат ще не записано */
  tracking: boolean
  since: string | null
  paid_lessons: number
  done_lessons: number
  /** оплачені − проведені; менше нуля — борг */
  left_lessons: number
  /** ціна одного уроку за останньою оплатою, ₴ */
  last_price: number | null
  /** орієнтовний борг, ₴ (О9 «в кінці місяця» — лише за минулі місяці) */
  debt_amount: number
  /** 2026-10-28 О9: 'monthly' — платить у кінці місяця; старий сервер — без поля (= передоплата) */
  mode?: 'prepaid' | 'monthly'
  /** О9: поточний місяць 'YYYY-MM' (пояс учителя) */
  month?: string
  /** О9: проведені в минулих місяцях понад оплачене */
  debt_lessons?: number
  /** О9: проведені цього місяця й ще не оплачені */
  month_due_lessons?: number
  /** О9: ≈ ₴ за ціною останньої оплати; оплат ще не було — null */
  month_due_amount?: number | null
}

export interface StudentPaymentItem {
  id: number
  amount: number
  lessons: number
  paid_on: string
  note: string
  /** О9: за який місяць 'YYYY-MM' (оплата після уроків); порожньо — передоплата */
  for_month?: string | null
}

/** Проведений урок з першої оплати (2026-10-15): «рахувати / не рахувати» */
export interface HeldLessonItem {
  /** schedule — урок у розкладі; instant — «Створити урок» на картці */
  source: 'schedule' | 'instant'
  id: number
  start: string
  minutes: number
  no_show: boolean
  /** false — «урок не рахувати»: проведений, але з передоплати не списується */
  counted: boolean
}

export interface StudentLedger {
  student_id: number
  external_platform: string
  payments: StudentPaymentItem[]
  /** проведені уроки з першої оплати (порожньо, поки оплат немає) */
  lessons: HeldLessonItem[]
  /** 2026-10-28: наступні нескасовані уроки розкладу за часом (до 20) — для «За що заплачено»; старий сервер — без поля */
  upcoming?: { id: number; start: string; minutes: number }[]
  balance: PaymentBalance
  /** уроків учня в розкладі за поточний і наступний місяць: { 'YYYY-MM': n } */
  month_lessons: Record<string, number>
}

export interface PaymentsSummary {
  /** власник 2026-10-15: «оплату тільки вмикаєм для ID=40» — false: облік цьому вчителю не показуємо */
  enabled: boolean
  month: string
  received: number
  payments_count: number
  lessons_done: number
  debtors: number
  /** залишок кожного свого учня з оплатами: { [studentId]: balance } */
  balances: Record<string, PaymentBalance>
}

export const studentPaymentsApi = {
  summary(month?: string): Promise<PaymentsSummary> {
    return apiClient.get(buildV1Url('/tutor/payments/summary/'), {
      params: month ? { month } : {},
      meta: { skipLoader: true },
    } as never)
  },
  ledger(studentId: number | string): Promise<StudentLedger> {
    return apiClient.get(buildV1Url(`/tutor/students/${studentId}/payments/`), { meta: { skipLoader: true } } as never)
  },
  record(
    studentId: number | string,
    body: { amount: number | string; lessons: number; paid_on?: string; note?: string; for_month?: string },
  ): Promise<{ payment: StudentPaymentItem; balance: PaymentBalance }> {
    return apiClient.post(buildV1Url(`/tutor/students/${studentId}/payments/`), body)
  },
  remove(paymentId: number): Promise<{ balance: PaymentBalance }> {
    return apiClient.delete(buildV1Url(`/tutor/payments/${paymentId}/`))
  },
  /**
   * Залишок оплачених уроків на уроках у розкладі (2026-10-17, О3): `{ [eventId]: n }` для днів [from, to);
   * n ≥ 1 — оплачено (разом із цим уроком), 0 — не оплачено. `enabled: false` — облік оплат цьому вчителю вимкнено.
   */
  scheduleMarks(from: string, to: string): Promise<{ enabled: boolean; left?: Record<string, number> }> {
    return apiClient.get(buildV1Url('/tutor/payments/schedule-marks/'), {
      params: { from, to },
      meta: { skipLoader: true },
    } as never)
  },
  /** О9 «Платить у кінці місяця» (2026-10-28) — перемикач на учні */
  setMonthly(studentId: number | string, monthly: boolean): Promise<{ balance: PaymentBalance }> {
    return apiClient.post(buildV1Url(`/tutor/students/${studentId}/payments/mode/`), { monthly })
  },
  /** «Урок не рахувати» / знову рахувати (2026-10-15) */
  setLessonCounted(
    studentId: number | string,
    body: { source: HeldLessonItem['source']; id: number; counted: boolean },
  ): Promise<{ balance: PaymentBalance }> {
    return apiClient.post(buildV1Url(`/tutor/students/${studentId}/payments/lessons/`), body)
  },
}

export type BalanceTone = 'ok' | 'low' | 'debt' | 'none'

/** Позначка уроку в розкладі: останній оплачений / понад оплачене */

/** Що показати на картці учня: тон і ключ тексту з параметрами (без i18n — щоб тестувати). */
export function balanceView(b: PaymentBalance | null | undefined): { tone: BalanceTone; key: string; params: Record<string, number> } {
  if (!b || !b.tracking) return { tone: 'none', key: 'none', params: {} }
  if (b.mode === 'monthly') {
    // О9: борг — лише за минулі місяці; уроки цього місяця — «до сплати», без червоного
    const debt = b.debt_lessons ?? 0
    if (debt > 0) return { tone: 'debt', key: 'monthlyDebt', params: { n: debt, amount: Math.round(b.debt_amount) } }
    const due = b.month_due_lessons ?? 0
    if (due > 0 && b.month_due_amount != null) {
      return { tone: 'low', key: 'monthlyDueAmount', params: { n: due, amount: Math.round(b.month_due_amount) } }
    }
    if (due > 0) return { tone: 'low', key: 'monthlyDue', params: { n: due } }
    return { tone: 'ok', key: 'monthlyClear', params: {} }
  }
  const left = b.left_lessons
  if (left < 0) return { tone: 'debt', key: 'debt', params: { n: -left, amount: Math.round(b.debt_amount) } }
  if (left === 0) return { tone: 'low', key: 'zero', params: {} }
  if (left === 1) return { tone: 'low', key: 'one', params: { n: 1 } }
  return { tone: 'ok', key: 'left', params: { n: left } }
}

/** О9: 'YYYY-MM' → «жовтень» / «October» (як звуть місяць окремо) */
export function formatMonth(ym: string, locale = 'uk-UA'): string {
  const d = new Date(`${ym}-15T12:00:00`)
  return Number.isNaN(d.getTime()) ? ym : new Intl.DateTimeFormat(locale, { month: 'long' }).format(d)
}

/** «6 000 ₴» */
export function formatUah(value: number, locale = 'uk-UA'): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value)
  return `${n} ₴`
}
