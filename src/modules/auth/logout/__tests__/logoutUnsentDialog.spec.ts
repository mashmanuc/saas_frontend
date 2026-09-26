/**
 * Діалог «Є незбережені дії» (ТЗ спільного екрана, R7): число дій видно ДО відкидання,
 * відкидання — лише другим, явним натисканням, і тоді йде саме `logout({ discardUnsent: true })`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/modules/winterboard/api/winterboardApi', () => ({
  winterboardApi: { getSession: vi.fn(async () => ({ name: 'Урок: Піраміда' })) },
}))

import LogoutUnsentDialog from '../../components/LogoutUnsentDialog.vue'
import { useLogoutGuardStore } from '../../store/logoutGuardStore'
import { useAuthStore } from '../../store/authStore'

const BOARD = '11111111-1111-4111-8111-111111111111'
const i18n = () => createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })

beforeEach(() => {
  setActivePinia(createPinia())
  push.mockReset()
})

async function openDialog() {
  const guard = useLogoutGuardStore()
  const wrapper = mount(LogoutUnsentDialog, { global: { plugins: [i18n()] } })
  guard.show([{ sessionId: BOARD, ops: 5, keys: ['k'], blocked: true, unreadable: false }])
  await flushPromises()
  return { wrapper, guard }
}

describe('LogoutUnsentDialog', () => {
  it('показує дошку за назвою, число дій і що сервер відмовив', async () => {
    const { wrapper } = await openDialog()
    const text = wrapper.text()
    expect(text).toContain('Урок: Піраміда')
    expect(text).toContain('Не збережено дій: 5')
    expect(text).toContain('сервер відмовив')
  })

  it('«Відкрити дошку» веде на дошку й закриває діалог', async () => {
    const { wrapper, guard } = await openDialog()
    await wrapper.get('[data-testid="logout-unsent-open"]').trigger('click')
    expect(push).toHaveBeenCalledWith(`/winterboard/${BOARD}`)
    expect(guard.open).toBe(false)
  })

  it('відкидання — лише другим натисканням, із числом дій, і саме як discardUnsent', async () => {
    const auth = useAuthStore()
    const logout = vi.spyOn(auth, 'logout').mockResolvedValue({ status: 'done' } as never)
    const { wrapper } = await openDialog()

    await wrapper.get('[data-testid="logout-unsent-discard"]').trigger('click')
    expect(logout).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="logout-unsent-warning"]').text()).toContain('5')

    await wrapper.get('[data-testid="logout-unsent-confirm"]').trigger('click')
    expect(logout).toHaveBeenCalledWith({ discardUnsent: true })
  })
})
