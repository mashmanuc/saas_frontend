/**
 * Staff: «Витрати на ШІ» (власник 2026-10-08; ТЗ saas_docs/domains/billing/AI_COST_METER_TZ_2026-10-08.md).
 * Сума — ОЦІНКА за прайсом (так і підписано), поруч рахунок OpenAI і різниця; ваші тести окремо від учителів;
 * тривоги — банером угорі. Переклади — справжні uk/en/ru.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

vi.mock('@/modules/staff/api/staffAiCostsApi', () => ({ getAiCosts: vi.fn() }))

import { getAiCosts } from '@/modules/staff/api/staffAiCostsApi'
import StaffAiCostsView from '../views/StaffAiCostsView.vue'

const RouterLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  return mount(StaffAiCostsView, { global: { plugins: [i18n], stubs: { 'router-link': RouterLinkStub } } })
}

const REPORT = {
  period: { from: '2026-10-01', to: '2026-10-08', timezone: 'UTC' },
  price: { version: 'openai-2026-10-07', source: 'https://developers.openai.com/api/docs/pricing',
           verified_on: '2026-10-07', cached_input_upper_bound: true },
  totals: {
    all: { cost_usd: '1.531000', calls: 6, unknown_cost_calls: 1 },
    teachers: { cost_usd: '1.030000', calls: 4, unknown_cost_calls: 1 },
    internal: { cost_usd: '0.500000', calls: 1, unknown_cost_calls: 0 },
    no_owner: { cost_usd: '0.001000', calls: 1, unknown_cost_calls: 0 },
  },
  unknown_cost_calls: 1,
  by_purpose: [{ purpose: 'vision_read', cost_usd: '0.020000', internal_cost_usd: '0.000000', calls: 1,
                 unknown_cost_calls: 0 }],
  by_model: [{ provider: 'openai', model: 'gpt-5.4-mini-2026-03-17', cost_usd: '0.020000',
               internal_cost_usd: '0.000000', calls: 1, unknown_cost_calls: 0 }],
  top_teachers: [{ user_id: 7, email: 'teacher@x', cost_usd: '1.030000', calls: 4, unknown_cost_calls: 1 }],
  teacher_stats: { active: 1, avg_usd: '1.030000', p95_usd: '1.030000' },
  daily: [{ date: '2026-10-08', cost_usd: '0.000360', teachers_cost_usd: '0.000360', internal_cost_usd: '0.000000',
            calls: 1, unknown_cost_calls: 0 }],
  reconciliation: {
    rows: [{ date: '2026-10-07', journal_usd: '1.000000', billed_usd: '2.000000', diff_usd: '1.000000', flagged: true }],
    days_billed: 1, journal_usd: '1.000000', billed_usd: '2.000000', diff_usd: '1.000000', admin_key_configured: true,
  },
  alerts: [
    { code: 'spike', message: 'm', params: { last_day_usd: '1.000000', prev_avg_usd: '0.100000' } },
    { code: 'unknown_cost', message: 'm', params: { count: 1 } },
    { code: 'reconciliation_mismatch', message: 'm', params: { days: 1, examples: '2026-10-07: журнал $1,00 / рахунок $2,00' } },
  ],
}

// Тіло в дужках: функція, яку повертає beforeEach, vitest викликає як прибирання після тесту.
beforeEach(() => {
  vi.mocked(getAiCosts).mockReset()
})

describe('StaffAiCostsView', () => {
  it('підсумки: оцінка за прайсом (не рахунок), ваші тести окремо, рахунок OpenAI і різниця', async () => {
    vi.mocked(getAiCosts).mockResolvedValue(REPORT as any)
    const w = mountView()
    await flushPromises()
    const summary = w.get('[data-testid="ai-costs-summary"]').text()
    expect(summary).toContain('Оцінка за прайсом (не рахунок)')
    expect(summary).toMatch(/\$1[,.]03/)
    expect(summary).toContain('учителі · викликів: 4')
    expect(summary).toContain('Ваші тести')
    expect(summary).toMatch(/\$0[,.]50/)
    expect(summary).toContain('Вартість невідома')
    expect(summary).toContain('Рахунок OpenAI')
    expect(summary).toMatch(/\$2[,.]00/)
    expect(summary).toContain('Різниця')
    expect(w.text()).toContain('Читання картинки')                 // мета — людськими словами
    expect(w.text()).toMatch(/\$0[,.]0004/)                        // копійчаний день — не нуль
    expect(w.get('[data-testid="ai-costs-price"]').text()).toContain('верхня оцінка')
  })

  it('тривоги — банером угорі, усі три', async () => {
    vi.mocked(getAiCosts).mockResolvedValue(REPORT as any)
    const w = mountView()
    await flushPromises()
    const banner = w.get('[data-testid="ai-costs-alerts"]').text()
    expect(banner).toContain('Різке зростання витрат')
    expect(banner).toMatch(/За останню добу \$1[,.]00 — це не менше 3× середнього за попередні 7 діб \(\$0[,.]10 на добу\)/)
    expect(banner).toContain('Є виклики з невідомою вартістю')
    expect(banner).toContain('Журнал розходиться з рахунком OpenAI')
    expect(banner).toContain('2026-10-07')
  })

  it('без тривог банера немає; запит — за поточний місяць UTC', async () => {
    vi.mocked(getAiCosts).mockResolvedValue({ ...REPORT, alerts: [] } as any)
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-testid="ai-costs-alerts"]').exists()).toBe(false)
    const today = new Date().toISOString().slice(0, 10)
    expect(getAiCosts).toHaveBeenCalledWith(`${today.slice(0, 8)}01`, today)
  })

  it('«Сьогодні» перезапитує за одну добу', async () => {
    vi.mocked(getAiCosts).mockResolvedValue(REPORT as any)
    const w = mountView()
    await flushPromises()
    const today = new Date().toISOString().slice(0, 10)
    await w.findAll('.period-btn')[0].trigger('click')
    await flushPromises()
    expect(getAiCosts).toHaveBeenLastCalledWith(today, today)
  })

  it('помилка завантаження — видно, а не порожня сторінка', async () => {
    vi.mocked(getAiCosts).mockRejectedValue(new Error('мережа'))
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('мережа')
  })
})

function lookup(messages: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node == null ? undefined : node[part]), messages)
}

describe('ключі перекладу «Витрати на ШІ»', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/modules/staff/views/StaffAiCostsView.vue'), 'utf-8')
  const keys = new Set<string>(['staff.sidebar.aiCosts'])
  for (const m of src.matchAll(/\$?t\(\s*'(staff\.aiCosts[\w.]*)'/g)) keys.add(m[1])
  for (const p of ['today', 'week', 'month', 'custom']) keys.add(`staff.aiCosts.periods.${p}`)
  for (const code of ['spike', 'unknown_cost', 'reconciliation_mismatch']) {
    keys.add(`staff.aiCosts.alerts.${code}.title`)
    keys.add(`staff.aiCosts.alerts.${code}.text`)
  }
  const purposes = [...src.matchAll(/'([a-z_]+)'/g)].map(m => m[1])
    .filter(p => Object.prototype.hasOwnProperty.call((uk as any).staff.aiCosts.purposes, p))
  for (const p of purposes) keys.add(`staff.aiCosts.purposes.${p}`)

  it('перевірка змістовна', () => {
    expect(keys.size).toBeGreaterThan(50)
    expect(purposes.length).toBe(19)     // + history_lesson (генерація уроку історії, 2026-10-09)
  })

  it.each([['uk', uk], ['en', en], ['ru', ru]])('%s: усі ключі є і це рядки', (_loc, messages) => {
    expect([...keys].filter(k => typeof lookup(messages as any, k) !== 'string')).toEqual([])
  })
})
