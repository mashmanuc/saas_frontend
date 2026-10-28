/**
 * «За що заплачено» (власник 2026-10-28: «показувало за що заплачено. Тобто за які уроки і які дати. Скільки грошей ще
 * лишилось. І уроків проводити на них. І скільки було оплачено і коли. Нового нічого вводити не треба»).
 *
 * Той самий ряд, що й значки ₴ у розкладі (BOOKING_DOMAIN_SSOT О3): уроки учня від дня першої оплати за часом —
 * проведені (без «не рахується») + наступні в розкладі. Оплати від найранішої: кожна покриває свої N уроків ряду по
 * черзі. Проведені понад оплачене — борг; заплановані понад оплачене — ще не оплачено. Лише показ, без запису.
 */
import type { StudentLedger, StudentPaymentItem } from '../api/studentPayments'

export interface CoveredLesson {
  /** `schedule:12` / `instant:5` — урок розкладу має той самий id, що подія календаря */
  key: string
  source: 'schedule' | 'instant'
  id: number
  start: string
  minutes: number
  held: boolean
  noShow: boolean
  /** false — «не рахується» (лише проведені) */
  counted: boolean
}

export interface PaymentGroup {
  payment: StudentPaymentItem
  /** ціна одного уроку цієї оплати, ₴ */
  price: number
  lessons: CoveredLesson[]
  /** оплачені уроки, на які ще немає уроку в розкладі */
  undated: number
}

export interface PaymentCoverage {
  tracking: boolean
  /** О9: 'monthly' — платить у кінці місяця */
  mode: 'prepaid' | 'monthly'
  /** О9: поточний місяць 'YYYY-MM' */
  month: string
  /** О9: уроки поточного місяця понад оплачене (проведені й у розкладі) — рахунок місяця, не борг */
  bill: CoveredLesson[]
  /** О9: ≈ ₴ за вже проведені уроки рахунку місяця (ціна останньої оплати); ціни ще немає — null */
  billMoney: number | null
  /** ціна уроку за останньою оплатою, ₴ */
  lastPrice: number | null
  groups: PaymentGroup[]
  /** проведені понад оплачене — борг */
  unpaidHeld: CoveredLesson[]
  /** заплановані понад оплачене */
  unpaidPlanned: CoveredLesson[]
  /** проведені з позначкою «не рахується» */
  free: CoveredLesson[]
  paidAmount: number
  paidLessons: number
  heldLessons: number
  /** оплачені − проведені; менше нуля — борг (як `balance.left_lessons` сервера) */
  leftLessons: number
  /** гроші за ще не проведені оплачені уроки, ₴ (за ціною їхньої оплати) */
  leftMoney: number
  /** орієнтовний борг, ₴ (сервер — за ціною останньої оплати) */
  debtMoney: number
}

const byStart = (a: { start: string }, b: { start: string }) => Date.parse(a.start) - Date.parse(b.start)

