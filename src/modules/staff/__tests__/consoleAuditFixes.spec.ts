/**
 * Виправлення адмінки за аудитом 2026-09-26
 * (saas_docs/domains/admin/STAFF_CONSOLE_AUDIT_2026-09-26.md).
 * Кожен тест тут на старому коді червоний: «++57», порожні фільтри, 49 ₴ як 0,49,
 * фільтр статусів завжди порожній, сирі коди подій і клік на автора дії.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

const push = vi.fn()
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ query: { role: 'tutor' }, params: {} }),
  useRouter: () => ({ push }),
}))

const get = vi.fn()
vi.mock('@/utils/apiClient', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))

import StatCard from '../components/StatCard.vue'
import RecentActivityFeed from '../components/RecentActivityFeed.vue'
import StaffUsersListView from '../views/StaffUsersListView.vue'
import StaffBillingView from '../views/StaffBillingView.vue'
import CurrentPlanCard from '@/modules/billing/components/CurrentPlanCard.vue'

function mountUk(component: any, props: Record<string, unknown> = {}) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  return mount(component, {
    props,
    global: { plugins: [i18n], stubs: { 'router-link': RouterLinkStub, PresenceNowPanel: true } },
  })
}

beforeEach(() => {
  get.mockReset()
  push.mockReset()
})

describe('StatCard: знак тренду', () => {
  it('рядок зі знаком не отримує другий «+»', () => {
    const w = mountUk(StatCard, { value: 348, label: 'Користувачі', trend: '+57 за 7 днів' })
    expect(w.text()).toContain('+57 за 7 днів')
    expect(w.text()).not.toContain('++')
  })
  it('рядок без знака лишається без знака (неактивні — не приріст)', () => {
    const w = mountUk(StatCard, { value: 14, label: 'Тьютори', trend: '119 неактивних' })
    expect(w.text()).toContain('119 неактивних')
    expect(w.text()).not.toContain('+119')
  })
  it('число отримує «+»', () => {
    expect(mountUk(StatCard, { value: 1, label: 'x', trend: 5 }).text()).toContain('+5')
  })
})

describe('Користувачі: фільтри', () => {
  it('обидва фільтри мають пункти, а роль береться з адреси', async () => {
    get.mockResolvedValue({ results: [], count: 0 })
    const w = mountUk(StaffUsersListView)
    await flushPromises()
    const selects = w.findAll('select')
    const role = selects[0].element as HTMLSelectElement
    const status = selects[1].element as HTMLSelectElement
    expect([...role.options].map(o => o.text)).toEqual(['Всі ролі', 'Учень', 'Вчитель', 'Адміністратор', 'Суперадмін'])
    expect([...status.options].map(o => o.text)).toEqual(['Всі статуси', 'Активні', 'Неактивні', 'Онлайн'])
    expect(role.value).toBe('tutor')
    expect(get.mock.calls[0][1].params.role).toBe('tutor')
  })
})

describe('Користувачі: «Онлайн»', () => {
  it('пункт «Онлайн» шле online=1 (а не is_active) і показує позначку', async () => {
    get.mockResolvedValue({ results: [
      { id: 7, email: 'a@b.c', first_name: 'Олена', last_name: '', role: 'tutor', is_active: true, is_online: true },
      { id: 8, email: 'd@e.f', first_name: 'Іван', last_name: '', role: 'tutor', is_active: true, is_online: false },
    ], count: 2, presence_available: true })
    const w = mountUk(StaffUsersListView)
    await flushPromises()
    await w.findAll('select')[1].setValue('online')
    await flushPromises()
    const params = get.mock.calls[get.mock.calls.length - 1][1].params
    expect(params.online).toBe(1)
    expect(params.is_active).toBeUndefined()
    const rows = w.findAll('tbody tr')
    expect(rows[0].text()).toContain('онлайн')
    expect(rows[1].text()).not.toContain('онлайн')
  })
})

describe('Фінанси: суми й статуси', () => {
  beforeEach(() => {
    get.mockImplementation((url: string) => Promise.resolve(url.includes('stats/billing')
      ? { recent_payments: [{ id: 'p1', amount: '499.00', currency: 'UAH', payment_status: 'SUCCEEDED', created_at: '2026-09-26T10:00:00Z', user_email: 'a@b.c' }], pending_checkouts: [] }
      : { billing: {} }))
  })
  it('гривні не діляться вдруге: 499 ₴ — це 499,00', async () => {
    const w = mountUk(StaffBillingView)
    await flushPromises()
    expect(w.text()).toMatch(/499,00/)
    expect(w.text()).not.toMatch(/4,99/)
  })
  it('фільтр «Успішно» знаходить справжній SUCCEEDED', async () => {
    const w = mountUk(StaffBillingView)
    await flushPromises()
    const select = w.find('select.filter-select')
    expect([...(select.element as HTMLSelectElement).options].map(o => o.value)).toContain('SUCCEEDED')
    await select.setValue('SUCCEEDED')
    expect(w.findAll('tbody tr').length).toBe(1)
    expect(w.text()).toContain('Успішно')
  })
})

describe('Остання активність', () => {
  it('подія перекладена, ціль показана, клік веде на того, з ким дію зроблено', async () => {
    // Так подію видачі пише бекенд: entity — сама підписка, людина — у metadata.target_user_id
    // (рев'ю 2026-09-26: попередня версія тесту подавала entity_type 'User', якого бекенд не пише).
    get.mockResolvedValue({ results: [{
      id: 'e1', action: 'staff.user.subscription_granted', entity_type: 'Subscription',
      entity_id: '0b6d7c1e-0000-4000-8000-000000000000', user_id: 1, user_email: 'staff@m4sh.local',
      metadata: { target_user_id: '42', target_email: 'teacher@m4sh.local' },
      created_at: new Date().toISOString(),
    }] })
    const w = mountUk(RecentActivityFeed)
    await flushPromises()
    expect(w.text()).toContain('Staff: підписку видано')
    expect(w.text()).toContain('→ teacher@m4sh.local')
    expect(w.text()).not.toContain('staff.user.subscription_granted')
    await w.find('.feed-item').trigger('click')
    expect(push).toHaveBeenCalledWith('/staff/users/42')
  })
})

describe('Кабінет вчителя: видана вручну підписка', () => {
  it('провайдер STAFF показано людською мовою, а не «Staff»', () => {
    const w = mountUk(CurrentPlanCard, {
      planCode: 'PRO',
      subscription: { status: 'ACTIVE', provider: 'staff', current_period_end: '2026-10-26T10:00:00Z' },
    })
    expect(w.text()).toContain('Надано командою M4SH')
    expect(w.text()).not.toMatch(/Staff/)
  })
})

describe('Нові ключі перекладу є в uk/en/ru', () => {
  const KEYS = [
    'nav.staff', 'nav.dashboard',
    'staff.roles.tutor', 'staff.roles.superadmin',
    'staff.sidebar.realtime', 'staff.breadcrumbs.realtime', 'staff.breadcrumbs.platformSettings',
    'staff.userOverview.subscriptionGrantedReal', 'staff.userOverview.confirmGrantSubscription',
    'staff.userOverview.mfaWasNotEnabled', 'staff.userOverview.actionFailed',
    'staff.userOverview.subscriptionSources.STAFF', 'staff.userOverview.banScopes.ALL',
    'staff.billingOps.manualFinalizeDisabled', 'staff.billingOps.superadminOnly',
    'staff.realtime.title', 'staff.realtime.loadFailed',
    'staff.analytics.hiddenBlocksNote', 'staff.billing.statusRefunded', 'staff.plans.confirmPriceChange',
    'staff.activityFeed.events.staff_user_subscription_granted', 'staff.platformSettings.landing.replayLabel',
    'staff.userOverview.mfaResetWithGrace', 'staff.userOverview.roleChangedMfaGrace', 'staff.billing.providerPaymentId',
    'billing.currentPlanCard.providerStaff',
  ]
  const get = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
  for (const [name, messages] of Object.entries({ uk, en, ru })) {
    it(name, () => {
      const missing = KEYS.filter(k => typeof get(messages, k) !== 'string' || !get(messages, k))
      expect(missing).toEqual([])
    })
  }
})
