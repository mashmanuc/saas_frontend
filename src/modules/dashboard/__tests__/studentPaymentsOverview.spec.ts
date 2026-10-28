// «Оплати» з вікна уроку (2026-10-28): лише показ — сплачено, проведено, лишилось; кожна оплата й на які уроки пішла.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const ledger = vi.fn()
vi.mock('../api/studentPayments', async (orig) => ({ ...(await orig<any>()), studentPaymentsApi: { ledger: (...a: any[]) => ledger(...a) } }))

import StudentPaymentsOverview from '../components/StudentPaymentsOverview.vue'

async function show() {
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const w = mount(StudentPaymentsOverview, {
    props: { open: true, studentId: 7, studentName: 'Аня' },
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
  await flushPromises()
  return w
}

describe('StudentPaymentsOverview', () => {
  it('сплачено 1 400 ₴ за 4 · проведено 2 · лишилось 2 ≈ 700 ₴; уроки оплати з датами; без жодного поля вводу', async () => {
    ledger.mockResolvedValue({
      student_id: 7, external_platform: '', month_lessons: {},
      payments: [{ id: 1, amount: 1400, lessons: 4, paid_on: '2026-10-15', note: 'за жовтень' }],
      lessons: [
        { source: 'schedule', id: 15, start: '2026-10-15T17:00:00Z', minutes: 60, no_show: false, counted: true },
        { source: 'schedule', id: 22, start: '2026-10-22T17:00:00Z', minutes: 60, no_show: false, counted: true },
      ],
      upcoming: [{ id: 28, start: '2026-10-28T18:20:00Z', minutes: 60 }],
      balance: { tracking: true, since: '2026-10-15', paid_lessons: 4, done_lessons: 2, left_lessons: 2, last_price: 350, debt_amount: 0 },
    })
    const w = await show()
    expect(w.find('input, textarea, form').exists()).toBe(false)
    expect(w.get('[data-testid="payments-overview-paid"]').text().replace(/\s/g, '')).toBe('1400₴')
    expect(w.get('[data-testid="payments-overview-left"]').text()).toContain('Лишилось')
    expect(w.get('[data-testid="payments-overview-left"]').text().replace(/\s/g, '')).toContain('≈700₴')
    const group = w.get('[data-testid="payments-overview-group"]')
    expect(group.text()).toContain('за жовтень')
    expect(group.findAll('.pov__lesson').length).toBe(4)                 // 2 проведені + 1 у розкладі + рядок «без дати»
    expect(group.text()).toContain('проведено')
    expect(group.text()).toContain('у розкладі')
    expect(group.text()).toContain('ще без дати в розкладі — уроків: 1')
    expect(w.find('[data-testid="payments-overview-unpaid"]').exists()).toBe(false)
  })

  it('оплат немає — одне речення, де записати', async () => {
    ledger.mockResolvedValue({
      student_id: 7, external_platform: '', month_lessons: {}, payments: [], lessons: [], upcoming: [],
      balance: { tracking: false, since: null, paid_lessons: 0, done_lessons: 0, left_lessons: 0, last_price: null, debt_amount: 0 },
    })
    const w = await show()
    expect(w.get('[data-testid="payments-overview-empty"]').text()).toContain('Мої учні')
  })
})
