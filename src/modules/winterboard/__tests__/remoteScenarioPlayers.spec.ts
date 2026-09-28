/**
 * «Сценарій» §4.2 (LAW §9 v1.15): програвачі дошки з пульта.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * До v1.15 пульт керував лише YouTube. Відео-файл і аудіо грали рідними кнопками, і
 * застосунок не знав, грають вони чи ні. Тепер пульт показує стан і гучність — тож стан
 * мусить іти з ПОДІЙ елемента (рідні кнопки теж оновлюють пульт), а звук без жесту — не
 * маскуватись повтором (LAW §12), а ставати `blocked` із запуском першим дотиком.
 *
 * ІНВАРІАНТИ
 *   INV-PLY-1  стан HTML-програвача — з подій елемента (play/pause/ended/error/volumechange)
 *   INV-PLY-2  ▶ без жесту → `blocked`; перший дотик людини запускає РІВНО раз; ⏸ скасовує
 *   INV-PLY-3  гучність: ±10 п.п. від ПОТОЧНОГО значення, межі 0…100; вимкнений звук —
 *              «Гучніше» спершу вмикає (з нуля — одразу 10 %)
 *   INV-PLY-4  YouTube: гучність — документовані методи; поки плеєр не готовий — поля
 *              гучності немає й команда ігнорується
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  __resetHtmlMediaRemoteControlForTests, changeMediaVolume, mediaPlayErrors, mediaPlayStates, mediaVolumes,
  pauseMedia, playMedia, registerMediaElement, unregisterMediaElement,
} from '../board/htmlMediaRemoteControl'
import {
  __resetYouTubeRemoteControlForTests, changeVideoVolume, registerYouTubeFrame, ytVolumes,
} from '../board/youtubeRemoteControl'

function media(tag: 'audio' | 'video' = 'audio', play: () => Promise<void> = () => Promise.resolve()) {
  const el = document.createElement(tag) as HTMLMediaElement
  const playSpy = vi.fn(play)
  const pauseSpy = vi.fn()
  Object.defineProperty(el, 'play', { value: playSpy, configurable: true })
  Object.defineProperty(el, 'pause', { value: pauseSpy, configurable: true })
  return { el, playSpy, pauseSpy }
}

const blockedPlay = () => Promise.reject(new DOMException('no gesture', 'NotAllowedError'))

afterEach(() => { __resetHtmlMediaRemoteControlForTests() })

describe('INV-PLY-1 · стан відео-файлу й аудіо — з подій елемента', () => {
  it('реєстрація: idle і чутна гучність; події змінюють стан; зняття — стан прибрано', () => {
    const { el } = media()
    el.volume = 0.6
    registerMediaElement('aud-1', el)
    expect(mediaPlayStates['aud-1']).toBe('idle')
    expect(mediaVolumes['aud-1']).toBe(60)

    el.dispatchEvent(new Event('play'))
    expect(mediaPlayStates['aud-1']).toBe('playing')
    el.dispatchEvent(new Event('pause'))
    expect(mediaPlayStates['aud-1']).toBe('paused')
    el.dispatchEvent(new Event('ended'))
    expect(mediaPlayStates['aud-1']).toBe('ended')
    el.dispatchEvent(new Event('error'))
    expect(mediaPlayStates['aud-1']).toBe('error')
    expect(mediaPlayErrors['aud-1']).toBe('playback')

    // рідний повзунок гучності на ноутбуці → пульт бачить нове число
    el.volume = 0.35
    el.dispatchEvent(new Event('volumechange'))
    expect(mediaVolumes['aud-1']).toBe(35)
    el.muted = true
    el.dispatchEvent(new Event('volumechange'))
    expect(mediaVolumes['aud-1']).toBe(0)

    unregisterMediaElement('aud-1', el)
    expect(mediaPlayStates['aud-1']).toBeUndefined()
    expect(mediaVolumes['aud-1']).toBeUndefined()
    // після зняття події елемента нічого не пишуть
    el.dispatchEvent(new Event('play'))
    expect(mediaPlayStates['aud-1']).toBeUndefined()
  })

  it('чужий елемент з тим самим id реєстрацію не знімає', () => {
    const a = media('video'); const b = media('video')
    registerMediaElement('vid-1', a.el)
    unregisterMediaElement('vid-1', b.el)
    expect(mediaPlayStates['vid-1']).toBe('idle')
  })
})

describe('INV-PLY-2 · ▶ без жесту — blocked і запуск першим дотиком, один раз', () => {
  it('▶ з пульта викликає play(); звук дозволено — стан з події', async () => {
    const { el, playSpy } = media('video')
    registerMediaElement('vid-1', el)
    expect(playMedia('vid-1')).toBe(true)
    expect(playSpy).toHaveBeenCalledTimes(1)
    el.dispatchEvent(new Event('play'))
    expect(mediaPlayStates['vid-1']).toBe('playing')
  })

  it('NotAllowedError → blocked; перший дотик запускає рівно раз', async () => {
    const { el, playSpy } = media('audio', blockedPlay)
    registerMediaElement('aud-1', el)
    playMedia('aud-1')
    await flushPromises()
    expect(mediaPlayStates['aud-1']).toBe('blocked')
    playSpy.mockImplementation(() => Promise.resolve())
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('pointerdown'))
    expect(playSpy).toHaveBeenCalledTimes(2)   // спроба з пульта + одна від дотику
  })

  it('⏸ під час blocked знімає очікування: дотик більше нічого не запускає', async () => {
    const { el, playSpy } = media('audio', blockedPlay)
    registerMediaElement('aud-1', el)
    playMedia('aud-1')
    await flushPromises()
    pauseMedia('aud-1')
    expect(mediaPlayStates['aud-1']).toBe('idle')
    window.dispatchEvent(new Event('keydown'))
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('інша відмова play() — error, а не мовчання; незареєстрований — false', async () => {
    const { el } = media('video', () => Promise.reject(new Error('decode')))
    registerMediaElement('vid-1', el)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    playMedia('vid-1')
    await flushPromises()
    expect(mediaPlayStates['vid-1']).toBe('error')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    expect(playMedia('nope')).toBe(false)
    expect(pauseMedia('nope')).toBe(false)
  })
})

describe('INV-PLY-3 · гучність відео-файлу й аудіо', () => {
  it('±10 п.п. від поточного, межі 0…100', () => {
    const { el } = media()
    registerMediaElement('aud-1', el)
    el.volume = 1
    expect(changeMediaVolume('aud-1', 1)).toBe(100)
    expect(changeMediaVolume('aud-1', -1)).toBe(90)
    el.volume = 0.55   // ручний повзунок між кроками
    expect(changeMediaVolume('aud-1', 1)).toBe(65)
    el.volume = 0.05
    expect(changeMediaVolume('aud-1', -1)).toBe(0)
    expect(changeMediaVolume('aud-1', -1)).toBe(0)
    expect(mediaVolumes['aud-1']).toBe(0)
  })

  it('вимкнений звук: «Гучніше» спершу вмикає; з нуля — одразу 10 %', () => {
    const { el } = media()
    registerMediaElement('aud-1', el)
    el.volume = 0.6
    el.muted = true
    expect(changeMediaVolume('aud-1', 1)).toBe(60)
    expect(el.muted).toBe(false)
    el.volume = 0
    el.muted = true
    expect(changeMediaVolume('aud-1', 1)).toBe(10)
    expect(changeMediaVolume('nope', 1)).toBeNull()
  })
})

describe('INV-PLY-4 · гучність YouTube — документовані методи плеєра', () => {
  class FakePlayer {
    static last: FakePlayer | null = null
    vol = 60
    muted = false
    playVideo = vi.fn()
    pauseVideo = vi.fn()
    setVolume = vi.fn((v: number) => { this.vol = v })
    getVolume = vi.fn(() => this.vol)
    isMuted = vi.fn(() => this.muted)
    unMute = vi.fn(() => { this.muted = false })
    constructor(public frame: HTMLIFrameElement, public opts: { events: Record<string, (e: any) => void> }) {
      FakePlayer.last = this
    }
    ready() { this.opts.events.onReady?.({ target: this }) }
    state(s: number) { this.opts.events.onStateChange?.({ data: s }) }
  }
  let frame: HTMLIFrameElement
  const player = () => FakePlayer.last!

  beforeEach(async () => {
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
  })

  it('поки плеєр не готовий — гучності немає, команда ігнорується', () => {
    expect(ytVolumes['yt-1']).toBeUndefined()
    expect(changeVideoVolume('yt-1', 1)).toBeNull()
    expect(player().setVolume).not.toHaveBeenCalled()
  })

  it('готовий — гучність видно; ±10 від поточного, межі 0…100', () => {
    player().ready()
    expect(ytVolumes['yt-1']).toBe(60)
    expect(changeVideoVolume('yt-1', 1)).toBe(70)
    expect(player().setVolume).toHaveBeenLastCalledWith(70)
    player().vol = 95          // змінили повзунком у самому плеєрі
    expect(changeVideoVolume('yt-1', 1)).toBe(100)
    for (let i = 0; i < 12; i++) changeVideoVolume('yt-1', -1)
    expect(ytVolumes['yt-1']).toBe(0)
  })

  it('вимкнений звук: 0 на пульті; «Гучніше» вмикає звук; з нуля — 10 %', () => {
    player().ready()
    player().muted = true
    player().state(2)          // будь-яка зміна стану перечитує гучність
    expect(ytVolumes['yt-1']).toBe(0)
    expect(changeVideoVolume('yt-1', 1)).toBe(60)
    expect(player().unMute).toHaveBeenCalled()
    player().muted = true
    player().vol = 0
    expect(changeVideoVolume('yt-1', 1)).toBe(10)
    expect(player().setVolume).toHaveBeenLastCalledWith(10)
  })
})
