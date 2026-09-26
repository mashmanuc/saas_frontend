/**
 * Вкладені error boundary пересилають перехоплене падіння збирачу помилок.
 *
 * `ErrorBoundary` обгортає «Мої уроки», публічний урок і редактор розкладу; як і
 * `AppErrorBoundary`, він повертає `false`, і без явного пересилання ці падіння
 * до звітів не доходили (рев'ю 2026-09-26).
 */
import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import ErrorBoundary from '../ErrorBoundary.vue'
import UiErrorBoundary from '../ui/ErrorBoundary.vue'

describe.each([
  ['components/ErrorBoundary', ErrorBoundary],
  ['components/ui/ErrorBoundary', UiErrorBoundary],
])('%s', (_name, Boundary) => {
  it('передає падіння глобальному обробнику', async () => {
    const Broken = defineComponent({ setup() { throw new Error('вкладене падіння') }, render: () => null })
    const app = createApp(defineComponent({ render: () => h(Boundary as any, null, { default: () => h(Broken) }) }))
    // Екран помилки рендерить `$t` — у справжньому застосунку i18n є; без заглушки
    // сам екран падав би в тесті другою, сторонньою помилкою.
    app.config.globalProperties.$t = (key: string) => key
    const handler = vi.fn()
    app.config.errorHandler = handler
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('div')
    document.body.appendChild(el)

    app.mount(el)
    await nextTick()
    await nextTick()

    expect(handler).toHaveBeenCalledTimes(1)
    expect((handler.mock.calls[0][0] as Error).message).toBe('вкладене падіння')
    app.unmount()
    el.remove()
  })
})
