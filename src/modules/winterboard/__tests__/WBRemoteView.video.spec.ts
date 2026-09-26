// Відео з пульта — V1 (2026-09-26): інтерфейс на телефоні.
// Гарантуємо: вибір без підтвердження дошку не змінює; «Додати» шле лише чистий ref;
// ▶/⏸ є лише коли на поточній сторінці є відео; невідома мова не підписана як
// українська; помилки пошуку, посилання й плеєра — зрозумілі тексти, не тиша.
// Канал, мікрофон, API і authStore підмінені (як у WBRemoteView.spec.ts); тексти —
// зі справжнього uk.json (заодно перевіряємо, що ключі існують).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
let onStateCb: ((s: any) => void) | null = null
vi.mock('../composables/useRemoteChannel', () => ({
  useRemoteChannel: (opts: any) => {
    onStateCb = opts.onState
    return {
      state: channelState, lastError: ref(null), sessionId: ref(null),
      connect: vi.fn(async () => { channelState.value = 'connected' }), disconnect: vi.fn(), retry: vi.fn(), send,
    }
  },
}))
let onFinalCb: ((t: string) => void) | null = null
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: (opts: any) => {
    onFinalCb = opts.onFinal
    return { supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }
  },
}))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { email: 't@m4sh.local' }, forceLogout: vi.fn() }) }))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => ({ enabled: false })) }))
const searchVideos = vi.fn()
const lookupVideo = vi.fn()
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getActiveRemoteSession: vi.fn(async () => ({ session_id: SID, name: 'Урок', ts: 1 })),
    searchVideos: (...a: any[]) => searchVideos(...a),
    lookupVideo: (...a: any[]) => lookupVideo(...a),
  },
}))

import WBRemoteView from '../views/WBRemoteView.vue'

const T = (uk as any).winterboard.remote.video
const cand = (id: string, title: string, audio = 'uk') => ({
  ref: { provider: 'youtube', id }, title, channel: 'Канал', thumbnail: 'https://i.ytimg.com/x.jpg',
  duration_s: 349, audio_language: audio, made_for_kids: false,
})
const httpError = (status: number, error: string) => Object.assign(new Error(error), { response: { status, data: { error } } })

const mounted: Array<{ unmount: () => void }> = []
async function ready(videos: any[] = []) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const w = mount(WBRemoteView, { global: { plugins: [i18n] } })
  mounted.push(w)
  await flushPromises()
  onStateCb!({ pair: PAIR, clientId: 'laptop', pageIndex: 0, pageCount: 2, videos })
  await flushPromises()
  return w
}
const lastCmd = () => {
  const cmds = send.mock.calls.map((c) => c[0] as any).filter((m) => m.cmd !== 'hello')
  return cmds[cmds.length - 1] ?? null
}

