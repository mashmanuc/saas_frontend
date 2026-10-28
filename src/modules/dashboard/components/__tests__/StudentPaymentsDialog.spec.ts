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
  return { ...real, studentPaymentsApi: { ledger: vi.fn(), record: vi.fn(), remove: vi.fn(), summary: vi.fn(), setLessonCounted: vi.fn(), setMonthly: vi.fn() } }
})
import { studentPaymentsApi } from '../../api/studentPayments'

const P = (uk as unknown as { dashboard: { tutor: { payments: Record<string, any> } } }).dashboard.tutor.payments
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k]))
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const NONE = { tracking: false, since: null, paid_lessons: 0, done_lessons: 0, left_lessons: 0, last_price: null, debt_amount: 0 }
const LEDGER = { student_id: 7, external_platform: '', payments: [], lessons: [], balance: NONE, month_lessons: { '2026-10': 8, '2026-11': 0 } }

function dialog() {
  return mount(StudentPaymentsDialog, {
    props: { open: true, studentId: 7, studentName: 'Оля Коваль' },
    global: { plugins: [i18n()], stubs: { teleport: true, transition: false } },
    attachTo: document.body,
  })
}
const $ = (w: ReturnType<typeof dialog>, id: string) => w.find(`[data-testid="${id}"]`)
// 2026-10-28: залишок — картка «Лишилось / Борг» (той самий вигляд, що «Оплати» з розкладу)
const left = (w: ReturnType<typeof dialog>) => $(w, 'payments-overview-left').text().replace(/\s+/g, ' ')

