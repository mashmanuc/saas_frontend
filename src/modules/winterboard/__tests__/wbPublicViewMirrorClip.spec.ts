/**
 * Сторож обв'язки «Створити відеофрагмент» у плеєрі запису (ТЗ
 * TZ_LESSON_MIRROR_VIDEO_PILOT_2026-10-09 §2, §4):
 *  - кнопка лише на маршруті власника `/winterboard/replay/:replayId`, публічне посилання — без змін;
 *  - лише для пілотних акаунтів 40 і 220;
 *  - лише коли в записі є сторінка з ≥ 2 фото-фонами;
 *  - натискання відкриває діалог (лінивий імпорт), закриття — ховає його.
 *
 * WBPublicView важкий (Konva, рушій Replay), тому полотно, панель, око й рушій підмінено:
 * перевіряється саме обв'язка, а добір фото — справжній `collectMirrorPhotoPages`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BoardOperation } from '../types/replay'

const env = vi.hoisted(() => ({
  route: { name: 'winterboard-replay-owner', params: {} as Record<string, string>, query: {} as Record<string, string> },
  auth: { user: { id: 40 } as { id: number } | null },
  startState: null as { pages: unknown[]; currentPageIndex: number } | null,
  operations: [] as BoardOperation[],
  replayCalls: { pause: 0 },
}))

vi.mock('vue-router', () => ({
  useRoute: () => env.route,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}))

vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => env.auth }))

vi.mock('../api/replayLifecycleApi', () => ({
  getReplay: vi.fn(async (id: string) => ({
    id, title: 'Урок', source_session: 'sess-1', recorded_at: '2026-10-09T10:00:00Z', duration_ms: 1000,
    start_seq: 10, end_seq: 100, status: 'active', visibility: 'private', public_token: null,
    folder: null, view_count: 0, archived_at: null, trashed_at: null,
  })),
}))

vi.mock('../api/winterboardApi', () => {
  const session = { id: 'sess-1', name: 'Урок дзеркала', state: null, updated_at: '2026-10-09T10:00:00Z' }
  return { winterboardApi: { getSession: vi.fn(async () => session), getPublicSession: vi.fn(async () => session) } }
})

vi.mock('../composables/useReplayV2', async () => {
  const { ref: vueRef } = await import('vue')
  return {
    useReplayV2: () => ({
      async loadTimeline(_onOp: unknown, onStartState?: (s: unknown) => void) {
        if (env.startState && onStartState) onStartState(env.startState)
      },
      totalOperations: vueRef(env.operations.length),
      getOperationAt: (i: number) => env.operations[i] ?? null,
      isBatchingSeek: vueRef(false),
      seekCompleted: vueRef(false),
      state: vueRef('idle'),
      markers: vueRef([]),
      loadMarkers: async () => {},
      currentIndex: vueRef(0),
      currentViewMs: vueRef(0),
      totalViewMs: vueRef(1000),
      lessonDurationMs: vueRef(1000),
      epilogueStartedAt: vueRef(null),
      totalDurationMs: vueRef(1000),
      viewMsAtIndex: () => 0,
      lessonMsAtView: (ms: number) => ms,
      findIndexByViewMs: () => 0,
      async seekToWithSnapshot(_i: number, _load: unknown, reset: () => void) { reset() },
      play: () => {},
      pause: () => { env.replayCalls.pause++ },
      stop: () => {},
      destroy: () => {},
    }),
  }
})

// Фабрики vi.mock піднімаються над усім файлом — тож vue беремо всередині, без змінних модуля.
vi.mock('../components/canvas/WBCanvas.vue', async () => {
  const vue = await import('vue')
  return { default: vue.defineComponent({ name: 'WBCanvas', render: () => vue.h('div') }) }
})
vi.mock('../components/public/PublicReplayPlayer.vue', async () => {
  const vue = await import('vue')
  return { default: vue.defineComponent({ name: 'PublicReplayPlayer', render: () => vue.h('div') }) }
})
vi.mock('../components/public/PublicMarkersList.vue', async () => {
  const vue = await import('vue')
  return { default: vue.defineComponent({ name: 'PublicMarkersList', render: () => vue.h('div') }) }
})
vi.mock('../components/public/EyePlayer.vue', async () => {
  const vue = await import('vue')
  return { default: vue.defineComponent({ name: 'EyePlayer', render: () => vue.h('div') }) }
})
vi.mock('../components/replay/LessonMirrorExportDialog.vue', async () => {
  const vue = await import('vue')
  return {
    // defineAsyncComponent бере `.default` лише з ES-модуля — позначаємо підміну як модуль.
    __esModule: true,
    default: vue.defineComponent({
      name: 'LessonMirrorExportDialog',
      props: { pages: { type: Array, required: true }, lessonTitle: { type: String, default: '' } },
      emits: ['close'],
      setup(props, { emit }) {
        return () => vue.h('div', { 'data-testid': 'mirror-clip-dialog', 'data-pages': props.pages.length, 'data-title': props.lessonTitle }, [
          vue.h('button', { 'data-testid': 'mirror-clip-close', onClick: () => emit('close') }, '×'),
        ])
      },
    }),
  }
})

import WBPublicView from '../views/WBPublicView.vue'

const img = (n: number) => `https://cdn.test/mirror/${n}.jpg`
function photoOp(seq: number, n: number): BoardOperation {
  return {
    id: seq, seq, op_type: 'background_update', page_id: 'p1', user: 40,
    payload: { background: { type: 'image', url: img(n), prev: 'white' } },
    created_at: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
  }
}
const page = (id: string, background: unknown = 'white') => ({ id, name: id, strokes: [], assets: [], background })

/** Запис із двома фото на сторінці p1 (початковий фон + одна зміна фото). */
function twoPhotoRecording(): void {
  env.startState = { pages: [page('p1', { type: 'image', url: img(0) })], currentPageIndex: 0 }
  env.operations = [photoOp(12, 1)]
}

