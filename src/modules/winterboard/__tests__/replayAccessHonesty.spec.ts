/**
 * Чесні режими доступу до реплею — ТЗ «З» 2026-09-09.
 *
 * ЩО САМЕ СТЕРЕЖЕМО. Назва «Поділитися тільки з учнями» обіцяла персональний
 * доступ конкретному учню, якого в системі немає: `public_token` відкриває
 * запис будь-кому, хто має посилання, без входу. Учитель міг вважати, що
 * запис бачить лише його учень.
 *
 * ⚠️ Тест бере тексти з РЕАЛЬНОГО `uk.json`, а не з власного мока. Інакше він
 * доводив би лише те, що я вмію написати рядок у фікстурі — а не те, що саме
 * побачить учитель.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import uk from '@/i18n/locales/uk.json'

const { getReplay, changeReplayVisibility, rotateReplayToken } = vi.hoisted(() => ({
  getReplay: vi.fn(),
  changeReplayVisibility: vi.fn(),
  rotateReplayToken: vi.fn(),
}))

vi.mock('../api/replayLifecycleApi', () => ({
  getReplay, changeReplayVisibility, rotateReplayToken,
}))
vi.mock('../api/replay', () => ({ createReplayFromExistingOps: vi.fn() }))

import WBReplayShareModal from '../components/replay/WBReplayShareModal.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

function replayFixture(over: Record<string, unknown> = {}) {
  return {
    id: 'r-1',
    title: 'Урок',
    visibility: 'unlisted',
    public_token: 'tok-old',
    status: 'active',
    ...over,
  }
}

/**
 * Модалка вантажить запис у `watch(() => props.visible)` БЕЗ `immediate`,
 * тобто реагує саме на відкриття. Тому монтуємо закритою і відкриваємо —
 * як це відбувається в житті.
 */
async function open(visibility = 'unlisted', over: Record<string, unknown> = {}) {
  getReplay.mockResolvedValue(replayFixture({ visibility, ...over }))
  const w = mount(WBReplayShareModal, {
    props: { visible: false, replayId: 'r-1' },
    global: { plugins: [i18n] },
  })
  await w.setProps({ visible: true })
  await flushPromises()
  return w
}

beforeEach(() => {
  getReplay.mockReset()
  changeReplayVisibility.mockReset()
  rotateReplayToken.mockReset()
})

describe('назви режимів більше нічого не обіцяють', () => {
  it('немає обіцянки персонального доступу учню', async () => {
    const w = await open()
    const text = w.text()

    expect(text).not.toContain('тільки з учнями')
    expect(text).not.toContain('Поділитися тільки')
  })

  it('три режими названі чесно', async () => {
    const text = (await open()).text()

    expect(text).toContain('Приватний — лише я')
    expect(text).toContain('Доступ за посиланням')
    expect(text).toContain('Відкритий для всіх')
  })

  it('кожен режим має точне пояснення з ТЗ', async () => {
    const text = (await open()).text()

    expect(text).toContain('Посилання не працює для інших')
    expect(text).toContain(
      'Будь-хто, хто має посилання, може переглянути запис без входу')
    expect(text).toContain('Запис доступний усім, може бути знайдений і поширений')
  })

  it('пояснення взяті саме з локалі, а не написані в шаблоні', () => {
    const hints = (uk as any).winterboard.replay.share.visibilityHints
    expect(hints.unlisted).toContain('без входу')
    expect(hints.private).toContain('не працює для інших')
  })
})

describe('поточний режим позначений, а не виглядає зламаним', () => {
  it('на активній кнопці стоїть підпис', async () => {
    const w = await open('unlisted')
    const active = w.find('.wb-share-modal__visibility-btn--active')

    expect(active.exists()).toBe(true)
    expect(active.text()).toContain('Поточний режим')
  })

  it('підпис лише на одній кнопці', async () => {
    const w = await open('private')
    expect(w.findAll('.wb-share-modal__visibility-current')).toHaveLength(1)
  })
})

describe('приватний режим не вбиває вже роздане посилання', () => {
  it('у приватному з’являється дія відкликання з поясненням', async () => {
    const w = await open('private')

    expect(w.text()).toContain('Відкликати старе посилання')
    expect(w.text()).toContain('продовжує відкривати запис')
  })

  it('відкликання перевипускає токен і зникає з екрана', async () => {
    const w = await open('private')
    rotateReplayToken.mockResolvedValue(
      replayFixture({ visibility: 'private', public_token: 'tok-new' }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await w.find('.wb-share-modal__revoke-btn').trigger('click')
    await flushPromises()

    expect(rotateReplayToken).toHaveBeenCalledWith('r-1')
    expect(w.find('.wb-share-modal__revoke-btn').exists()).toBe(false)
  })

  it('у режимі за посиланням дії відкликання немає — там звичайне оновлення', async () => {
    const w = await open('unlisted')
    expect(w.find('.wb-share-modal__revoke-btn').exists()).toBe(false)
  })

  it('без токена відкликати нема чого', async () => {
    const w = await open('private', { public_token: null })

    expect(w.find('.wb-share-modal__revoke-btn').exists()).toBe(false)
  })
})
