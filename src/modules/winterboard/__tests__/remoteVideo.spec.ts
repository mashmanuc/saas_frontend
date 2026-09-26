/**
 * Відео з пульта — V1 (2026-09-26, на основі прототипу 2026-09-25).
 *
 * Що гарантуємо:
 *  - ноутбук виконує video.* лише як намір через адаптер кімнати; стан пульта несе `videos`;
 *  - телефон розбирає `videos` (з причиною помилки) і відкидає зіпсоване;
 *  - «знайди відео про …» розпізнається, інші фрази — ні;
 *  - плеєр — ЛИШЕ документований YT.Player: заблокований браузером старт → `blocked`
 *    (не мовчазна невдача), перший дотик людини → один запуск; помилки плеєра →
 *    `error` з причиною; пауза знімає очікування.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, reactive, nextTick, defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useBoardRemote, type RemoteMediaAdapter, type RemoteVideoState } from '../composables/useBoardRemote'
import { derivePair } from '../remote/remotePair'
import { parseRemoteVideos } from '../composables/useRemoteChannel'
import { matchVideoSearchPhrase } from '../remote/videoSearchPhrase'
import {
  registerYouTubeFrame, playVideo, pauseVideo, ytPlayStates, ytPlayErrors, unregisterYouTubeFrame,
  loadYouTubeIframeApi, START_CHECK_MS, __resetYouTubeRemoteControlForTests,
} from '../board/youtubeRemoteControl'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const mounted: Array<{ unmount: () => void }> = []

function setup(withMedia = true) {
  const store = reactive({ currentPageIndex: 0, pageCount: 2, goToPage: vi.fn(), addPage: vi.fn() })
  const list = ref<RemoteVideoState[]>([])
  const media: RemoteMediaAdapter = {
    list: () => list.value,
    add: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
  }
  const sendMessage = vi.fn()
  const wrapper = mount(defineComponent({
    setup() {
      useBoardRemote({
        sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true),
        ...(withMedia ? { media } : {}),
      })
      return () => h('div')
    },
  }))
  mounted.push(wrapper)
  return { media, list, sendMessage }
}

function fire(cmd: string, args: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent('wb:remote-command', {
    detail: { userId: '1', pair: derivePair(SID), clientId: 'phone', cmd, args },
  }))
}

function lastState(sendMessage: ReturnType<typeof vi.fn>) {
  const calls = sendMessage.mock.calls.map((c) => c[0]).filter((m) => m.type === 'remote.state')
  return calls[calls.length - 1]
}

describe('ноутбук: video.* через адаптер кімнати', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* вже знято */ } }
    vi.useRealTimers()
  })

  it('video.add → картку ставить кімната (ref + назва), пульт не пише сам', () => {
    const { media } = setup()
    fire('video.add', { ref: { provider: 'youtube', id: 'EaN-JbyA348' }, title: 'Теорема Піфагора' })
    expect(media.add).toHaveBeenCalledWith({ provider: 'youtube', id: 'EaN-JbyA348' }, 'Теорема Піфагора')
  })

  it('без адаптера відеокоманди ігноруються', () => {
    const { sendMessage } = setup(false)
    fire('video.add', { ref: { provider: 'youtube', id: 'x' } })
    fire('video.play', { object_id: 'yt-1' })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('▶/⏸ → адаптер + свіжий стан із відео поточної сторінки', () => {
    const { media, list, sendMessage } = setup()
    list.value = [{ object_id: 'yt-1', title: 'Теорема Піфагора', state: 'idle' }]
    fire('hello')
    expect(lastState(sendMessage).videos).toEqual(list.value)
    fire('video.play', { object_id: 'yt-1' })
    expect(media.play).toHaveBeenCalledWith('yt-1')
    fire('video.pause', { object_id: 'yt-1' })
    expect(media.pause).toHaveBeenCalledWith('yt-1')
  })

  it('стан відео змінився (напр. blocked) → пульт дізнається без запиту', async () => {
    const { list, sendMessage } = setup()
    fire('hello')
    const before = sendMessage.mock.calls.length
    list.value = [{ object_id: 'yt-1', title: 'Т', state: 'blocked' }]
    await nextTick()
    vi.advanceTimersByTime(200)
    expect(sendMessage.mock.calls.length).toBeGreaterThan(before)
    expect(lastState(sendMessage).videos[0].state).toBe('blocked')
  })
})

describe('телефон: розбір videos', () => {
  it('валідний список → наш формат', () => {
    expect(parseRemoteVideos([{ object_id: 'yt-1', title: 'Т', state: 'playing' }]))
      .toEqual([{ objectId: 'yt-1', title: 'Т', state: 'playing' }])
  })
  it('зіпсоване → поле відкинуто', () => {
    expect(parseRemoteVideos([{ object_id: 'yt-1', state: 'boom' }])).toBeUndefined()
    expect(parseRemoteVideos('x')).toBeUndefined()
  })
  it('error несе причину; причина без error або невідома — ігнорується', () => {
    expect(parseRemoteVideos([{ object_id: 'yt-1', title: 'Т', state: 'error', error: 'not_embeddable' }]))
      .toEqual([{ objectId: 'yt-1', title: 'Т', state: 'error', error: 'not_embeddable' }])
    expect(parseRemoteVideos([{ object_id: 'yt-1', title: 'Т', state: 'playing', error: 'not_found' }]))
      .toEqual([{ objectId: 'yt-1', title: 'Т', state: 'playing' }])
    expect(parseRemoteVideos([{ object_id: 'yt-1', title: 'Т', state: 'error', error: 'hack' }]))
      .toEqual([{ objectId: 'yt-1', title: 'Т', state: 'error' }])
  })
})

