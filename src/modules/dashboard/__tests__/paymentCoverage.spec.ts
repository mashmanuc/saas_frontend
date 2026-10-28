// «За що заплачено» (2026-10-28): оплати покривають ряд уроків по черзі — той самий ряд, що значки ₴ у розкладі (О3).
import { describe, it, expect } from 'vitest'
import { eventCovered, eventPayment, monthlyBills, paymentCoverage } from '../utils/paymentCoverage'
import type { StudentLedger } from '../api/studentPayments'

function ledger(over: Partial<StudentLedger> & { left?: number; debt?: number } = {}): StudentLedger {
  const { left = 0, debt = 0, ...rest } = over
  return {
    student_id: 7,
    external_platform: '',
    payments: [],
    lessons: [],
    upcoming: [],
    month_lessons: {},
    ...rest,
    balance: { tracking: true, since: '2026-10-15', paid_lessons: 0, done_lessons: 0, left_lessons: left, last_price: null,
      debt_amount: debt },
  }
}
const held = (id: number, start: string, extra = {}) =>
  ({ source: 'schedule' as const, id, start, minutes: 60, no_show: false, counted: true, ...extra })

describe('paymentCoverage', () => {
  it('Аня: 1 400 ₴ за 4 уроки — два проведені, два наступні в розкладі; п’ятий — ще не оплачено', () => {
    const c = paymentCoverage(ledger({
      left: 2,
      payments: [{ id: 1, amount: 1400, lessons: 4, paid_on: '2026-10-15', note: '' }],
      lessons: [held(22, '2026-10-22T20:00:00+03:00'), held(15, '2026-10-15T20:00:00+03:00')],
      upcoming: [
        { id: 40, start: '2026-11-04T20:20:00+02:00', minutes: 60 },
        { id: 28, start: '2026-10-28T20:20:00+02:00', minutes: 60 },
        { id: 50, start: '2026-11-11T20:20:00+02:00', minutes: 60 },
      ],
    }))
    expect(c.groups[0].price).toBe(350)
    expect(c.groups[0].lessons.map((l) => [l.key, l.held])).toEqual([
      ['schedule:15', true], ['schedule:22', true], ['schedule:28', false], ['schedule:40', false],
    ])
    expect(c.unpaidPlanned.map((l) => l.key)).toEqual(['schedule:50'])
    expect([c.paidAmount, c.paidLessons, c.heldLessons, c.leftLessons, c.leftMoney]).toEqual([1400, 4, 2, 2, 700])
    expect([eventCovered(c, 28), eventCovered(c, 50), eventCovered(c, 999)]).toEqual([true, false, null])
  })

  it('кілька оплат — по черзі від найранішої; ще без дати — оплачені уроки, яких немає в розкладі', () => {
    const c = paymentCoverage(ledger({
      left: 4,
      payments: [
        { id: 2, amount: 1600, lessons: 4, paid_on: '2026-11-01', note: 'листопад' },
        { id: 1, amount: 600, lessons: 2, paid_on: '2026-10-01', note: '' },
      ],
      lessons: [held(1, '2026-10-02T10:00:00Z'), held(2, '2026-10-09T10:00:00Z')],
      upcoming: [{ id: 3, start: '2026-11-03T10:00:00Z', minutes: 45 }],
    }))
    expect(c.groups.map((gr) => [gr.payment.id, gr.lessons.length, gr.undated])).toEqual([[1, 2, 0], [2, 1, 3]])
    expect(c.leftMoney).toBe(1600)
  })

  it('борг: проведені понад оплачене; «не рахується» — окремо й не з’їдає оплату', () => {
    const c = paymentCoverage(ledger({
      left: -1, debt: 300,
      payments: [{ id: 1, amount: 600, lessons: 2, paid_on: '2026-10-01', note: '' }],
      lessons: [
        held(1, '2026-10-02T10:00:00Z'), held(2, '2026-10-05T10:00:00Z', { counted: false }),
        held(3, '2026-10-09T10:00:00Z'), held(4, '2026-10-16T10:00:00Z', { no_show: true }),
      ],
    }))
    expect(c.groups[0].lessons.map((l) => l.key)).toEqual(['schedule:1', 'schedule:3'])
    expect(c.unpaidHeld.map((l) => [l.key, l.noShow])).toEqual([['schedule:4', true]])
    expect(c.free.map((l) => l.key)).toEqual(['schedule:2'])
    expect([c.leftLessons, c.leftMoney, c.debtMoney]).toEqual([-1, 0, 300])
  })
})

