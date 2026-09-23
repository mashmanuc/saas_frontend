/**
 * SAVE_BLOCKED + `storage_failed` (SYSTEM_LAW §4): черга лише в пам'яті вкладки.
 * Зміна дошки (той самий маршрут, інший :id), вихід із кімнати й reload її знищують —
 * тому лише з підтвердженням (рев'ю P0, 2026-09-24).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/utils/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  isCircuitBreakerOpen: vi.fn(() => false),
}))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/core/auth/onAuthDeath', () => ({
  registerAuthDeathCleanup: vi.fn(() => () => {}),
  isAuthDead: vi.fn(() => false),
}))

import { useOpsSyncStore } from '../../stores/opsSyncStore'
import { useUnsecuredQueueGuard } from '../../composables/useUnsecuredQueueGuard'

const Room = defineComponent({
  setup() {
    useUnsecuredQueueGuard()
    return () => h('div', 'room')
  },
})
const Other = defineComponent({ render: () => h('div', 'other') })

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/winterboard/:id', name: 'winterboard-solo', component: Room },
      { path: '/other', component: Other },
    ],
  })
  await router.push('/winterboard/A')
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [router, pinia] } })
  const store = useOpsSyncStore()
  return { router, wrapper, store }
}

function makeUnsecured(store: ReturnType<typeof useOpsSyncStore>) {
  store.sessionId = 'A'
  store.pendingOps = [{ op_id: 'x', op_type: 'stroke_add', page_id: 'p1', payload: {} }]
  store.saveBlock = {
    kind: 'unconfirmed', httpStatus: 0, reason: null, invalidOpIndex: null, invalidOpId: null,
    invalidOpType: null, retryNotBefore: null, at: 0, feBuild: '', storageOk: false, restored: false,
  }
  store.mode = 'SAVE_BLOCKED'
}

let confirmSpy: ReturnType<typeof vi.fn>
beforeEach(() => {
  confirmSpy = vi.fn(() => false)
  vi.stubGlobal('confirm', confirmSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useUnsecuredQueueGuard', () => {
  it('черга без копії: зміна дошки (A → B) і вихід скасовуються без підтвердження', async () => {
    const { router, wrapper, store } = await setup()
    makeUnsecured(store)
    expect(store.hasUnsecuredQueue).toBe(true)
    await router.push('/winterboard/B')
    expect(router.currentRoute.value.params.id).toBe('A')
    await router.push('/other')
    expect(router.currentRoute.value.path).toBe('/winterboard/A')
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    expect(store.pendingOps).toHaveLength(1)
    wrapper.unmount()
  })

  it('учитель підтвердив → перехід дозволено', async () => {
    const { router, wrapper, store } = await setup()
    makeUnsecured(store)
    confirmSpy.mockReturnValue(true)
    await router.push('/winterboard/B')
    expect(router.currentRoute.value.params.id).toBe('B')
    wrapper.unmount()
  })

  it('reload / закриття вкладки → нативне попередження браузера', async () => {
    const { wrapper, store } = await setup()
    const idle = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(idle)
    expect(idle.defaultPrevented).toBe(false)
    makeUnsecured(store)
    const ev = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('копія є (storageOk) або черга порожня → без питань', async () => {
    const { router, wrapper, store } = await setup()
    makeUnsecured(store)
    store.saveBlock = { ...store.saveBlock!, storageOk: true }
    await router.push('/winterboard/B')
    expect(router.currentRoute.value.params.id).toBe('B')
    expect(confirmSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