describe('фраза «знайди відео про …»', () => {
  it.each([
    ['Знайди відео про теорему Піфагора', 'теорему Піфагора'],
    ['Інтегралику, знайди відео про похідну.', 'похідну'],
    ['пошукай ролик на тему площа трапеції', 'площа трапеції'],
    ['покажи мені відео квадратні рівняння', 'квадратні рівняння'],
  ])('%s → %s', (phrase, query) => {
    expect(matchVideoSearchPhrase(phrase)).toBe(query)
  })
  it.each(['наступна сторінка', 'покажи відповідь', 'знайди відео', 'що таке похідна'])('%s → не пошук відео', (phrase) => {
    expect(matchVideoSearchPhrase(phrase)).toBeNull()
  })
})

describe('плеєр: лише документований YT.Player', () => {
  class FakePlayer {
    static last: FakePlayer | null = null
    playVideo = vi.fn()
    pauseVideo = vi.fn()
    constructor(public frame: HTMLIFrameElement, public opts: { events: Record<string, (e: any) => void> }) {
      FakePlayer.last = this
    }
    ready() { this.opts.events.onReady?.({ target: this }) }
    state(s: number) { this.opts.events.onStateChange?.({ data: s }) }
    error(code: number) { this.opts.events.onError?.({ data: code }) }
  }
  let frame: HTMLIFrameElement
  const setActivation = (active: boolean) => Object.defineProperty(navigator, 'userActivation', {
    value: { hasBeenActive: active, isActive: false }, configurable: true,
  })
  const player = () => FakePlayer.last!

  beforeEach(async () => {
    vi.useFakeTimers()
    FakePlayer.last = null
    ;(window as any).YT = { Player: FakePlayer }
    frame = document.createElement('iframe')
    document.body.appendChild(frame)
    registerYouTubeFrame('yt-1', frame)
    await flushPromises()
  })
  afterEach(() => {
    __resetYouTubeRemoteControlForTests()
    frame.remove()
    delete (window as any).YT
    delete (navigator as unknown as Record<string, unknown>).userActivation
    vi.useRealTimers()
  })

  it('підключається до iframe картки через YT.Player', () => {
    expect(player().frame).toBe(frame)
    expect(Object.keys(player().opts.events).sort()).toEqual(['onError', 'onReady', 'onStateChange'])
  })

  it('▶ раніше, ніж плеєр готовий — виконується в onReady рівно раз', () => {
    setActivation(true)
    playVideo('yt-1')
    expect(player().playVideo).not.toHaveBeenCalled()
    player().ready()
    expect(player().playVideo).toHaveBeenCalledTimes(1)
    player().state(1)
    expect(ytPlayStates['yt-1']).toBe('playing')
  })

  it('вкладку не чіпали → blocked; перший дотик людини запускає ОДИН раз', () => {
    player().ready()
    setActivation(false)
    playVideo('yt-1')
    vi.advanceTimersByTime(START_CHECK_MS)
    expect(ytPlayStates['yt-1']).toBe('blocked')
    setActivation(true)
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('pointerdown'))
    expect(player().playVideo).toHaveBeenCalledTimes(2)   // спроба з пульта + одна від дотику
    player().state(1)
    expect(ytPlayStates['yt-1']).toBe('playing')
  })

  it('⏸ під час blocked знімає очікування: дотик більше нічого не запускає', () => {
    player().ready()
    setActivation(false)
    playVideo('yt-1')
    vi.advanceTimersByTime(START_CHECK_MS)
    pauseVideo('yt-1')
    expect(ytPlayStates['yt-1']).toBe('idle')
    window.dispatchEvent(new Event('pointerdown'))
    expect(player().playVideo).toHaveBeenCalledTimes(1)
    expect(player().pauseVideo).toHaveBeenCalledTimes(1)
  })

  it.each([
    [150, 'not_embeddable'],
    [101, 'not_embeddable'],
    [100, 'not_found'],
    [5, 'playback'],
  ])('помилка плеєра %i → error з причиною %s; ▶ після неї не шлеться', (code, reason) => {
    player().ready()
    player().error(code)
    expect(ytPlayStates['yt-1']).toBe('error')
    expect(ytPlayErrors['yt-1']).toBe(reason)
    expect(playVideo('yt-1')).toBe(false)
    expect(player().playVideo).not.toHaveBeenCalled()
  })

  it('зняття картки прибирає стан і НЕ руйнує iframe (ним керує Vue)', () => {
    unregisterYouTubeFrame('yt-1', frame)
    expect(ytPlayStates['yt-1']).toBeUndefined()
    expect(frame.isConnected).toBe(true)
    expect(playVideo('yt-1')).toBe(false)
  })
})

describe('завантаження API плеєра', () => {
  afterEach(() => {
    __resetYouTubeRemoteControlForTests()
    document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').forEach((el) => el.remove())
    delete (window as any).YT
    delete (window as any).onYouTubeIframeAPIReady
  })

  it('один <script src=iframe_api>, готовність — через onYouTubeIframeAPIReady', async () => {
    const a = loadYouTubeIframeApi()
    const b = loadYouTubeIframeApi()
    expect(document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').length).toBe(1)
    ;(window as any).YT = { Player: class {} }
    window.onYouTubeIframeAPIReady?.()
    await expect(a).resolves.toBe((window as any).YT)
    await expect(b).resolves.toBe((window as any).YT)
  })
})
