// «За що заплачено» (2026-10-28): оплати покривають ряд уроків по черзі — той самий ряд, що значки ₴ у розкладі (О3).
import { describe, it, expect } from 'vitest'
import { eventCovered, paymentCoverage } from '../utils/paymentCoverage'
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
