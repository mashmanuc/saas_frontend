/**
 * TLV2-G1b · OpsPausedBanner — видимий PAUSED і «Повторити зараз» (SYSTEM_LAW §5).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/utils/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  isCircuitBreakerOpen: vi.fn(() => false),
}))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/utils/notify', () => ({ notifyWarning: vi.fn(), notifyError: vi.fn() }))
vi.mock('@/core/auth/onAuthDeath', () => ({
  registerAuthDeathCleanup: vi.fn(() => () => {}),
  isAuthDead: vi.fn(() => false),
}))

import apiClient from '@/utils/apiClient'
import OpsPausedBanner from '../components/dialogs/OpsPausedBanner.vue'
import { useOpsSyncStore } from '../stores/opsSyncStore'
import { useReplayRecorder } from '../composables/useReplayRecorder'

const SID = '00000000-0000-0000-0000-0000000000c3'
const post = apiClient.post as ReturnType<typeof vi.fn>

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: { uk: { winterboard: { errors: { paused: {
    bannerLabel: 'Сервер зайнятий',
    title: 'Сервер тимчасово зайнятий — зміни збережено в черзі',
    hint: 'Дій у черзі: {count}. Спроба відправити — автоматично раз на {seconds} с.',
    retry: 'Повторити зараз',
    retrying: 'Відправляємо…',
  } } } } },
})

function busy() {
  return Object.assign(new Error('Request failed with status code 503'), {
    response: { status: 503, data: { error: 'SERVER_BUSY' } },
  })
}

async function pausedStoreWithOps(n: number) {
  const store = useOpsSyncStore()
  store.sessionId = SID
  store.mode = 'SYNC'
  for (let i = 0; i < n; i++) {
    store.record({ op_id: `op-${i}`, op_type: 'stroke_add', page_id: 'p1', payload: {} })
  }
  for (let i = 0; i < 3; i++) {
    post.mockRejectedValueOnce(busy())
    await expect(store.flush()).rejects.toThrow('503')
    if (store.retryUntil !== null) await vi.advanceTimersByTimeAsync(store.retryUntil - Date.now())
  }
  return store
}

beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  post.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

function mountBanner() {
  return mount(OpsPausedBanner, { global: { plugins: [i18n] } })
}

describe('OpsPausedBanner', () => {
  it('у SYNC банера немає', () => {
    const store = useOpsSyncStore()
    store.mode = 'SYNC'
    expect(mountBanner().find('.wb-paused-banner').exists()).toBe(false)
  })

  it('у PAUSED видно заголовок, кількість дій у черзі й інтервал автоспроби', async () => {
    const store = await pausedStoreWithOps(2)
    store.record({ op_id: 'op-late', op_type: 'stroke_add', page_id: 'p1', payload: {} })
    const w = mountBanner()
    expect(w.find('.wb-paused-banner').exists()).toBe(true)
    expect(w.text()).toContain('Сервер тимчасово зайнятий')
    expect(w.text()).toContain('Дій у черзі: 3. Спроба відправити — автоматично раз на 30 с.')
  })

  it('«Повторити зараз» → один запит; поки він у мережі — кнопка неактивна; успіх ховає банер', async () => {
    const store = await pausedStoreWithOps(1)
    const recorder = useReplayRecorder({ sessionId: ref(SID), getBoardState: () => ({}) })
    const w = mountBanner()

    let release!: (v: unknown) => void
    post.mockImplementationOnce(() => new Promise(res => { release = res }))
    await w.find('.wb-paused-banner__btn').trigger('click')
    await w.find('.wb-paused-banner__btn').trigger('click')

    const btn = w.find('.wb-paused-banner__btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.text()).toBe('Відправляємо…')
    expect(post).toHaveBeenCalledTimes(4)

    release({ data: { last_seq: 1, applied_count: 1 } })
    await vi.advanceTimersByTimeAsync(0)
    await w.vm.$nextTick()
    expect(store.mode).toBe('SYNC')
    expect(w.find('.wb-paused-banner').exists()).toBe(false)
    recorder.destroy()
  })
})
