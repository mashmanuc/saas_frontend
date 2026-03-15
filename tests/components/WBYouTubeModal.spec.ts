/**
 * [P10-B3.4] Unit tests — WBYouTubeModal (YouTube URL input modal)
 * Ref: DAY3_AGENT_B.md B3.4
 *
 * Tests:
 * 1. Shows when visible=true
 * 2. NOT shown when visible=false
 * 3. "Add" button disabled when URL is empty
 * 4. "Add" button disabled when URL is invalid YouTube
 * 5. Preview thumbnail shown for valid URL
 * 6. Emit 'submit' with { url, title } on "Add" click
 * 7. Emit 'close' on "Cancel" click
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBYouTubeModal from '@/modules/winterboard/components/toolbar/WBYouTubeModal.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      youtube: {
        modalTitle: 'Insert YouTube video',
        urlLabel: 'URL',
        urlPlaceholder: 'https://www.youtube.com/watch?v=...',
        preview: 'Video preview',
        previewHint: 'Paste a YouTube URL to see preview',
        titleLabel: 'Title (optional)',
        titlePlaceholder: 'Video title...',
        cancel: 'Cancel',
        add: 'Add to board',
        close: 'Close',
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

function mountModal(props: Record<string, unknown> = {}) {
  return mount(WBYouTubeModal, {
    props: {
      visible: true,
      ...props,
    },
    global: {
      plugins: [i18n],
      stubs: {
        Teleport: true,
      },
    },
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBYouTubeModal (B3.4)', () => {
  it('shows when visible=true', () => {
    const wrapper = mountModal({ visible: true })
    expect(wrapper.find('.wb-youtube-modal').exists()).toBe(true)
  })

  it('NOT shown when visible=false', () => {
    const wrapper = mountModal({ visible: false })
    expect(wrapper.find('.wb-youtube-modal').exists()).toBe(false)
  })

  it('"Add" button disabled when URL is empty', () => {
    const wrapper = mountModal()
    const addBtn = wrapper.find('.wb-youtube-modal__btn--primary')
    expect(addBtn.exists()).toBe(true)
    expect(addBtn.attributes('disabled')).toBeDefined()
  })

  it('"Add" button disabled when URL is invalid YouTube', async () => {
    const wrapper = mountModal()
    const urlInput = wrapper.find('#wb-yt-url')
    await urlInput.setValue('https://example.com/not-youtube')
    const addBtn = wrapper.find('.wb-youtube-modal__btn--primary')
    expect(addBtn.attributes('disabled')).toBeDefined()
  })

  it('preview thumbnail shown for valid URL', async () => {
    const wrapper = mountModal()
    const urlInput = wrapper.find('#wb-yt-url')
    await urlInput.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    const img = wrapper.find('.wb-youtube-modal__thumbnail')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('emit submit with { url, title } on "Add" click', async () => {
    const wrapper = mountModal()
    const urlInput = wrapper.find('#wb-yt-url')
    const titleInput = wrapper.find('#wb-yt-title')
    await urlInput.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await titleInput.setValue('My Video')
    const addBtn = wrapper.find('.wb-youtube-modal__btn--primary')
    await addBtn.trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
    const payload = wrapper.emitted('submit')![0][0] as { url: string; title?: string }
    expect(payload.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(payload.title).toBe('My Video')
  })

  it('emit close on "Cancel" click', async () => {
    const wrapper = mountModal()
    const cancelBtn = wrapper.find('.wb-youtube-modal__btn--secondary')
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('"Add" button enabled for valid YouTube URL', async () => {
    const wrapper = mountModal()
    const urlInput = wrapper.find('#wb-yt-url')
    await urlInput.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    const addBtn = wrapper.find('.wb-youtube-modal__btn--primary')
    expect(addBtn.attributes('disabled')).toBeUndefined()
  })

  it('shows placeholder when no URL entered', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.wb-youtube-modal__placeholder').exists()).toBe(true)
    expect(wrapper.find('.wb-youtube-modal__thumbnail').exists()).toBe(false)
  })
})