let wrapper: VueWrapper | null = null

async function mountView(): Promise<VueWrapper> {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(WBPublicView, { global: { plugins: [pinia] } })
  await flushPromises()
  await flushPromises()
  return wrapper
}

const openBtn = (w: VueWrapper) => w.find('[data-testid="mirror-clip-open"]')

beforeEach(() => {
  env.route = { name: 'winterboard-replay-owner', params: { replayId: 'r-1' }, query: {} }
  env.auth = { user: { id: 40 } }
  env.replayCalls.pause = 0
  twoPhotoRecording()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('WBPublicView — кнопка «Створити відеофрагмент» (пілот «Дзеркала уроку»)', () => {
  it('є для власника 40 на своєму записі з ≥ 2 фото — з текстом з i18n', async () => {
    const w = await mountView()
    expect(openBtn(w).exists()).toBe(true)
    expect(openBtn(w).text()).toBe('Створити відеофрагмент')
  })

  it('є і для власника 220 (другий контрольний акаунт)', async () => {
    env.auth = { user: { id: 220 } }
    const w = await mountView()
    expect(openBtn(w).exists()).toBe(true)
  })

  it('немає для іншого вчителя (не 40/220) навіть на його записі з фото', async () => {
    env.auth = { user: { id: 41 } }
    const w = await mountView()
    expect(openBtn(w).exists()).toBe(false)
  })

  it('немає на публічному посиланні, навіть якщо його відкрив власник 40', async () => {
    env.route = { name: 'winterboard-public', params: { token: 'tok-1' }, query: {} }
    const w = await mountView()
    expect(w.find('.wb-public-view__header').exists()).toBe(true)
    expect(openBtn(w).exists()).toBe(false)
  })

  it('немає, коли в записі лише одне фото на сторінці', async () => {
    env.startState = { pages: [page('p1', { type: 'image', url: img(0) })], currentPageIndex: 0 }
    env.operations = []
    const w = await mountView()
    expect(openBtn(w).exists()).toBe(false)
  })

  it('немає, коли друге фото лягло вже після кінця запису (end_seq)', async () => {
    env.operations = [photoOp(101, 1)]
    const w = await mountView()
    expect(openBtn(w).exists()).toBe(false)
  })

  it('натискання ставить відтворення на паузу й відкриває діалог із добраними сторінками; закриття ховає', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="mirror-clip-dialog"]').exists()).toBe(false)
    await openBtn(w).trigger('click')
    await flushPromises()
    const dialog = w.find('[data-testid="mirror-clip-dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('data-pages')).toBe('1')
    expect(dialog.attributes('data-title')).toBe('Урок дзеркала')
    expect(env.replayCalls.pause).toBe(1)
    await w.find('[data-testid="mirror-clip-close"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-dialog"]').exists()).toBe(false)
  })
})
