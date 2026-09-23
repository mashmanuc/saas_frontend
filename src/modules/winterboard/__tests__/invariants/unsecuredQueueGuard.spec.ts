/**
 * Вихід із дошки не губить чергу (SYSTEM_LAW §4–§5; рев'ю P0, 2026-09-24).
 * Перед зміною дошки (той самий маршрут, інший :id), виходом і reload черга має
 * лягти на сервер або в перевірену копію ЗАРАЗ. Не вийшло — вихід скасовано
 * (без «все одно піти»), reload — нативне попередження.
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
vi.mock('@/utils/notify', () => ({ notifyError: vi.fn(), notifyWarning: vi.fn() }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/core/auth/onAuthDeath', () => ({
  registerAuthDeathCleanup: vi.fn(() => () => {}),
  isAuthDead: vi.fn(() => false),
}))
vi.mock('../../telemetry/writePathTelemetry', () => ({ emitWritePathEvent: vi.fn() }))

import apiClient from '@/utils/apiClient'
import { notifyError } from '@/utils/notify'
import { useOpsSyncStore } from '../../stores/opsSyncStore'
import { useUnsecuredQueueGuard } from '../../composables/useUnsecuredQueueGuard'
import { readBackup } from '../../composables/useOpsBackup'
import { readBlocked } from '../../composables/useBlockedOps'

const post = apiClient.post as ReturnType<typeof vi.fn>
const notify = notifyError as unknown as ReturnType<typeof vi.fn>

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
  store.setBlockedOwner(null)
  store.sessionId = 'A'
  return { router, wrapper, store }
}

const op = (id: string) => ({ op_id: id, op_type: 'stroke_add', page_id: 'p1', payload: {} })

function blocked(store: ReturnType<typeof useOpsSyncStore>, storageOk: boolean) {
  store.saveBlock = {
    kind: 'unconfirmed', httpStatus: 0, reason: null, invalidOpIndex: null, invalidOpId: null,
    invalidOpType: null, retryNotBefore: null, at: 0, feBuild: '', storageOk, restored: false,
  }
  store.mode = 'SAVE_BLOCKED'
}

function breakStorage() {
  return vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError')
  })
}

beforeEach(() => {
  localStorage.clear()
  post.mockReset()
  notify.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('useUnsecuredQueueGuard', () => {
  it('SAVE_BLOCKED, сховище не пише: A → B і вихід скасовано БЕЗ «все одно піти», черга ціла', async () => {
    const { router, wrapper, store } = await setup()
    store.pendingOps = [op('x')]
    blocked(store, false)
    const spy = breakStorage()
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)
    await router.push('/winterboard/B')
    expect(router.currentRoute.value.params.id).toBe('A')
    await router.push('/other')
    expect(router.currentRoute.value.path).toBe('/winterboard/A')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(2)
    expect(store.pendingOps.map(o => o.op_id)).toEqual(['x'])
    spy.mockRestore()
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('SAVE_BLOCKED: копія «є», але нова дія ще чекає секундного запису → guard пише ЗАРАЗ, потім пускає', async () => {
    const { router, wrapper, store } = await setup()
    store.pendingOps = [op('old')]
    blocked(store, true)
    store.persistBlocked()
    store.pendingOps.push(op('fresh'))  // рекордер ще не встиг (таймер 1 с)
    await router.push('/other')
    expect(router.currentRoute.value.path).toBe('/other')
    const rec = readBlocked('A', null).records
    expect(rec).toHaveLength(1)
    expect(rec[0].record.pending.map(o => o.op_id)).toEqual(['old', 'fresh'])
    wrapper.unmount()
  })

  it('PAUSED: черга йде в перевірену копію перед виходом; сховище не пише → вихід скасовано', async () => {
    const { router, wrapper, store } = await setup()
    store.mode = 'PAUSED'
    store.pendingOps = [op('p1')]
    const spy = breakStorage()
    await router.push('/winterboard/B')
    expect(router.currentRoute.value.params.id).toBe('A')
    expect(store.hasUnsecuredQueue).toBe(true)
    spy.mockRestore()
    await router.push('/winterboard/B')
    expect(router.currentRoute.value.params.id).toBe('B')
    expect(readBackup<{ op_id: string }>('A')?.pending.map(o => o.op_id)).toEqual(['p1'])
    wrapper.unmount()
  })

  it('SYNC: черга дозливається на сервер перед виходом', async () => {
    const { router, wrapper, store } = await setup()
    store.mode = 'SYNC'
    store.pendingOps = [op('s1')]
    post.mockResolvedValueOnce({ data: { last_seq: 1, applied_count: 1 } })
    await router.push('/other')
    expect(router.currentRoute.value.path).toBe('/other')
    expect(store.mode).toBe('SYNC')
    expect(store.pendingOps).toHaveLength(0)
    expect(store.inFlightOps).toHaveLength(0)
    expect(post).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('reload / закриття: копія лягла синхронно → без попередження; не лягла → нативне попередження', async () => {
    const { wrapper, store } = await setup()
    store.mode = 'PAUSED'
    store.pendingOps = [op('u1')]
    const okEv = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(okEv)
    expect(okEv.defaultPrevented).toBe(false)
    expect(readBackup<{ op_id: string }>('A')?.pending.map(o => o.op_id)).toEqual(['u1'])
    const spy = breakStorage()
    store.pendingOps.push(op('u2'))
    const badEv = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(badEv)
    expect(badEv.defaultPrevented).toBe(true)
    spy.mockRestore()
    wrapper.unmount()
  })
})
