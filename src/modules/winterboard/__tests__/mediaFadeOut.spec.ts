/**
 * Звук стихає, а не обривається (LAW §9 v1.61): мелодія чи відео, що грає, при знятті з дошки (інша сторінка) лишається
 * в документі — у невидимому місці, — гучність за 2 с сходить до нуля, потім пауза й елемент прибирається.
 * Не грає — нічого не робимо (елемент прибирає Vue, як і раніше).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { fadeOutDetached, MEDIA_FADE_OUT_MS } from '../board/mediaFadeOut'
import AudioPlayerObject from '../components/board/objects/AudioPlayerObject.vue'

function playing(el: HTMLMediaElement, on = true): HTMLMediaElement {
  let paused = !on
  Object.defineProperty(el, 'paused', { configurable: true, get: () => paused })
  Object.defineProperty(el, 'ended', { configurable: true, get: () => false })
  el.pause = vi.fn(() => { paused = true })
  el.volume = 0.8
  return el
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); document.getElementById('wb-media-fade-host')?.remove() })

describe('fadeOutDetached', () => {
  it('не грає — нічого', () => {
    const el = playing(document.createElement('audio'), false)
    expect(fadeOutDetached(el)).toBe(false)
    expect(el.isConnected).toBe(false)
  })

  it('грає — лишається в документі, гучність плавно до нуля за 2 с, потім пауза й прибрано', () => {
    const page = document.createElement('div')
    document.body.appendChild(page)
    const el = playing(page.appendChild(document.createElement('audio')))
    expect(fadeOutDetached(el)).toBe(true)
    page.remove()                                         // сторінку зняли — звук уже не на ній
    expect(el.isConnected).toBe(true)
    vi.advanceTimersByTime(MEDIA_FADE_OUT_MS / 2)
    expect(el.volume).toBeGreaterThan(0.3)
    expect(el.volume).toBeLessThan(0.5)
    expect(el.pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(MEDIA_FADE_OUT_MS / 2 + 100)
    expect(el.volume).toBe(0)
    expect(el.pause).toHaveBeenCalled()
    expect(el.isConnected).toBe(false)
  })

  it('поставили на паузу посеред стихання — одразу прибрано', () => {
    const el = playing(document.body.appendChild(document.createElement('audio')))
    fadeOutDetached(el)
    el.pause()
    vi.advanceTimersByTime(100)
    expect(el.isConnected).toBe(false)
  })
})

describe('програвач мелодії на дошці', () => {
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  it('грав і його зняли з дошки — звук стихає, а не обривається', () => {
    const w = mount(AudioPlayerObject, {
      props: { obj: { id: 'mel-01', type: 'audio_player', src: '/m.mp3', title: 'Мелодія', x: 0, y: 0, w: 420, h: 80 } as never, isTutor: true },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    const el = playing(w.find('audio').element as HTMLAudioElement)
    w.unmount()
    expect(el.isConnected).toBe(true)                     // ще звучить, стихаючи
    vi.advanceTimersByTime(MEDIA_FADE_OUT_MS + 100)
    expect(el.isConnected).toBe(false)
  })
})
