// Тести useProjectorMode — «Режим проєктора» (CLASSROOM_REMOTE_VISION крок 2).
// Кожен тест червоніє, якщо зламати відповідну гілку в composable.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { DeviceMode } from '../types/responsive'
import { useProjectorMode, type UseProjectorModeReturn } from '../composables/useProjectorMode'
import { AUTO_HIDE_DELAY_MS } from '../composables/useDisplayMode'

function mountProjector(deviceMode: DeviceMode = 'desktop') {
  const mode = ref<DeviceMode>(deviceMode)
  let api!: UseProjectorModeReturn
  const wrapper = mount(defineComponent({
    setup() {
      api = useProjectorMode(mode)
      return () => h('div')
    },
  }))
  return { wrapper, api, mode }
}

describe('useProjectorMode', () => {
  let wakeRequest: ReturnType<typeof vi.fn>
  let wakeRelease: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true })
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)

    wakeRelease = vi.fn()
    wakeRequest = vi.fn().mockResolvedValue({ release: wakeRelease, addEventListener: vi.fn() })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: wakeRequest },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('вимкнено за замовчуванням: device mode не підмінюється, шапка видима', () => {
    const { api } = mountProjector('desktop')
    expect(api.enabled.value).toBe(false)
    expect(api.effectiveDeviceMode.value).toBe('desktop')
    expect(api.uiVisible.value).toBe(true)
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()
  })

  it('enter(): вмикає режим, повний екран і wake lock', async () => {
    const { api } = mountProjector('desktop')
    await api.enter()
    await nextTick()
    expect(api.enabled.value).toBe(true)
    expect(api.effectiveDeviceMode.value).toBe('display')
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(wakeRequest).toHaveBeenCalledWith('screen')
  })

  it('у режимі шапка ховається після AUTO_HIDE_DELAY_MS і повертається від дотику', async () => {
    const { api } = mountProjector('desktop')
    await api.enter()
    await nextTick()
    expect(api.uiVisible.value).toBe(true)

    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS)
    expect(api.uiVisible.value).toBe(false)

    document.dispatchEvent(new Event('pointerdown'))
    expect(api.uiVisible.value).toBe(true)
  })

  it('exit(): вимикає режим, виходить із повного екрана, звільняє wake lock, показує шапку', async () => {
    const { api } = mountProjector('desktop')
    await api.enter()
    await nextTick()
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS)
    expect(api.uiVisible.value).toBe(false)

    await api.exit()
    await nextTick()
    expect(api.enabled.value).toBe(false)
    expect(api.effectiveDeviceMode.value).toBe('desktop')
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(wakeRelease).toHaveBeenCalled()
    expect(api.uiVisible.value).toBe(true)
  })

  it('Esc (системний вихід із fullscreen) вимикає режим сам', async () => {
    const { api } = mountProjector('desktop')
    await api.enter()
    await nextTick()
    expect(api.enabled.value).toBe(true)

    // Браузер вийшов із fullscreen без нашого exit()
    ;(document as any).fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
    await nextTick()
    expect(api.enabled.value).toBe(false)
  })

  it('toggle(): двічі = вимкнено; поза режимом шапка не ховається', async () => {
    const { api } = mountProjector('desktop')
    await api.toggle()
    await nextTick()
    expect(api.enabled.value).toBe(true)
    await api.toggle()
    await nextTick()
    expect(api.enabled.value).toBe(false)

    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 2)
    expect(api.uiVisible.value).toBe(true)
  })

  it('не викликає fullscreen повторно, якщо режим уже увімкнено', async () => {
    const { api } = mountProjector('desktop')
    await api.enter()
    await api.enter()
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
  })
})
