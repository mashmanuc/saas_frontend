/**
 * [P10-B3.4] Unit tests — YouTubePlayerObject (YouTube embed on board)
 * Ref: DAY3_AGENT_B.md B3.4
 *
 * Tests:
 * 1. Renders iframe with correct embed URL for valid youtubeUrl
 * 2. Shows error placeholder for invalid youtubeUrl
 * 3. iframe has allowfullscreen attribute
 * 4. iframe has loading="lazy"
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import YouTubePlayerObject from '@/modules/winterboard/components/board/objects/YouTubePlayerObject.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      youtube: {
        invalidUrl: 'Invalid YouTube URL',
      },
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages,
})

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeObj(overrides: Record<string, unknown> = {}) {
  return {
    id: 'yt-1',
    type: 'youtube_player' as const,
    src: '',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    x: 100,
    y: 100,
    w: 640,
    h: 360,
    ...overrides,
  }
}

function mountPlayer(objOverrides: Record<string, unknown> = {}) {
  return mount(YouTubePlayerObject, {
    props: {
      obj: makeObj(objOverrides),
      isTutor: true,
    },
    global: {
      plugins: [i18n],
    },
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('YouTubePlayerObject (B3.4)', () => {
  it('renders iframe with correct embed URL for valid youtubeUrl', () => {
    const wrapper = mountPlayer({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toBe(
      `https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`,
    )
  })

  it('shows error placeholder for invalid youtubeUrl', () => {
    const wrapper = mountPlayer({ youtubeUrl: 'https://example.com/not-youtube' })
    expect(wrapper.find('iframe').exists()).toBe(false)
    const error = wrapper.find('.wb-youtube-player__error')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('Invalid YouTube URL')
  })

  it('iframe has allowfullscreen attribute', () => {
    const wrapper = mountPlayer()
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('allowfullscreen')).toBeDefined()
  })

  it('iframe has loading="lazy"', () => {
    const wrapper = mountPlayer()
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('loading')).toBe('lazy')
  })

  it('parses youtu.be short URLs', () => {
    const wrapper = mountPlayer({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toContain('dQw4w9WgXcQ')
  })

  it('parses embed URLs', () => {
    const wrapper = mountPlayer({ youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })
    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toContain('dQw4w9WgXcQ')
  })

  it('shows title bar when obj.title is set', () => {
    const wrapper = mountPlayer({ title: 'My Video' })
    const title = wrapper.find('.wb-youtube-player__title')
    expect(title.exists()).toBe(true)
    expect(title.text()).toBe('My Video')
  })

  // V1 2026-09-26: шапка над плеєром є завжди — кнопки картки «— ⛶ ×» стоять
  // на ній, а не на плеєрі (правила YouTube: нічого поверх плеєра).
  it('keeps the header strip above the player even without a title', () => {
    const wrapper = mountPlayer()
    const title = wrapper.find('.wb-youtube-player__title')
    expect(title.exists()).toBe(true)
    expect(title.text()).not.toBe('')
    // шапка — перший елемент картки, плеєр — під нею
    expect(wrapper.find('.wb-youtube-player').element.firstElementChild?.classList.contains('wb-youtube-player__title')).toBe(true)
  })

  // Рішення власника 2026-09-26: кнопки плеєра натискаються у звичайному режимі.
  // Поки кнопка вказівника, натиснута на дошці, не відпущена, плеєр вказівник
  // не приймає — інакше рух і відпускання над ним забирає iframe YouTube і
  // перетягування «прилипає» до курсора (спіймано живим тестом у Chrome).
  it('stops taking the pointer while a press that started on the board is held', async () => {
    const wrapper = mountPlayer()
    const inert = () => wrapper.find('iframe').classes().includes('wb-youtube-player__iframe--inert')
    expect(inert()).toBe(false)

    window.dispatchEvent(new Event('pointerdown'))
    await wrapper.vm.$nextTick()
    expect(inert()).toBe(true)

    window.dispatchEvent(new Event('pointerup'))
    await wrapper.vm.$nextTick()
    expect(inert()).toBe(false)

    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('pointercancel'))
    await wrapper.vm.$nextTick()
    expect(inert()).toBe(false)

    // вікно втратило фокус посеред натискання — відпускання вже не прийде
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('blur'))
    await wrapper.vm.$nextTick()
    expect(inert()).toBe(false)
    wrapper.unmount()
  })

  it('removes its window listeners on unmount', () => {
    const removed: string[] = []
    const original = window.removeEventListener
    window.removeEventListener = function (type: string, ...rest: unknown[]) {
      removed.push(type)
      return (original as (...a: unknown[]) => void).call(window, type, ...rest)
    } as typeof window.removeEventListener
    try {
      mountPlayer().unmount()
    } finally {
      window.removeEventListener = original
    }
    expect(removed).toEqual(expect.arrayContaining(['pointerdown', 'pointerup', 'pointercancel', 'blur']))
  })
})
