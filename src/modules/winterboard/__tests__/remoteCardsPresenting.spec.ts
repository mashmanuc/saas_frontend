/**
 * Дефект із живого уроку: на пульті ▲/▼ лишались неактивні (LAW §9 v1.7, INV-27).
 *
 * ЧОМУ ЖОДЕН ТЕСТ ЙОГО НЕ ЛОВИВ
 *
 * Усі чотири ланки були правильні ПООДИНЦІ:
 *   1. `useRemoteViewAdapter.summary()` рахував `presenting`;
 *   2. ноутбук клав його в `remote.state`;
 *   3. `WBRemoteView` читав `cards.presenting` і вмикав ▲/▼;
 *   4. тип `RemoteStateDetail` це поле оголошував.
 * А парсер телефона збирав `cards` із трьох полів — і четверте зникало.
 *
 * Тому тест іде НАСКРІЗЬ, а не перевіряє ланки окремо:
 *   summary() → JSON (як на дроті) → parseRemoteCards() → WBRemoteView → ▲/▼
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { createRemoteViewAdapter, TASK_ASSET_TYPE } from '../composables/useRemoteViewAdapter'
import { parseRemoteCards } from '../composables/useRemoteChannel'
import { resetTutorGate } from '../composables/useStudentTutor'
import { resetNmtPresentationScales } from '../composables/useNmtPresentationScale'
import { derivePair } from '../remote/remotePair'

// ── канал підмінений, але РОЗБІР справжній: саме в ньому був дефект ─────────
const channelState = ref<'idle' | 'connected' | 'disconnected'>('idle')
let onStateCb: ((s: any) => void) | null = null
vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useRemoteChannel')>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      return {
        state: channelState, lastError: ref(null), sessionId: ref(null),
        connect: vi.fn(async () => { channelState.value = 'connected' }),
        disconnect: vi.fn(), retry: vi.fn(), send: vi.fn(() => true),
      }
    },
  }
})

vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: false, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { email: 't@m4sh.local' }, forceLogout: vi.fn() }),
}))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: { getActiveRemoteSession: vi.fn(async () => ({ session_id: SID, name: 'Дошка', ts: 1 })) },
}))

function taskCard(id: string, x: number, y: number) {
  return { id, type: TASK_ASSET_TYPE, x, y, w: 400, h: 200, data: { externalId: id } }
}

function makeStore(assets: any[]) {
  const store: any = {
    containerWidth: 1000, containerHeight: 600,
    pageWidth: 2000, pageHeight: 1500,
    zoom: 1, scrollX: 0, scrollY: 0,
    expandedAssetId: null, currentPageIndex: 0,
    pages: [{ assets }],
    setZoom: vi.fn((z: number) => { store.zoom = z }),
    setScroll: vi.fn((x: number, y: number) => { store.scrollX = x; store.scrollY = y }),
    updateAsset: vi.fn(),
  }
  return store
}

/** Те, що ноутбук реально кладе в `remote.state` (`useBoardRemote.ts`). */
function wireFormat(summary: ReturnType<ReturnType<typeof createRemoteViewAdapter>['summary']>) {
  return JSON.parse(JSON.stringify({
    count: summary.count, answer: summary.answer,
    solution: summary.solution, presenting: summary.presenting,
  }))
}

beforeEach(() => {
  resetTutorGate()
  resetNmtPresentationScales()
  channelState.value = 'idle'
  onStateCb = null
})
afterEach(() => vi.clearAllMocks())

describe('ноутбук рахує presenting', () => {
  it('поки картку не розгорнуто — false', () => {
    const v = createRemoteViewAdapter(makeStore([taskCard('a', 100, 300)]))
    expect(v.summary().presenting).toBe(false)
  })

  it('після «Задача на екран» — true', () => {
    const store = makeStore([taskCard('a', 100, 300)])
    const v = createRemoteViewAdapter(store)
    v.fitTask()
    expect(store.expandedAssetId).toBe('a')
    expect(v.summary().presenting).toBe(true)
  })
})

describe('парсер телефона більше не губить поле', () => {
  it('presenting доходить крізь JSON — саме тут був дефект', () => {
    const store = makeStore([taskCard('a', 100, 300)])
    const v = createRemoteViewAdapter(store)
    v.fitTask()
    const parsed = parseRemoteCards(wireFormat(v.summary()))
    expect(parsed).toBeTruthy()
    expect(parsed!.presenting).toBe(true)
    expect(parsed!.count).toBe(1)
  })

  it('зіпсоване значення відкидається, решта стану лишається валідною', () => {
    for (const bad of ['true', 1, null, {}, undefined]) {
      const parsed = parseRemoteCards({ count: 3, answer: true, solution: false, presenting: bad })
      expect(parsed!.count).toBe(3)
      expect(parsed!.answer).toBe(true)
      expect(parsed!.solution).toBe(false)
      expect(parsed).not.toHaveProperty('presenting')
    }
  })

  it('старий ноутбук без поля не ламає пульт', () => {
    const parsed = parseRemoteCards({ count: 2, answer: null, solution: null })
    expect(parsed!.count).toBe(2)
    expect(parsed).not.toHaveProperty('presenting')
  })
})

describe('пульт: ▲/▼ активні саме в режимі показу', () => {
  async function mountRemote() {
    const WBRemoteView = (await import('../views/WBRemoteView.vue')).default
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
    const w = mount(WBRemoteView, { global: { plugins: [i18n], stubs: { RouterLink: true } } })
    await flushPromises()
    channelState.value = 'connected'
    await nextTick()
    return w
  }

  const arrows = (w: any) => w.findAll('.wb-remote__mini')
    .filter((b: any) => ['▲', '▼'].includes(b.text()))

  it('увесь ланцюг: summary → дріт → парсер → пульт, кнопки живі', async () => {
    const w = await mountRemote()
    const store = makeStore([taskCard('a', 100, 300)])
    const v = createRemoteViewAdapter(store)
    v.fitTask()

    onStateCb!({ pair: PAIR, pageIndex: 0, pageCount: 1,
                 cards: parseRemoteCards(wireFormat(v.summary())) })
    await nextTick()

    const up = arrows(w)
    expect(up).toHaveLength(2)
    for (const btn of up) expect(btn.attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('без режиму показу кнопки лишаються неактивні — це не регрес, а задум', async () => {
    const w = await mountRemote()
    const store = makeStore([taskCard('a', 100, 300)])
    const v = createRemoteViewAdapter(store)

    onStateCb!({ pair: PAIR, pageIndex: 0, pageCount: 1,
                 cards: parseRemoteCards(wireFormat(v.summary())) })
    await nextTick()

    for (const btn of arrows(w)) expect(btn.attributes('disabled')).toBeDefined()
    w.unmount()
  })
})
