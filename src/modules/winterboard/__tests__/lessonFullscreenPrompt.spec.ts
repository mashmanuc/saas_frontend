/**
 * Власник 2026-09-28 («так»): щойно пульт підключився, ноутбук пропонує «⛶ Повний екран для уроку»
 * (та сама дія, що ⛶ у шапці) або F11 — тоді «На весь екран» з пульта розгортає відео на весь
 * монітор. Увімкнути повний екран сигналом з телефона браузер не дає — потрібен дотик на ноутбуці.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { isBrowserFullscreen, useLessonFullscreenPrompt } from '../composables/useLessonFullscreenPrompt'
import LessonFullscreenPrompt from '../components/remote/LessonFullscreenPrompt.vue'

const P = uk.winterboard.remote.fullscreenPrompt

function setup(over: { enabled?: boolean; connected?: boolean; projector?: boolean } = {}) {
  const enabled = ref(over.enabled ?? true)
  const remoteConnected = ref(over.connected ?? true)
  const projectorOn = ref(over.projector ?? false)
  const scope = effectScope()
  const prompt = scope.run(() => useLessonFullscreenPrompt({ enabled, remoteConnected, projectorOn }))!
  return { enabled, remoteConnected, projectorOn, prompt, scope }
}

function setWindow(w: number, h: number, sw: number, sh: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h })
  Object.defineProperty(window.screen, 'width', { configurable: true, value: sw })
  Object.defineProperty(window.screen, 'height', { configurable: true, value: sh })
}

describe('підказка «⛶ Повний екран для уроку» на ноутбуці', () => {
  afterEach(() => setWindow(1280, 720, 1920, 1080))

  it('є, коли пульт підключився до уроку власника, а екран не повний', () => {
    setWindow(1280, 720, 1920, 1080)
    const { prompt, scope } = setup()
    expect(prompt.visible.value).toBe(true)
    scope.stop()
  })

  it('немає: пульт не підключений, не власник уроку (Студія, учень, локальна дошка) чи режим проєктора вже увімкнено', () => {
    setWindow(1280, 720, 1920, 1080)
    const a = setup({ connected: false })
    const b = setup({ enabled: false })
    const c = setup({ projector: true })
    expect([a.prompt.visible.value, b.prompt.visible.value, c.prompt.visible.value]).toEqual([false, false, false])
    a.remoteConnected.value = true
    expect(a.prompt.visible.value).toBe(true)
    c.projectorOn.value = false
    expect(c.prompt.visible.value).toBe(true)
    ;[a, b, c].forEach((s) => s.scope.stop())
  })

  it('F11 (вікно дорівнює екрану) — підказки немає; вийшли з F11 — знову є', () => {
    setWindow(1920, 1080, 1920, 1080)
    expect(isBrowserFullscreen()).toBe(true)
    const { prompt, scope } = setup()
    expect(prompt.visible.value).toBe(false)
    setWindow(1280, 720, 1920, 1080)
    window.dispatchEvent(new Event('resize'))
    expect(prompt.visible.value).toBe(true)
    scope.stop()
  })

  it('«×» ховає до перезавантаження сторінки', () => {
    setWindow(1280, 720, 1920, 1080)
    const { prompt, remoteConnected, scope } = setup()
    prompt.dismiss()
    expect(prompt.visible.value).toBe(false)
    remoteConnected.value = false
    remoteConnected.value = true
    expect(prompt.visible.value).toBe(false)
    scope.stop()
  })

  it('смуга: тексти; кнопка — enter (та сама дія, що ⛶ у шапці), «×» — dismiss', async () => {
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
    const w = mount(LessonFullscreenPrompt, { global: { plugins: [i18n] } })
    expect(w.text()).toContain(P.title)
    expect(w.text()).toContain(P.hint)
    expect(w.find('[data-testid="lesson-fullscreen-enter"]').text()).toBe(`⛶ ${P.enter}`)
    await w.find('[data-testid="lesson-fullscreen-enter"]').trigger('click')
    await w.find('[data-testid="lesson-fullscreen-dismiss"]').trigger('click')
    expect(w.emitted('enter')).toHaveLength(1)
    expect(w.emitted('dismiss')).toHaveLength(1)
    w.unmount()
  })
})
