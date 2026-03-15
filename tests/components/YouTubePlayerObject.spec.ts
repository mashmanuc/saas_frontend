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
    expect(iframe.attributes('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1')
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

  it('hides title bar when obj.title is not set', () => {
    const wrapper = mountPlayer()
    expect(wrapper.find('.wb-youtube-player__title').exists()).toBe(false)
  })
})