export function paymentCoverage(ledger: StudentLedger): PaymentCoverage {
  const payments = [...ledger.payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.id - b.id)
  const held: CoveredLesson[] = ledger.lessons.map((l) => ({
    key: `${l.source}:${l.id}`, source: l.source, id: l.id, start: l.start, minutes: l.minutes, held: true,
    noShow: l.no_show, counted: l.counted,
  }))
  const series: CoveredLesson[] = [
    ...held.filter((l) => l.counted).sort(byStart),
    ...(ledger.upcoming ?? []).map((u): CoveredLesson => ({ key: `schedule:${u.id}`, source: 'schedule', id: u.id,
      start: u.start, minutes: u.minutes, held: false, noShow: false, counted: true })).sort(byStart),
  ]

  const groups: PaymentGroup[] = payments.map((p) => ({
    payment: p, price: p.lessons > 0 ? p.amount / p.lessons : 0, lessons: [], undated: 0,
  }))
  let g = 0
  let usedInGroup = 0
  const unpaid: CoveredLesson[] = []
  for (const lesson of series) {
    while (g < groups.length && usedInGroup >= groups[g].payment.lessons) { g += 1; usedInGroup = 0 }
    if (g >= groups.length) { unpaid.push(lesson); continue }
    groups[g].lessons.push(lesson)
    usedInGroup += 1
  }
  // О9 «платить у кінці місяця»: понад оплачене цього місяця — рахунок; наступні місяці — ще не рахунок; раніше — борг
  const monthly = ledger.balance.mode === 'monthly'
  const month = ledger.balance.month ?? ''
  const [my, mm] = month.split('-').map(Number)
  const monthStart = my && mm ? new Date(my, mm - 1, 1).getTime() : Number.POSITIVE_INFINITY
  const nextMonthStart = my && mm ? new Date(my, mm, 1).getTime() : Number.POSITIVE_INFINITY
  const inMonth = (l: CoveredLesson) => { const t = Date.parse(l.start); return t >= monthStart && t < nextMonthStart }
  const bill = monthly ? unpaid.filter(inMonth) : []
  const debtOrUnpaid = monthly ? unpaid.filter((l) => Date.parse(l.start) < monthStart) : unpaid
  const lastPrice = ledger.balance.last_price
  let leftMoney = 0
  for (const group of groups) {
    group.undated = Math.max(0, group.payment.lessons - group.lessons.length)
    const notHeld = group.payment.lessons - group.lessons.filter((l) => l.held).length
    leftMoney += Math.max(0, notHeld) * group.price
  }
  const paidLessons = payments.reduce((s, p) => s + p.lessons, 0)
  const heldLessons = series.filter((l) => l.held).length
  return {
    tracking: ledger.balance.tracking,
    mode: monthly ? 'monthly' : 'prepaid',
    month,
    bill,
    billMoney: monthly && lastPrice != null ? Math.round(bill.filter((l) => l.held).length * lastPrice * 100) / 100 : null,
    lastPrice,
    groups,
    unpaidHeld: debtOrUnpaid.filter((l) => l.held),
    unpaidPlanned: debtOrUnpaid.filter((l) => !l.held),
    free: held.filter((l) => !l.counted).sort(byStart),
    paidAmount: payments.reduce((s, p) => s + p.amount, 0),
    paidLessons,
    heldLessons,
    leftLessons: ledger.balance.left_lessons,
    leftMoney: Math.round(leftMoney * 100) / 100,
    debtMoney: ledger.balance.debt_amount,
  }
}

/**
 * Стан уроку розкладу для вікна уроку: 'paid' — покрито оплатою; 'bill' — О9, у рахунок поточного місяця;
 * 'unpaid' — не оплачено; null — уроку немає в ряді (до першої оплати, наступні місяці «в кінці місяця»).
 */
export function eventPayment(coverage: PaymentCoverage, eventId: number): 'paid' | 'bill' | 'unpaid' | null {
  const key = `schedule:${eventId}`
  if (coverage.groups.some((gr) => gr.lessons.some((l) => l.key === key))) return 'paid'
  if (coverage.bill.some((l) => l.key === key)) return 'bill'
  if ([...coverage.unpaidHeld, ...coverage.unpaidPlanned].some((l) => l.key === key)) return 'unpaid'
  return null
}

/** Чи покрито оплатою саме цей урок розкладу: true / false; null — уроку немає в ряді (рахунок місяця — false). */
export function eventCovered(coverage: PaymentCoverage, eventId: number): boolean | null {
  const state = eventPayment(coverage, eventId)
  return state === null ? null : state === 'paid'
}

/** 'YYYY-MM' місяця, у якому урок (час браузера — як і решта вікна) */
export function lessonMonth(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface MonthlyBill {
  /** 'YYYY-MM' */
  month: string
  lessons: number
  /** ≈ ₴ за ціною останньої оплати; ціни ще немає — null */
  amount: number | null
  /** true — минулий місяць (борг) */
  debt: boolean
}

/**
 * О9: за які місяці ще записати оплату — від найранішого: минулі місяці з боргом, потім поточний (якщо в ньому вже є
 * уроки понад оплачене). Поточний — за проведені; ще нічого не проведено — за всі уроки місяця в розкладі.
 */
export function monthlyBills(coverage: PaymentCoverage): MonthlyBill[] {
  if (coverage.mode !== 'monthly') return []
  const price = (n: number) => (coverage.lastPrice != null ? Math.round(n * coverage.lastPrice * 100) / 100 : null)
  const debtByMonth = new Map<string, number>()
  for (const l of coverage.unpaidHeld) debtByMonth.set(lessonMonth(l.start), (debtByMonth.get(lessonMonth(l.start)) ?? 0) + 1)
  const bills: MonthlyBill[] = [...debtByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, n]) => ({ month, lessons: n, amount: price(n), debt: true }))
  if (coverage.bill.length) {
    const heldN = coverage.bill.filter((l) => l.held).length
    const n = heldN || coverage.bill.length
    bills.push({ month: coverage.month, lessons: n, amount: price(n), debt: false })
  }
  return bills
}