describe('balanceView — що на картці учня', () => {
  it('О9 «в кінці місяця»: борг лише за минулі місяці; цей місяць — до сплати (з сумою, якщо є ціна); сплачено', () => {
    const M = { ...NONE, tracking: true, mode: 'monthly' as const, month: '2026-10', left_lessons: -3 }
    expect(balanceView({ ...M, debt_lessons: 1, debt_amount: 350, month_due_lessons: 2, month_due_amount: 700 }))
      .toEqual({ tone: 'debt', key: 'monthlyDebt', params: { n: 1, amount: 350 } })
    expect(balanceView({ ...M, debt_lessons: 0, month_due_lessons: 3, month_due_amount: 1050.4 }))
      .toEqual({ tone: 'low', key: 'monthlyDueAmount', params: { n: 3, amount: 1050 } })
    expect(balanceView({ ...M, debt_lessons: 0, month_due_lessons: 2, month_due_amount: null }).key).toBe('monthlyDue')
    expect(balanceView({ ...M, left_lessons: 0, debt_lessons: 0, month_due_lessons: 0 })).toEqual({ tone: 'ok', key: 'monthlyClear', params: {} })
    for (const key of ['monthlyDebt', 'monthlyDueAmount', 'monthlyDue', 'monthlyClear']) expect(P.balance[key], key).toBeTruthy()
  })

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
    vi.mocked(studentPaymentsApi.setLessonCounted).mockReset()
    vi.mocked(studentPaymentsApi.setMonthly).mockReset()
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
    expect(left(w)).toContain(`${P.overview.left}6`)
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
    expect(left(w)).toContain(`${P.overview.debt}1`)
    expect(left(w).replace(/\s/g, '')).toContain('≈300₴')
    // оплати вже є — спершу видно їх, форма згорнута в кнопку
    expect($(w, 'student-payments-form').exists()).toBe(false)
    expect($(w, 'student-payments-add-toggle').exists()).toBe(true)
    await $(w, 'student-payment-delete-3').trigger('click')
    expect(studentPaymentsApi.remove).not.toHaveBeenCalled()
    await $(w, 'student-payment-delete-yes-3').trigger('click')
    await flushPromises()
    expect(studentPaymentsApi.remove).toHaveBeenCalledWith(3)
    expect(w.find('[data-testid="student-payments-history"]').exists()).toBe(false)
    expect($(w, 'student-payments-balance').text()).toBe(P.balance.none)
    w.unmount()
  })

  // власник 15.10, пункт 3: «урок не рахувати» — проведений, але з передоплати не списується
  it('«не рахується» — запит із counted:false, урок закреслено, залишок оновлено; ще раз — знову рахується', async () => {
    const TRACK = { ...NONE, tracking: true, since: '2026-10-01', paid_lessons: 4, done_lessons: 2, left_lessons: 2, last_price: 250 }
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce({
      ...LEDGER,
      balance: TRACK,
      lessons: [
        { source: 'schedule', id: 11, start: '2026-10-06T07:00:00Z', minutes: 60, no_show: false, counted: true },
        { source: 'instant', id: 5, start: '2026-10-08T07:00:00Z', minutes: 45, no_show: false, counted: true },
      ],
    } as never)
    vi.mocked(studentPaymentsApi.setLessonCounted)
      .mockResolvedValueOnce({ balance: { ...TRACK, done_lessons: 1, left_lessons: 3 } } as never)
      .mockResolvedValueOnce({ balance: TRACK } as never)
    vi.mocked(studentPaymentsApi.setLessonCounted)
    const w = dialog()
    await flushPromises()
    const btn = () => $(w, 'student-payment-lesson-schedule-11')
    expect(btn().text()).toBe(P.lessonCounted)
    expect($(w, 'student-payments-history').text()).toContain(P.sourceInstant)
    await btn().trigger('click')
    await flushPromises()
    expect(studentPaymentsApi.setLessonCounted).toHaveBeenLastCalledWith(7, { source: 'schedule', id: 11, counted: false })
    expect(btn().text()).toBe(P.lessonNotCounted)
    expect($(w, 'payments-overview-free').text()).toContain(P.lessonNotCounted)   // переїхав у «Не рахуються»
    expect(left(w)).toContain(`${P.overview.left}3`)
    expect(w.emitted('changed')).toHaveLength(1)
    await btn().trigger('click')
    await flushPromises()
    expect(studentPaymentsApi.setLessonCounted).toHaveBeenLastCalledWith(7, { source: 'schedule', id: 11, counted: true })
    expect(btn().text()).toBe(P.lessonCounted)
    w.unmount()
  })

  it('позначку не змінено — причина словами, урок як був', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce({
      ...LEDGER,
      balance: { ...NONE, tracking: true, since: '2026-10-01', paid_lessons: 4, done_lessons: 1, left_lessons: 3 },
      lessons: [{ source: 'schedule', id: 11, start: '2026-10-06T07:00:00Z', minutes: 60, no_show: true, counted: true }],
    } as never)
    vi.mocked(studentPaymentsApi.setLessonCounted).mockRejectedValueOnce({ response: { status: 404, data: { error: 'not_found' } } })
    const w = dialog()
    await flushPromises()
    expect($(w, 'student-payments-history').text()).toContain(P.noShow)
    await $(w, 'student-payment-lesson-schedule-11').trigger('click')
    await flushPromises()
    expect($(w, 'student-payment-error').text()).toBe(P.errors.not_found)
    expect($(w, 'student-payment-lesson-schedule-11').text()).toBe(P.lessonCounted)
    w.unmount()
  })

  it('є оплати — «＋ Записати оплату» розгортає форму; кожна оплата — з уроками по датах', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce({
      ...LEDGER,
      payments: [{ id: 3, amount: 1400, lessons: 4, paid_on: '2026-10-15', note: 'за жовтень' }],
      lessons: [{ source: 'schedule', id: 11, start: '2026-10-15T17:00:00Z', minutes: 60, no_show: false, counted: true }],
      upcoming: [{ id: 12, start: '2026-11-05T17:00:00Z', minutes: 60 }],
      balance: { ...NONE, tracking: true, since: '2026-10-15', paid_lessons: 4, done_lessons: 1, left_lessons: 3, last_price: 350 },
    } as never)
    const w = dialog()
    await flushPromises()
    const group = $(w, 'payments-overview-group')
    expect(group.text()).toContain('за жовтень')
    expect(group.findAll('.pov__lesson')).toHaveLength(3)                 // проведений + у розкладі + «без дати»
    expect(left(w).replace(/\s/g, '')).toContain('≈1050₴')
    await $(w, 'student-payments-add-toggle').trigger('click')
    expect($(w, 'student-payments-form').exists()).toBe(true)
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

  // О9 (власник 2026-10-28: «мама… хоче оплачувати заняття в кінці місяця… і кінець листопада»)
  const MONTHLY = {
    ...LEDGER,
    payments: [{ id: 1, amount: 1400, lessons: 4, paid_on: '2026-10-02', note: '', for_month: '2026-09' }],
    lessons: [
      ...[3, 10, 17, 24, 29].map((d, i) => ({ source: 'schedule', id: i + 1, start: `2026-09-${String(d).padStart(2, '0')}T10:00:00Z`, minutes: 60, no_show: false, counted: true })),
      ...[6, 13, 20].map((d, i) => ({ source: 'schedule', id: i + 6, start: `2026-10-${String(d).padStart(2, '0')}T10:00:00Z`, minutes: 60, no_show: false, counted: true })),
    ],
    upcoming: [{ id: 9, start: '2026-10-27T10:00:00Z', minutes: 60 }, { id: 10, start: '2026-11-03T10:00:00Z', minutes: 60 }],
    balance: { ...NONE, tracking: true, since: '2026-09-01', paid_lessons: 4, done_lessons: 8, left_lessons: -4, last_price: 350,
      debt_amount: 350, mode: 'monthly', month: '2026-10', debt_lessons: 1, month_due_lessons: 3, month_due_amount: 1050 },
  }

  it('«Платить у кінці місяця» — галочка вмикає режим і перечитує облік: жовтень — у рахунок, не борг', async () => {
    vi.mocked(studentPaymentsApi.ledger)
      .mockResolvedValueOnce(LEDGER as never)
      .mockResolvedValueOnce({ ...MONTHLY, payments: [], lessons: MONTHLY.lessons.slice(5),
        balance: { ...MONTHLY.balance, since: '2026-10-01', paid_lessons: 0, done_lessons: 3, left_lessons: -3, last_price: null,
          debt_amount: 0, debt_lessons: 0, month_due_amount: null } } as never)
    vi.mocked(studentPaymentsApi.setMonthly).mockResolvedValueOnce({ balance: { ...MONTHLY.balance, since: '2026-10-01' } } as never)
    const w = dialog()
    await flushPromises()
    const box = w.find('[data-testid="student-payments-monthly-toggle"]')
    expect((box.element as HTMLInputElement).checked).toBe(false)
    ;(box.element as HTMLInputElement).checked = true
    await box.trigger('change')
    await flushPromises()
    expect(studentPaymentsApi.setMonthly).toHaveBeenCalledWith(7, true)
    expect(studentPaymentsApi.ledger).toHaveBeenCalledTimes(2)
    expect((w.find('[data-testid="student-payments-monthly-toggle"]').element as HTMLInputElement).checked).toBe(true)
    expect($(w, 'payments-overview-month-held').text()).toBe('3')
    expect($(w, 'payments-overview-bill').text()).toContain(fill(P.overview.billTitle, { month: 'жовтень' }))
    expect(w.find('[data-testid="payments-overview-unpaid"]').exists()).toBe(false)   // жодного червоного «Не оплачено»
    expect(left(w)).toContain(P.overview.noPrice)                                     // оплат ще не було — суми не вгадуємо
    expect($(w, 'student-payments-add-toggle').text()).toContain(fill(P.monthly.addFor, { month: 'жовтень' }))
    expect(w.emitted('changed')).toHaveLength(1)
    w.unmount()
  })

  it('борг за вересень — спершу «Записати оплату за вересень» з уроками й сумою; вибір жовтня підставляє його рахунок', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce(MONTHLY as never)
    vi.mocked(studentPaymentsApi.record).mockResolvedValueOnce({
      payment: { id: 2, amount: 1050, lessons: 3, paid_on: '2026-10-28', note: '', for_month: '2026-10' },
      balance: { ...MONTHLY.balance, paid_lessons: 7, left_lessons: -1, month_due_lessons: 0, month_due_amount: 0 },
    } as never)
    const w = dialog()
    await flushPromises()
    expect($(w, 'payments-overview-unpaid').text()).toContain(P.overview.debtTitle)
    expect(left(w)).toContain(P.overview.debt)
    const toggle = $(w, 'student-payments-add-toggle')
    expect(toggle.text()).toContain(fill(P.monthly.addFor, { month: 'вересень' }))
    await toggle.trigger('click')
    expect((w.find('input#student-payment-lessons').element as HTMLInputElement).value).toBe('1')
    expect((w.find('input#student-payment-amount').element as HTMLInputElement).value).toBe('350')
    expect($(w, 'student-payment-for-month-2026-09').classes()).toContain('pay-month--on')
    await $(w, 'student-payment-for-month-2026-10').trigger('click')
    expect((w.find('input#student-payment-lessons').element as HTMLInputElement).value).toBe('3')
    expect((w.find('input#student-payment-amount').element as HTMLInputElement).value).toBe('1050')
    await w.find('input#student-payment-date').setValue('2026-10-28')
    await $(w, 'student-payments-form').trigger('submit')
    await flushPromises()
    expect(studentPaymentsApi.record).toHaveBeenCalledWith(7, { amount: '1050', lessons: 3, paid_on: '2026-10-28', note: '', for_month: '2026-10' })
    expect(studentPaymentsApi.ledger).toHaveBeenCalledTimes(1)        // початок обліку не зсунувся — без зайвого запиту
    expect($(w, 'student-payments-history').text()).toContain(fill(P.overview.forMonth, { month: 'жовтень' }))
    // вересень закрито — наступна оплата вже за жовтень (поля порожні)
    expect($(w, 'student-payments-form').text()).toContain(fill(P.monthly.addFor, { month: 'жовтень' }))
    expect((w.find('input#student-payment-lessons').element as HTMLInputElement).value).toBe('')
    w.unmount()
  })

  it('режим не змінено — причина словами, галочка повертається', async () => {
    vi.mocked(studentPaymentsApi.ledger).mockResolvedValueOnce(LEDGER as never)
    vi.mocked(studentPaymentsApi.setMonthly).mockRejectedValueOnce({ response: { status: 400, data: { error: 'bad_mode' } } })
    const w = dialog()
    await flushPromises()
    const box = w.find('[data-testid="student-payments-monthly-toggle"]')
    ;(box.element as HTMLInputElement).checked = true
    await box.trigger('change')
    await flushPromises()
    expect($(w, 'student-payment-error').text()).toBe(P.errors.bad_mode)
    expect((box.element as HTMLInputElement).checked).toBe(false)
    expect(w.emitted('changed')).toBeUndefined()
    w.unmount()
  })
})
