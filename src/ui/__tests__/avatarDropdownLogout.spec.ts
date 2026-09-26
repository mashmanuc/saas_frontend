/**
 * Меню аватара і зупинений вихід (ТЗ спільного екрана, R7; рецензія пакета A, знахідка 9).
 *
 * Було: `finally { router.push('/auth/login') }` навіть тоді, коли вихід зупинено через
 * незбережені дії й відкрито діалог. Головний гард повертав залогіненого на головну —
 * дошка розмонтовувалась під відкритим діалогом.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const push = vi.fn(() => Promise.resolve())
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import AvatarDropdown from '../AvatarDropdown.vue'
import { useAuthStore } from '@/modules/auth/store/authStore'

const i18n = () => createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })

beforeEach(() => {
  setActivePinia(createPinia())
  push.mockClear()
})

async function clickLogout(status: string) {
  const auth = useAuthStore()
  auth.user = { id: 7, email: 't@example.com', role: 'tutor', first_name: 'Т', last_name: 'В' } as never
  vi.spyOn(auth, 'logout').mockResolvedValue({ status } as never)
  const wrapper = mount(AvatarDropdown, { global: { plugins: [i18n()] }, attachTo: document.body })
  await wrapper.get('button.avatar-trigger').trigger('click')
  const logout = wrapper.findAll('button.dropdown-item--danger').find(b => b.isVisible())
    ?? wrapper.findAll('button.dropdown-item--danger')[0]
  await logout!.trigger('click')
  await flushPromises()
  wrapper.unmount()
}

describe('AvatarDropdown · вихід', () => {
  it('вихід зупинено (незбережені дії) → лишаємося на сторінці з діалогом', async () => {
    await clickLogout('blocked_unsent')
    expect(push).not.toHaveBeenCalled()
  })

  it('вихід пішов → як раніше, на сторінку входу', async () => {
    await clickLogout('done')
    expect(push).toHaveBeenCalledWith('/auth/login')
  })
})
