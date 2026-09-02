// usePushToTalk — слухає лише під кнопкою, без авторестарту, один onFinal на утримання.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

// `_SR` у composable читається при імпорті модуля, тому кожен тест робить
// vi.resetModules() + динамічний import ПІСЛЯ підміни window.SpeechRecognition.

class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  interimResults = true
  continuous = true
  maxAlternatives = 0
  onresult: ((e: any) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: any) => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => { this.onend?.() })
  abort = vi.fn()
  constructor() { FakeRecognition.instances.push(this) }
  emitFinal(text: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] })
  }
}

describe('usePushToTalk', () => {
  beforeEach(() => {
    FakeRecognition.instances = []
    ;(window as any).SpeechRecognition = FakeRecognition
  })
  afterEach(() => {
    delete (window as any).SpeechRecognition
    vi.resetModules()
  })

  it('press → одна сесія без continuous і без interim; release → stop', async () => {
    vi.resetModules()
    const mod = await import('../composables/usePushToTalk')
    let api!: ReturnType<typeof mod.usePushToTalk>
    const onFinal = vi.fn()
    mount(defineComponent({ setup() { api = mod.usePushToTalk({ onFinal }); return () => h('div') } }))

    expect(api.supported).toBe(true)
    api.press()
    const r = FakeRecognition.instances[0]
    expect(r.start).toHaveBeenCalledTimes(1)
    expect(r.continuous).toBe(false)
    expect(r.interimResults).toBe(false)
    expect(r.lang).toBe('uk-UA')
    expect(api.listening.value).toBe(true)

    r.emitFinal('наступна сторінка')
    api.release()
    expect(r.stop).toHaveBeenCalledTimes(1)
    expect(api.listening.value).toBe(false)
    expect(onFinal).toHaveBeenCalledTimes(1)
    expect(onFinal).toHaveBeenCalledWith('наступна сторінка')
  })

  it('нічого не сказано → onFinal не викликається', async () => {
    vi.resetModules()
    const mod = await import('../composables/usePushToTalk')
    let api!: ReturnType<typeof mod.usePushToTalk>
    const onFinal = vi.fn()
    mount(defineComponent({ setup() { api = mod.usePushToTalk({ onFinal }); return () => h('div') } }))
    api.press()
    api.release()
    expect(onFinal).not.toHaveBeenCalled()
  })

  it('без авторестарту: після onend start не викликається повторно', async () => {
    vi.resetModules()
    const mod = await import('../composables/usePushToTalk')
    let api!: ReturnType<typeof mod.usePushToTalk>
    mount(defineComponent({ setup() { api = mod.usePushToTalk({ onFinal: vi.fn() }); return () => h('div') } }))
    api.press()
    const r = FakeRecognition.instances[0]
    r.onend?.()   // браузер сам закрив сесію після тиші
    await new Promise((res) => setTimeout(res, 300))
    expect(r.start).toHaveBeenCalledTimes(1)
    expect(api.listening.value).toBe(false)
  })

  it('повторний press під час слухання — no-op', async () => {
    vi.resetModules()
    const mod = await import('../composables/usePushToTalk')
    let api!: ReturnType<typeof mod.usePushToTalk>
    mount(defineComponent({ setup() { api = mod.usePushToTalk({ onFinal: vi.fn() }); return () => h('div') } }))
    api.press()
    api.press()
    expect(FakeRecognition.instances[0].start).toHaveBeenCalledTimes(1)
  })

  it('not-allowed → onError; no-speech → тиша', async () => {
    vi.resetModules()
    const mod = await import('../composables/usePushToTalk')
    let api!: ReturnType<typeof mod.usePushToTalk>
    const onError = vi.fn()
    mount(defineComponent({ setup() { api = mod.usePushToTalk({ onFinal: vi.fn(), onError }); return () => h('div') } }))
    api.press()
    const r = FakeRecognition.instances[0]
    r.onerror?.({ error: 'no-speech' })
    expect(onError).not.toHaveBeenCalled()
    r.onerror?.({ error: 'not-allowed' })
    expect(onError).toHaveBeenCalledWith('not-allowed')
  })

  it('без Web Speech → supported=false, press безпечний', async () => {
    delete (window as any).SpeechRecognition
    vi.resetModules()
    const mod = await import('../composables/usePushToTalk')
    let api!: ReturnType<typeof mod.usePushToTalk>
    mount(defineComponent({ setup() { api = mod.usePushToTalk({ onFinal: vi.fn() }); return () => h('div') } }))
    expect(api.supported).toBe(false)
    expect(() => api.press()).not.toThrow()
    expect(api.listening.value).toBe(false)
  })
})
