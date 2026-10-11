/**
 * Staff → «Налаштування платформи» → «Лендинг»: відео блоку «Дзеркало» на /start (2026-10-11).
 *
 * Власник: «роби відео Дзеркала, але так, щоб я міг змінити потім, як кращі зніму».
 * Два поля (відео mp4/webm https + постер) поруч із демо-записом, своя кнопка «Зберегти».
 * Шле лише свої поля (сервер не чіпає те, чого немає в запиті) — демо-запис не стирається;
 * відмову сервера показує людським текстом за кодом.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const api = vi.hoisted(() => ({
  getAll: vi.fn(),
  update: vi.fn(),
  getLandingConfig: vi.fn(),
  updateLandingConfig: vi.fn(),
}))
vi.mock('../../api/platformSettingsApi', () => ({ default: api }))

import StaffPlatformSettingsView from '../StaffPlatformSettingsView.vue'

const VIDEO = 'https://images.m4sh.org/landing/mirror-kreyda.mp4'
const POSTER = 'https://images.m4sh.org/landing/mirror-kreyda.jpg'
const REPLAY = 'https://m4sh.org/winterboard/public/demo-token'

let wrapper: VueWrapper | null = null

async function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  wrapper = mount(StaffPlatformSettingsView, {
    global: { plugins: [i18n], stubs: { LoadingSpinner: true, AlertTriangle: true } },
  })
  await flushPromises()
  return wrapper
}

const card = (w: VueWrapper) => w.find('[data-testid="landing-mirror-setting"]')
const videoInput = (w: VueWrapper) => w.find('[data-testid="landing-mirror-video-input"]')
const posterInput = (w: VueWrapper) => w.find('[data-testid="landing-mirror-poster-input"]')

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getAll.mockResolvedValue([])
  api.getLandingConfig.mockResolvedValue({
    replay_demo_url: REPLAY, mirror_video_url: VIDEO, mirror_video_poster_url: POSTER,
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('Staff: відео Дзеркала на лендингу', () => {
  it('два поля з підписами й підказкою — поруч із демо-записом, заповнені з сервера', async () => {
    const w = await mountView()
    const c = card(w)
    expect(c.exists()).toBe(true)
    expect(c.text()).toContain('Відео Дзеркала (mp4/webm, https)')
    expect(c.text()).toContain('Постер відео Дзеркала')
    expect(c.find('.setting-description').text()).toContain('images.m4sh.org')
    expect(c.find('.setting-description').text()).toContain('Порожнє поле — типове відео')
    expect((videoInput(w).element as HTMLInputElement).value).toBe(VIDEO)
    expect((posterInput(w).element as HTMLInputElement).value).toBe(POSTER)
    // У тій самій групі «Лендинг», одразу після картки демо-запису
    const group = c.element.parentElement!
    const cards = [...group.querySelectorAll('.setting-card')]
    expect(cards.indexOf(c.element)).toBe(cards.findIndex((el) => el.querySelector('input[placeholder^="https://m4sh.org/winterboard"]')) + 1)
  })

  it('«Зберегти» шле лише поля відео (обрізані) і показує збережене з відповіді', async () => {
    api.updateLandingConfig.mockResolvedValue({
      replay_demo_url: REPLAY, mirror_video_url: 'https://cdn.example.com/new.webm', mirror_video_poster_url: '',
    })
    const w = await mountView()
    await videoInput(w).setValue('  https://cdn.example.com/new.webm  ')
    await posterInput(w).setValue('')
    await w.find('[data-testid="landing-mirror-save"]').trigger('click')
    await flushPromises()

    expect(api.updateLandingConfig).toHaveBeenCalledTimes(1)
    expect(api.updateLandingConfig).toHaveBeenCalledWith({
      mirror_video_url: 'https://cdn.example.com/new.webm',
      mirror_video_poster_url: '',
    })
    expect((videoInput(w).element as HTMLInputElement).value).toBe('https://cdn.example.com/new.webm')
    expect(card(w).text()).toContain('Збережено ✓')
  })

  it('демо-запис зберігається окремо і полів відео не шле', async () => {
    api.updateLandingConfig.mockResolvedValue({
      replay_demo_url: '', mirror_video_url: VIDEO, mirror_video_poster_url: POSTER,
    })
    const w = await mountView()
    const replayCard = w.findAll('.setting-card').find((c) => c.find('input[placeholder^="https://m4sh.org/winterboard"]').exists())!
    await replayCard.find('input').setValue('')
    await replayCard.find('button').trigger('click')
    await flushPromises()
    expect(api.updateLandingConfig).toHaveBeenCalledWith({ replay_demo_url: '' })
    expect((videoInput(w).element as HTMLInputElement).value).toBe(VIDEO)
  })

  it.each([
    ['invalid_mirror_video_url', 'Потрібне https-посилання на файл .mp4 або .webm (не на сторінку з відео).'],
    ['invalid_mirror_poster_url', 'Постер — https-посилання на картинку .jpg, .jpeg, .png або .webp.'],
  ])('відмова сервера %s — людський текст, поля не скинуто', async (code, text) => {
    api.updateLandingConfig.mockRejectedValue({ response: { status: 400, data: { error: code, detail: 'english detail' } } })
    const w = await mountView()
    await videoInput(w).setValue('https://www.youtube.com/watch?v=x')
    await w.find('[data-testid="landing-mirror-save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="landing-mirror-error"]').text()).toBe(text)
    expect((videoInput(w).element as HTMLInputElement).value).toBe('https://www.youtube.com/watch?v=x')
  })

  it('інша помилка без коду — загальний текст', async () => {
    api.updateLandingConfig.mockRejectedValue(new Error('offline'))
    const w = await mountView()
    await w.find('[data-testid="landing-mirror-save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="landing-mirror-error"]').text()).toBe('Не вдалося зберегти')
  })
})
