/**
 * Смужка «Урок зараз іде → Повернутися» (власник 2026-10-15: «роби»).
 * З червня вона питала статус `in_progress`, а в базі `IN_PROGRESS` — сервер порівнює точно, смужка не
 * показувалась ніколи. Тепер — показується на живий урок і НЕ показується на покинутий (кінець давніше за 2 год),
 * інакше «висіла б» до автозавершення, як колись урок у «Майбутніх» учня.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../i18n/locales/uk.json'

const { push, getActiveLessons, route, auth } = vi.hoisted(() => ({
  push: vi.fn(),
  getActiveLessons: vi.fn(),
  route: { name: 'student-schedule' as string },
  auth: { user: { role: 'student' } as { role: string } | null },
}))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push }) }))
vi.mock('@/api/lessons', () => ({ default: { getActiveLessons } }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))

import GlobalActiveLessonBanner from '../GlobalActiveLessonBanner.vue'

const at = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()
const LIVE = { id: 168, status: 'IN_PROGRESS', has_session: true, end: at(30 * 60 * 1000), tutor_name: 'Олена Коваль', student_name: 'Максим Учень' }

async function banner() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const w = mount(GlobalActiveLessonBanner, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

describe('Смужка «Урок зараз іде»', () => {
  beforeEach(() => {
    push.mockReset()
    route.name = 'student-schedule'
    auth.user = { role: 'student' }
    getActiveLessons.mockReset().mockResolvedValue({ results: [LIVE] })
  })

  it('урок іде — смужка з учителем; «Повернутися» веде в урок', async () => {
    const w = await banner()
    expect(getActiveLessons).toHaveBeenCalledWith({ status: 'IN_PROGRESS' }, { silent: true })
    expect(w.find('.gal-banner').exists()).toBe(true)
    expect(w.text()).toContain('Олена Коваль')
    await w.find('.gal-banner__btn').trigger('click')
    expect(push).toHaveBeenCalledWith('/winterboard/classroom/168')
    w.unmount()
  })

  it('покинутий урок (кінець 3 год тому) — смужки немає', async () => {
    getActiveLessons.mockResolvedValue({ results: [{ ...LIVE, end: at(-3 * 60 * 60 * 1000) }] })
    const w = await banner()
    expect(w.find('.gal-banner').exists()).toBe(false)
    w.unmount()
  })

  it('урок без дошки — смужки немає (повертатися нікуди)', async () => {
    getActiveLessons.mockResolvedValue({ results: [{ ...LIVE, has_session: false }] })
    const w = await banner()
    expect(w.find('.gal-banner').exists()).toBe(false)
    w.unmount()
  })

  it('на головній — не дублює власний блок головної', async () => {
    route.name = 'student-dashboard'
    const w = await banner()
    expect(w.find('.gal-banner').exists()).toBe(false)
    w.unmount()
  })

  it('учитель бачить імʼя учня', async () => {
    auth.user = { role: 'tutor' }
    const w = await banner()
    expect(w.text()).toContain('Максим Учень')
    w.unmount()
  })
})
