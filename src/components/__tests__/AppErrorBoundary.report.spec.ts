/**
 * Падіння сторінки має доходити до збирача помилок.
 *
 * `AppErrorBoundary` повертає `false` з `onErrorCaptured`, і Vue після цього НЕ
 * кличе `app.config.errorHandler`, на який підписаний збирач. До 2026-09-26 крах
 * компонента сторінки — найчастіший тип — не потрапляв у звіти зовсім.
 */
import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import AppErrorBoundary from '../AppErrorBoundary.vue'

describe('AppErrorBoundary', () => {
  it('передає перехоплену помилку глобальному обробнику і показує екран помилки', async () => {
    const Broken = defineComponent({
      setup() {
        throw new Error('сторінка впала')
      },
      render: () => null,
    })
    const root = defineComponent({
      render: () => h(AppErrorBoundary, null, { default: () => h(Broken) }),
    })
    const app = createApp(root)
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
    expect((handler.mock.calls[0][0] as Error).message).toBe('сторінка впала')
    expect(el.textContent).toContain('Онови сторінку')
    app.unmount()
    el.remove()
  })

  it('зламаний обробник не ламає екран помилки', async () => {
    const Broken = defineComponent({ setup() { throw new Error('x') }, render: () => null })
    const app = createApp(defineComponent({ render: () => h(AppErrorBoundary, null, { default: () => h(Broken) }) }))
    app.config.errorHandler = () => { throw new Error('обробник теж упав') }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('div')
    document.body.appendChild(el)

    app.mount(el)
    await nextTick()
    await nextTick()

    expect(el.textContent).toContain('Онови сторінку')
    app.unmount()
    el.remove()
  })
})
