/**
 * Власник 2026-09-28 («так»): відео з «Матеріалів» запускається кнопкою ▶ на весь екран — так
 * само, як презентація (PresentationPlayer). Показ відео дошки з пульта — INV-SCN-5b у
 * remoteScenarioLaptop.spec.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import ContentSidebarItem from '../components/sidebar/ContentSidebarItem.vue'
import VideoShowPlayer from '../components/sidebar/VideoShowPlayer.vue'
import type { AllowedContentItem } from '../types/sidebar'

function i18n(locale: 'uk' | 'en' = 'uk') {
  return createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { uk, en } as any })
}

function item(over: Partial<AllowedContentItem> = {}): AllowedContentItem {
  return {
    id: 7, content_item_id: 70, content_type: 'video', title: 'Досліди з маятником.mp4',
    asset_category: 'video', thumbnail_url: null, processing_status: 'ready',
    cdn_url: 'https://cdn.example/v.mp4', ...over,
  } as AllowedContentItem
}

function mountItem(it: AllowedContentItem, isTutor = true) {
  return mount(ContentSidebarItem, {
    props: { item: it, isTutor },
    global: { plugins: [i18n()], stubs: { teleport: true } },
  })
}

describe('«Матеріали»: відео запускається кнопкою ▶ на весь екран, як презентація', () => {
  it('у відео є ▶; натискання відкриває показ з цим файлом, × закриває', async () => {
    const w = mountItem(item())
    const play = w.find('[data-testid="sidebar-video-play"]')
    expect(play.exists()).toBe(true)
    expect(w.find('[data-testid="video-show"]').exists()).toBe(false)
    await play.trigger('click')
    const show = w.find('[data-testid="video-show"]')
    expect(show.exists()).toBe(true)
    const video = show.find('video')
    expect(video.attributes('src')).toBe('https://cdn.example/v.mp4')
    expect(video.attributes('autoplay')).toBeDefined()
    expect(show.text()).toContain('Досліди з маятником.mp4')
    await w.find('[data-testid="video-show-close"]').trigger('click')
    expect(w.find('[data-testid="video-show"]').exists()).toBe(false)
    w.unmount()
  })

  it('▶ лише у відео вчителя з файлом: не в презентації, не в учня, не без адреси', () => {
    for (const [it, tutor] of [
      [item({ asset_category: 'presentation' }), true],
      [item({ asset_category: 'audio' }), true],
      [item(), false],
      [item({ cdn_url: null }), true],
    ] as Array<[AllowedContentItem, boolean]>) {
      const w = mountItem(it, tutor)
      expect(w.find('[data-testid="sidebar-video-play"]').exists()).toBe(false)
      w.unmount()
    }
  })

  it('▶ не запускає перетягування чи клік самого рядка', async () => {
    const w = mountItem(item())
    await w.find('[data-testid="sidebar-video-play"]').trigger('click')
    expect(w.emitted('place')).toBeUndefined()
    w.unmount()
  })
})

describe('показ відео з «Матеріалів»: Esc закриває', () => {
  it('Esc у показі — close', async () => {
    const w = mount(VideoShowPlayer, {
      props: { src: 'https://cdn.example/v.mp4', title: 'Відео' },
      global: { plugins: [i18n()], stubs: { teleport: true } },
    })
    await w.find('[data-testid="video-show"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(1)
    await w.find('[data-testid="video-show"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })
})
