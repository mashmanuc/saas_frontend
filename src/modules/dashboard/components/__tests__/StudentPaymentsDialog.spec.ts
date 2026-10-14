/**
 * Облік передоплат учня (власник 2026-10-14: «з учня треба реєструвати плату… платять наперед, за кілька
 * уроків або за місяць»). Оплата — «сума за N уроків»; «усі уроки місяця» підставляє кількість з розкладу;
 * залишок рахує сервер; видалення — з підтвердженням; відмова — словами у вікні.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../i18n/locales/uk.json'
import StudentPaymentsDialog from '../StudentPaymentsDialog.vue'
import { balanceView } from '../../api/studentPayments'

vi.mock('../../api/studentPayments', async (orig) => {
  const real = await orig<typeof import('../../api/studentPayments')>()
  return { ...real, studentPaymentsApi: { ledger: vi.fn(), record: vi.fn(), remove: vi.fn(), summary: vi.fn() } }
})
import { studentPaymentsApi } from '../../api/studentPayments'

const P = (uk as unknown as { dashboard: { tutor: { payments: Record<string, any> } } }).dashboard.tutor.payments
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k]))
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const NONE = { tracking: false, since: null, paid_lessons: 0, done_lessons: 0, left_lessons: 0, last_price: null, debt_amount: 0 }
const LEDGER = { student_id: 7, external_platform: '', payments: [], balance: NONE, month_lessons: { '2026-10': 8, '2026-11': 0 } }

function dialog() {
  return mount(StudentPaymentsDialog, {
    props: { open: true, studentId: 7, studentName: 'Оля Коваль' },
    global: { plugins: [i18n()], stubs: { teleport: true, transition: false } },
    attachTo: document.body,
  })
}
const $ = (w: ReturnType<typeof dialog>, id: string) => w.find(`[data-testid="${id}"]`)

describe('balanceView — що на картці учня', () => {
  it('без оплат — нічого; залишок; останній; закінчились; борг з орієнтовною сумою', () => {
    expect(balanceView(NONE).tone).toBe('none')
    expect(balanceView({ ...NONE, tracking: true, left_lessons: 5 })).toEqual({ tone: 'ok', key: 'left', params: { n: 5 } })
    expect(balanceView({ ...NONE, tracking: true, left_lessons: 1 }).key).toBe('one')
    expect(balanceView({ ...NONE, tracking: true, left_lessons: 0 }).key).toBe('zero')
    expect(balanceView({ ...NONE, tracking: true, left_lessons: -2, debt_amount: 500.4 }))
      .toEqual({ tone: 'debt', key: 'debt', params: { n: 2, amount: 500 } })
  })
})

describe('StudentPaymentsDialog', () => {
  beforeEach(() => {
    vi.mocked(studentPaymentsApi.ledger).mockReset()
    vi.mocked(studentPaymentsApi.record).mockReset()
    vi.mocked(studentPaymentsApi.remove).mockReset()
  })

  it('«усі уроки місяця» підставляє кількість з розкладу; запис — сума, уроки, дата, нотатка; залишок оновлено', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce(LEDGER as never)
    vi.mocked(studentPaymentsApi.record).mockResolvedValueOnce({
      payment: { id: 3, amount: 2000, lessons: 8, paid_on: '2026-10-01', note: 'жовтень' },
      balance: { ...NONE, tracking: true, paid_lessons: 8, done_lessons: 2, left_lessons: 6, last_price: 250 },
    } as never)
    const w = dialog()
    await flushPromises()
    expect($(w, 'student-payments-balance').text()).toBe(P.balance.none)
    expect(w.find('[data-testid="student-payment-month-2026-11"]').exists()).toBe(false)   // 0 уроків — без підказки
    expect($(w, 'student-payment-save').attributes('disabled')).toBeDefined()
    // власник 14.10: «плейсхолдери такі, ніби введено вже… не міг зрозуміти, чому кнопка не активна»
    expect(w.find('input#student-payment-amount').attributes('placeholder')).toBe(P.amountPlaceholder)
    expect(w.find('input#student-payment-lessons').attributes('placeholder')).toBe(P.lessonsPlaceholder)
    expect($(w, 'student-payment-fill-hint').text()).toBe(P.fillHint)
    await w.find('input#student-payment-amount').setValue('2 000')
    await $(w, 'student-payment-month-2026-10').trigger('click')
    expect((w.find('input#student-payment-lessons').element as HTMLInputElement).value).toBe('8')
    expect(w.text()).toContain(fill(P.pricePreview, { price: '250 ₴' }))
    expect(w.find('[data-testid="student-payment-fill-hint"]').exists()).toBe(false)   // заповнено — підказки немає
    await w.find('input#student-payment-date').setValue('2026-10-01')
    await w.find('input#student-payment-note').setValue(' жовтень ')
    await $(w, 'student-payments-form').trigger('submit')
    await flushPromises()
    expect(studentPaymentsApi.record).toHaveBeenCalledWith(7, { amount: '2000', lessons: 8, paid_on: '2026-10-01', note: 'жовтень' })
    expect($(w, 'student-payments-balance').text()).toBe(fill(P.balance.left, { n: 6 }))
    expect($(w, 'student-payments-history').text()).toContain('жовтень')
    expect(w.emitted('changed')).toHaveLength(1)
    // форма готова до наступної оплати — поля порожні (інакше здається, що запис не відбувся)
    expect((w.find('input#student-payment-amount').element as HTMLInputElement).value).toBe('')
    expect((w.find('input#student-payment-lessons').element as HTMLInputElement).value).toBe('')
    expect((w.find('input#student-payment-note').element as HTMLInputElement).value).toBe('')
    w.unmount()
  })

  it('дробова кількість уроків — «Записати» вимкнено, запиту немає', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce(LEDGER as never)
    const w = dialog()
    await flushPromises()
    await w.find('input#student-payment-amount').setValue('500')
    await w.find('input#student-payment-lessons').setValue('1.5')
    expect($(w, 'student-payment-save').attributes('disabled')).toBeDefined()
    await $(w, 'student-payments-form').trigger('submit')
    expect(studentPaymentsApi.record).not.toHaveBeenCalled()
    w.unmount()
  })

  it('видалити — лише після «Так, видалити»; залишок перераховано', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce({
      ...LEDGER,
      payments: [{ id: 3, amount: 600, lessons: 2, paid_on: '2026-10-01', note: '' }],
      balance: { ...NONE, tracking: true, paid_lessons: 2, done_lessons: 3, left_lessons: -1, last_price: 300, debt_amount: 300 },
    } as never)
    vi.mocked(studentPaymentsApi.remove).mockResolvedValueOnce({ balance: NONE } as never)
    const w = dialog()
    await flushPromises()
    expect($(w, 'student-payments-balance').text()).toBe(fill(P.balance.debt, { n: 1, amount: 300 }))
    await $(w, 'student-payment-delete-3').trigger('click')
    expect(studentPaymentsApi.remove).not.toHaveBeenCalled()
    await $(w, 'student-payment-delete-yes-3').trigger('click')
    await flushPromises()
    expect(studentPaymentsApi.remove).toHaveBeenCalledWith(3)
    expect(w.find('[data-testid="student-payments-history"]').exists()).toBe(false)
    expect($(w, 'student-payments-balance').text()).toBe(P.balance.none)
    w.unmount()
  })

  it('сервер відмовив — причина словами, історія не змінилась', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce(LEDGER as never)
    vi.mocked(studentPaymentsApi.record).mockRejectedValueOnce({ response: { status: 400, data: { error: 'bad_date' } } })
    const w = dialog()
    await flushPromises()
    await w.find('input#student-payment-amount').setValue('500')
    await w.find('input#student-payment-lessons').setValue('2')
    await $(w, 'student-payments-form').trigger('submit')
    await flushPromises()
    expect($(w, 'student-payment-error').text()).toBe(P.errors.bad_date)
    expect(w.find('[data-testid="student-payments-history"]').exists()).toBe(false)
    expect(w.emitted('changed')).toBeUndefined()
    w.unmount()
  })
})