// О9 «Платить у кінці місяця» (власник 2026-10-28: мама платить у кінці місяця — жовтень, потім листопад)
describe('paymentCoverage — платить у кінці місяця', () => {
  const monthly = (extra: Partial<StudentLedger['balance']> = {}) => ({
    tracking: true, since: '2026-09-01', paid_lessons: 0, done_lessons: 0, left_lessons: 0, last_price: 350 as number | null,
    debt_amount: 0, mode: 'monthly' as const, month: '2026-10', ...extra,
  })

  it('вересень оплачено не весь — борг; жовтень — рахунок місяця, не борг; листопад — ще не рахунок', () => {
    const c = paymentCoverage(ledger({
      payments: [{ id: 1, amount: 1400, lessons: 4, paid_on: '2026-10-02', note: '', for_month: '2026-09' }],
      lessons: [
        held(1, '2026-09-03T10:00:00Z'), held(2, '2026-09-10T10:00:00Z'), held(3, '2026-09-17T10:00:00Z'),
        held(4, '2026-09-24T10:00:00Z'), held(5, '2026-09-29T10:00:00Z'),
        held(6, '2026-10-06T10:00:00Z'), held(7, '2026-10-13T10:00:00Z'), held(8, '2026-10-20T10:00:00Z'),
      ],
      upcoming: [
        { id: 9, start: '2026-10-27T10:00:00Z', minutes: 60 },
        { id: 10, start: '2026-11-03T10:00:00Z', minutes: 60 },
      ],
    }))
    const c2 = { ...c }
    const withMode = paymentCoverage({ ...ledger(), payments: [], lessons: [], upcoming: [], balance: monthly() })
    expect(withMode.mode).toBe('monthly')
    expect(c2.mode).toBe('prepaid')   // без поля mode (старий сервер) — як було

    const m = paymentCoverage({
      ...ledger(),
      payments: [{ id: 1, amount: 1400, lessons: 4, paid_on: '2026-10-02', note: '', for_month: '2026-09' }],
      lessons: [
        held(1, '2026-09-03T10:00:00Z'), held(2, '2026-09-10T10:00:00Z'), held(3, '2026-09-17T10:00:00Z'),
        held(4, '2026-09-24T10:00:00Z'), held(5, '2026-09-29T10:00:00Z'),
        held(6, '2026-10-06T10:00:00Z'), held(7, '2026-10-13T10:00:00Z'), held(8, '2026-10-20T10:00:00Z'),
      ],
      upcoming: [
        { id: 9, start: '2026-10-27T10:00:00Z', minutes: 60 },
        { id: 10, start: '2026-11-03T10:00:00Z', minutes: 60 },
      ],
      balance: monthly({ paid_lessons: 4, done_lessons: 8, left_lessons: -4, debt_amount: 350 }),
    })
    expect(m.groups[0].lessons.map((l) => l.id)).toEqual([1, 2, 3, 4])
    expect(m.unpaidHeld.map((l) => l.id)).toEqual([5])                       // борг — лише минулий місяць
    expect(m.unpaidPlanned).toEqual([])
    expect(m.bill.map((l) => [l.id, l.held])).toEqual([[6, true], [7, true], [8, true], [9, false]])
    expect(m.billMoney).toBe(1050)                                            // за проведені: 3 × 350
    expect([eventPayment(m, 4), eventPayment(m, 5), eventPayment(m, 9), eventPayment(m, 10)])
      .toEqual(['paid', 'unpaid', 'bill', null])
    expect(eventCovered(m, 9)).toBe(false)
    expect(monthlyBills(m)).toEqual([
      { month: '2026-09', lessons: 1, amount: 350, debt: true },
      { month: '2026-10', lessons: 3, amount: 1050, debt: false },
    ])
  })

  it('оплат ще не було — ціни немає: рахунок без суми; нічого не проведено — за всі уроки місяця в розкладі', () => {
    const m = paymentCoverage({
      ...ledger(),
      lessons: [],
      upcoming: [{ id: 9, start: '2026-10-27T10:00:00Z', minutes: 60 }, { id: 10, start: '2026-11-03T10:00:00Z', minutes: 60 }],
      balance: monthly({ since: '2026-10-01', last_price: null }),
    })
    expect(m.billMoney).toBeNull()
    expect(monthlyBills(m)).toEqual([{ month: '2026-10', lessons: 1, amount: null, debt: false }])
  })

  it('усе сплачено — нічого не пропонує; передоплата — завжди порожньо', () => {
    const m = paymentCoverage({
      ...ledger(),
      payments: [{ id: 1, amount: 700, lessons: 2, paid_on: '2026-10-30', note: '', for_month: '2026-10' }],
      lessons: [held(6, '2026-10-06T10:00:00Z'), held(7, '2026-10-13T10:00:00Z')],
      upcoming: [{ id: 10, start: '2026-11-03T10:00:00Z', minutes: 60 }],
      balance: monthly({ since: '2026-10-01', paid_lessons: 2, done_lessons: 2 }),
    })
    expect([m.bill.length, m.unpaidHeld.length]).toEqual([0, 0])
    expect(monthlyBills(m)).toEqual([])
    expect(monthlyBills(paymentCoverage(ledger({ left: -2 })))).toEqual([])
  })
})