describe('WBRemoteView — відео (V1)', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear(); searchVideos.mockReset(); lookupVideo.mockReset()
    onStateCb = null; onFinalCb = null
  })
  afterEach(() => { while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* */ } } })

  it('сторінка без відео — ▶/⏸ немає; з відео — є', async () => {
    const w = await ready([])
    expect(w.find('.wb-remote__video-ctl').exists()).toBe(false)
    onStateCb!({ pair: PAIR, clientId: 'laptop', pageIndex: 0, pageCount: 2, videos: [{ objectId: 'yt-1', title: 'Теорема', state: 'idle' }] })
    await flushPromises()
    expect(w.find('.wb-remote__video-ctl').exists()).toBe(true)
  })

  it('пошук → вибір показує прев\'ю, але НЕ шле команду; «Додати» шле лише ref і назву', async () => {
    searchVideos.mockResolvedValue({ items: [cand('EaN-JbyA348', 'Теорема Піфагора'), cand('7tzXqwD9fhs', 'Геометрія', 'unknown')], dropped: {}, pool: 15, took_ms: 1 })
    const w = await ready()
    await w.find('.wb-remote__video-search input').setValue('теорема Піфагора')
    await w.find('.wb-remote__video-search').trigger('submit')
    await flushPromises()
    expect(searchVideos).toHaveBeenCalledWith('теорема Піфагора')
    const items = w.findAll('.wb-remote__video-results .wb-remote__video-item')
    expect(items).toHaveLength(2)
    // невідома мова — позначена, українська — без мітки
    expect(items[0].find('.wb-remote__video-lang').exists()).toBe(false)
    expect(items[1].find('.wb-remote__video-lang').text()).toBe(T.langUnknown)
    await items[0].trigger('click')
    expect(w.find('.wb-remote__video-confirm').exists()).toBe(true)
    expect(lastCmd()).toBeNull()                      // дошка не змінюється до підтвердження
    const add = w.findAll('.wb-remote__video-confirm button').find((b) => b.text() === T.add)!
    await add.trigger('click')
    expect(lastCmd()).toMatchObject({ type: 'remote.command', pair: PAIR, cmd: 'video.add', args: { ref: { provider: 'youtube', id: 'EaN-JbyA348' }, title: 'Теорема Піфагора' } })
  })

  it('вичерпано пошук → радимо вставити посилання', async () => {
    searchVideos.mockRejectedValue(httpError(429, 'video_search_quota'))
    const w = await ready()
    await w.find('.wb-remote__video-search input').setValue('похідна')
    await w.find('.wb-remote__video-search').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain(T.quota)
  })

  it('посилання → перевірка → прев\'ю → «Додати»', async () => {
    lookupVideo.mockResolvedValue(cand('6s8oFjL-2Eg', 'Площа трапеції'))
    const w = await ready()
    await w.find('.wb-remote__video-link input').setValue('https://youtu.be/6s8oFjL-2Eg?si=abc')
    await w.find('.wb-remote__video-link').trigger('submit')
    await flushPromises()
    expect(lookupVideo).toHaveBeenCalledWith('https://youtu.be/6s8oFjL-2Eg?si=abc')
    expect(w.find('.wb-remote__video-item--preview').text()).toContain('Площа трапеції')
    await w.findAll('.wb-remote__video-confirm button').find((b) => b.text() === T.add)!.trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'video.add', args: { ref: { provider: 'youtube', id: '6s8oFjL-2Eg' } } })
  })

  it.each([
    ['video_lookup_invalid_link', 'invalid_link'],
    ['video_lookup_not_found', 'not_found'],
    ['video_lookup_russian', 'russian'],
    ['video_lookup_not_embeddable', 'not_embeddable'],
    ['video_lookup_something_new', 'failed'],
  ])('помилка перевірки %s → зрозумілий текст', async (code, key) => {
    lookupVideo.mockRejectedValue(httpError(422, code))
    const w = await ready()
    await w.find('.wb-remote__video-link input').setValue('https://youtu.be/xxxxxxxxxxx')
    await w.find('.wb-remote__video-link').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain(T.lookupError[key])
    expect(w.find('.wb-remote__video-confirm').exists()).toBe(false)
  })

  it('▶/⏸ шлють команду для вибраного відео; кілька відео — вибір за назвою', async () => {
    const w = await ready([
      { objectId: 'yt-1', title: 'Теорема', state: 'idle' },
      { objectId: 'yt-2', title: 'Трапеція', state: 'idle' },
    ])
    expect(w.findAll('.wb-remote__video-pick option').map((o) => o.text())).toEqual(['Теорема', 'Трапеція'])
    await w.find('.wb-remote__video-pick').setValue('yt-1')
    await w.findAll('.wb-remote__video-ctl button').find((b) => b.text().includes('▶'))!.trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'video.play', args: { object_id: 'yt-1' } })
    await w.findAll('.wb-remote__video-ctl button').find((b) => b.text().includes('⏸'))!.trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'video.pause', args: { object_id: 'yt-1' } })
  })

  it('заблоковано браузером і помилка плеєра — зрозумілі тексти', async () => {
    const w = await ready([{ objectId: 'yt-1', title: 'Т', state: 'blocked' }])
    expect(w.find('.wb-remote__video-blocked').text()).toBe(T.blocked)
    onStateCb!({ pair: PAIR, clientId: 'laptop', pageIndex: 0, pageCount: 2, videos: [{ objectId: 'yt-1', title: 'Т', state: 'error', error: 'not_embeddable' }] })
    await flushPromises()
    expect(w.find('.wb-remote__video-blocked').text()).toBe(T.playerError.not_embeddable)
  })

  it('голос «знайди відео про …» шукає тут, на пульті', async () => {
    searchVideos.mockResolvedValue({ items: [], dropped: {}, pool: 0, took_ms: 1 })
    await ready()
    onFinalCb!('Знайди відео про теорему Піфагора')
    await flushPromises()
    expect(searchVideos).toHaveBeenCalledWith('теорему Піфагора')
    expect(lastCmd()).toBeNull()   // фраза НЕ пішла Інтегралику на ноутбук
  })
})
