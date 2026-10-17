/**
 * Діалог «Є незбережені дії» (ТЗ спільного екрана, R7).
 *
 * Рішення власника 2026-10-17 — нагадування, не замок: людина після збою світла не могла вийти,
 * бо сервер був на зв'язку, а дошку з діями вона не відкривала. Тепер «Вийти» є завжди і йде як
 * `logout({ keepUnsent: true })` — копії лишаються в браузері до наступного відкриття дошки.
 *
 * Відкидання — як і раніше, лише другим, явним натисканням із числом дій, і лише коли надіслати
 * нікуди ЖОДНУ з дошок (їх немає або немає доступу). Недоступний сервер — не причина відкидати.
 * Перед відкиданням — копія у файл (SYSTEM_LAW §4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const push = vi.fn()
const getSession = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/modules/winterboard/api/winterboardApi', () => ({
  winterboardApi: { getSession: (...args: unknown[]) => getSession(...args) },
}))

import LogoutUnsentDialog from '../../components/LogoutUnsentDialog.vue'
import { useLogoutGuardStore } from '../../store/logoutGuardStore'
import { useAuthStore } from '../../store/authStore'

const BOARD = '11111111-1111-4111-8111-111111111111'
const KEY = `wb_ops_blocked_v2_${BOARD}_u7_tab1`
const i18n = () => createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })

const online = () => getSession.mockImplementation(async () => ({ name: 'Урок: Піраміда' }))
const offline = () => getSession.mockImplementation(async () => { throw new Error('Network Error') })
const gone = () => getSession.mockImplementation(async () => {
  throw Object.assign(new Error('404'), { response: { status: 404 } })
})
const breakerOpen = () => getSession.mockImplementation(async () => {
  throw Object.assign(new Error('[apiClient] Circuit breaker open — request blocked'),
    { blockedBy: 'circuit_breaker' })
})

beforeEach(() => {
  setActivePinia(createPinia())
  push.mockReset()
  getSession.mockReset()
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

async function openDialog() {
  const guard = useLogoutGuardStore()
  const wrapper = mount(LogoutUnsentDialog, { global: { plugins: [i18n()] } })
  guard.show([{ sessionId: BOARD, ops: 5, keys: [KEY], blocked: true, unreadable: false }])
  await flushPromises()
  return { wrapper, guard }
}

const has = (wrapper: ReturnType<typeof mount>, id: string) => wrapper.find(`[data-testid="${id}"]`).exists()

describe('LogoutUnsentDialog · нагадування, не замок', () => {
  it('показує дошку за назвою, число дій і що вони лишаться в браузері', async () => {
    online()
    const { wrapper } = await openDialog()
    const text = wrapper.text()
    expect(text).toContain('Урок: Піраміда')
    expect(text).toContain('Не збережено дій: 5')
    expect(text).toContain('сервер відмовив')
    expect(text).toContain('залишаться в цьому браузері')
  })

  it('сервер на зв\'язку → «Вийти» є, і це вихід БЕЗ відкидання', async () => {
    online()
    const auth = useAuthStore()
    const logout = vi.spyOn(auth, 'logout').mockResolvedValue({ status: 'done' } as never)
    const { wrapper, guard } = await openDialog()
    expect(has(wrapper, 'logout-unsent-discard')).toBe(false)
    expect(has(wrapper, 'logout-unsent-download')).toBe(false)
    expect(has(wrapper, 'logout-unsent-status')).toBe(false)

    await wrapper.get('[data-testid="logout-unsent-logout"]').trigger('click')
    expect(logout).toHaveBeenCalledWith({ keepUnsent: true })
    expect(guard.open).toBe(false)
  })

  it('«Вийти» є ще до кінця перевірки дошок — вихід на неї не чекає', async () => {
    getSession.mockImplementation(() => new Promise(() => {}))
    const { wrapper } = await openDialog()
    expect(has(wrapper, 'logout-unsent-logout')).toBe(true)
  })

  it('«Відкрити дошку» веде на дошку й закриває діалог', async () => {
    online()
    const { wrapper, guard } = await openDialog()
    await wrapper.get('[data-testid="logout-unsent-open"]').trigger('click')
    expect(push).toHaveBeenCalledWith(`/winterboard/${BOARD}`)
    expect(guard.open).toBe(false)
  })

  it('без зв\'язку або відкритий breaker — відкидати не пропонується (дії поїдуть пізніше), вийти можна', async () => {
    for (const setUp of [offline, breakerOpen]) {
      setUp()
      const { wrapper } = await openDialog()
      expect(has(wrapper, 'logout-unsent-discard')).toBe(false)
      expect(has(wrapper, 'logout-unsent-recheck')).toBe(false)
      expect(has(wrapper, 'logout-unsent-logout')).toBe(true)
      expect(has(wrapper, 'logout-unsent-open')).toBe(true)
      wrapper.unmount()
      useLogoutGuardStore().close()
    }
  })

  it('429 — сервер живий і дошка є: відкидати не пропонується', async () => {
    getSession.mockImplementation(async () => { throw Object.assign(new Error('429'), { response: { status: 429 } }) })
    const { wrapper } = await openDialog()
    expect(has(wrapper, 'logout-unsent-discard')).toBe(false)
  })
})

describe('LogoutUnsentDialog · дошки немає або немає доступу', () => {
  it('404 — надіслати нікуди: копія, відкидання, пояснення; «Відкрити дошку» немає', async () => {
    gone()
    const { wrapper } = await openDialog()
    expect(has(wrapper, 'logout-unsent-discard')).toBe(true)
    expect(has(wrapper, 'logout-unsent-download')).toBe(true)
    expect(has(wrapper, 'logout-unsent-open')).toBe(false)
    expect(wrapper.get('[data-testid="logout-unsent-status"]').text()).toContain('нікуди не відправити')
  })

  it('відкидання — лише другим натисканням, із числом дій, і саме як discardUnsent', async () => {
    gone()
    const auth = useAuthStore()
    const logout = vi.spyOn(auth, 'logout').mockResolvedValue({ status: 'done' } as never)
    const { wrapper } = await openDialog()

    await wrapper.get('[data-testid="logout-unsent-discard"]').trigger('click')
    expect(logout).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="logout-unsent-warning"]').text()).toContain('5')

    await wrapper.get('[data-testid="logout-unsent-confirm"]').trigger('click')
    expect(logout).toHaveBeenCalledWith({ discardUnsent: true })
  })

  it('одна дошка є, друга видалена — відкидання немає (воно прибрало б і живу), копія — лише для видаленої', async () => {
    const OTHER = '22222222-2222-4222-8222-222222222222'
    getSession.mockImplementation(async (id: unknown) => {
      if (id === OTHER) throw Object.assign(new Error('404'), { response: { status: 404 } })
      return { name: 'Урок: Піраміда' }
    })
    const guard = useLogoutGuardStore()
    const wrapper = mount(LogoutUnsentDialog, { global: { plugins: [i18n()] } })
    guard.show([
      { sessionId: BOARD, ops: 5, keys: [KEY], blocked: false, unreadable: false },
      { sessionId: OTHER, ops: 2, keys: ['k2'], blocked: false, unreadable: false },
    ])
    await flushPromises()
    expect(has(wrapper, 'logout-unsent-discard')).toBe(false)
    expect(wrapper.findAll('[data-testid="logout-unsent-download"]')).toHaveLength(1)
    expect(has(wrapper, 'logout-unsent-logout')).toBe(true)
  })

  it('застарілий цикл перевірки (закрили й відкрили знову) не перезаписує свіжий результат', async () => {
    let releaseFirst: (value: unknown) => void = () => {}
    getSession.mockImplementationOnce(() => new Promise(resolve => { releaseFirst = resolve }))
    const guard = useLogoutGuardStore()
    const wrapper = mount(LogoutUnsentDialog, { global: { plugins: [i18n()] } })
    const work = [{ sessionId: BOARD, ops: 5, keys: [KEY], blocked: false, unreadable: false }]
    guard.show(work)
    await flushPromises()
    guard.close()
    await flushPromises()
    gone()
    guard.show(work)
    await flushPromises()
    expect(has(wrapper, 'logout-unsent-discard')).toBe(true)
    releaseFirst({ name: 'Урок' })   // перший, «живий» цикл завершився пізно
    await flushPromises()
    expect(has(wrapper, 'logout-unsent-discard')).toBe(true)
  })

  it('змонтовано вже відкритим (ледаче завантаження) — перевірка дошок все одно йде', async () => {
    gone()
    useLogoutGuardStore().show([{ sessionId: BOARD, ops: 5, keys: [KEY], blocked: true, unreadable: false }])
    const wrapper = mount(LogoutUnsentDialog, { global: { plugins: [i18n()] } })
    await flushPromises()
    expect(has(wrapper, 'logout-unsent-discard')).toBe(true)
  })

  it('копія у файл — дії з копії черги, нічого не стирає', async () => {
    gone()
    localStorage.setItem(KEY, JSON.stringify({ pending: [{ op_id: 'a' }, { op_id: 'b' }], inFlight: [{ op_id: 'c' }] }))
    let saved: Blob | null = null
    const createObjectURL = vi.fn((blob: Blob) => { saved = blob; return 'blob:copy' })
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { wrapper } = await openDialog()
    await wrapper.get('[data-testid="logout-unsent-download"]').trigger('click')

    expect(click).toHaveBeenCalledTimes(1)
    const data = JSON.parse(await (saved as unknown as Blob).text())
    expect(data.format).toBe('m4sh-unsaved-board-ops')
    expect(data.session_id).toBe(BOARD)
    expect(data.ops.map((op: { op_id: string }) => op.op_id)).toEqual(['c', 'a', 'b'])
    expect(localStorage.getItem(KEY)).not.toBeNull()
  })
})
