/**
 * Діалог «Є незбережені дії» (ТЗ спільного екрана, R7): число дій видно ДО відкидання,
 * відкидання — лише другим, явним натисканням, і тоді йде саме `logout({ discardUnsent: true })`.
 *
 * Рецензія пакета A, знахідка 4: відкидання — ЛИШЕ без зв'язку з сервером (§6.4 ТЗ; з
 * сервером на зв'язку спершу відправлення з дошки), і перед ним — пропозиція завантажити
 * копію (SYSTEM_LAW §4).
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

describe('LogoutUnsentDialog', () => {
  it('показує дошку за назвою, число дій і що сервер відмовив', async () => {
    online()
    const { wrapper } = await openDialog()
    const text = wrapper.text()
    expect(text).toContain('Урок: Піраміда')
    expect(text).toContain('Не збережено дій: 5')
    expect(text).toContain('сервер відмовив')
  })

  it('«Відкрити дошку» веде на дошку й закриває діалог', async () => {
    online()
    const { wrapper, guard } = await openDialog()
    await wrapper.get('[data-testid="logout-unsent-open"]').trigger('click')
    expect(push).toHaveBeenCalledWith(`/winterboard/${BOARD}`)
    expect(guard.open).toBe(false)
  })

  it('сервер на зв\'язку → відкидати не пропонується, лише відкрити дошку', async () => {
    online()
    const { wrapper } = await openDialog()
    expect(wrapper.find('[data-testid="logout-unsent-discard"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="logout-unsent-download"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="logout-unsent-status"]').text()).toContain('Сервер на зв\'язку')
  })

  it('відповідь 4xx — теж зв\'язок: відкидати не пропонується', async () => {
    getSession.mockImplementation(async () => { throw Object.assign(new Error('404'), { response: { status: 404 } }) })
    const { wrapper } = await openDialog()
    expect(wrapper.find('[data-testid="logout-unsent-discard"]').exists()).toBe(false)
  })

  it('без зв\'язку: відкидання — лише другим натисканням, із числом дій, і саме як discardUnsent', async () => {
    offline()
    const auth = useAuthStore()
    const logout = vi.spyOn(auth, 'logout').mockResolvedValue({ status: 'done' } as never)
    const { wrapper } = await openDialog()
    expect(wrapper.get('[data-testid="logout-unsent-status"]').text()).toContain('Сервер недоступний')

    await wrapper.get('[data-testid="logout-unsent-discard"]').trigger('click')
    expect(logout).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="logout-unsent-warning"]').text()).toContain('5')

    await wrapper.get('[data-testid="logout-unsent-confirm"]').trigger('click')
    expect(logout).toHaveBeenCalledWith({ discardUnsent: true })
  })

  it('змонтовано вже відкритим (ледаче завантаження) — перевірка зв\'язку все одно йде', async () => {
    offline()
    useLogoutGuardStore().show([{ sessionId: BOARD, ops: 5, keys: [KEY], blocked: true, unreadable: false }])
    const wrapper = mount(LogoutUnsentDialog, { global: { plugins: [i18n()] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="logout-unsent-discard"]').exists()).toBe(true)
  })

  it('без зв\'язку: перед відкиданням можна завантажити копію — у ній дії з копії черги', async () => {
    offline()
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
    // Завантаження нічого не стирає.
    expect(localStorage.getItem(KEY)).not.toBeNull()
  })
})
