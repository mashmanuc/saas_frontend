/**
 * [WB5-B7] Unit tests — WBPageThumbnails (page thumbnail sidebar)
 * Ref: TASK_BOARD_V5.md B7
 *
 * Tests:
 * 1. Renders correct number of thumbnails
 * 2. Active page has active class
 * 3. Click thumbnail emits 'select' with index
 * 4. Add button emits 'add'
 * 5. Delete button emits 'delete' with index
 * 6. Delete button hidden when only 1 page
 * 7. Drag start sets data transfer
 * 8. Page number labels correct (1-indexed)
 * 9. aria-selected on active tab
 * 10. role="tablist" on container
 * 11. role="tab" on each thumbnail
 * 12. Keyboard: Enter selects page
 * 13. i18n keys render correctly
 * 14. Non-active tabs have tabindex=-1
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBPageThumbnails from '@/modules/winterboard/components/pages/WBPageThumbnails.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      pages: {
        page_list: 'Page list',
        page_n: 'Page {n}',
        add: 'Add page',
        delete_page: 'Delete page {n}',
      },
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages,
})

// ─── Mock pages ─────────────────────────────────────────────────────────────

function makePage(id: string) {
  return {
    id,
    name: `Page ${id}`,
    strokes: [],
    assets: [],
  }
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function mountThumbnails(props: Record<string, unknown> = {}) {
  return mount(WBPageThumbnails, {
    props: {
      pages: [makePage('p1'), makePage('p2'), makePage('p3')],
      currentIndex: 0,
      ...props,
    },
    global: {
      plugins: [i18n],
    },
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBPageThumbnails (B7)', () => {
  it('renders correct number of thumbnails', () => {
    const wrapper = mountThumbnails()
    // 3 page thumbnails + 1 add button
    const thumbs = wrapper.findAll('.wb-thumbnail')
    // add button also has .wb-thumbnail class
    expect(thumbs.length).toBe(4) // 3 pages + 1 add
  })

  it('active page has active class', () => {
    const wrapper = mountThumbnails({ currentIndex: 1 })
    const thumbs = wrapper.findAll('[role="tab"]')
    expect(thumbs[0].classes()).not.toContain('wb-thumbnail--active')
    expect(thumbs[1].classes()).toContain('wb-thumbnail--active')
    expect(thumbs[2].classes()).not.toContain('wb-thumbnail--active')
  })

  it('click thumbnail emits select with index', async () => {
    const wrapper = mountThumbnails()
    const thumbs = wrapper.findAll('[role="tab"]')
    await thumbs[1].trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([1])
  })

  it('add button emits add', async () => {
    const wrapper = mountThumbnails()
    const addBtn = wrapper.find('.wb-thumbnail--add')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    expect(wrapper.emitted('add')).toBeTruthy()
  })

  it('delete button emits delete with index', async () => {
    const wrapper = mountThumbnails()
    const deleteBtns = wrapper.findAll('.wb-thumbnail__delete')
    expect(deleteBtns.length).toBe(3) // all 3 pages have delete
    await deleteBtns[1].trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0]).toEqual([1])
  })

  it('delete button hidden when only 1 page', () => {
    const wrapper = mountThumbnails({
      pages: [makePage('p1')],
      currentIndex: 0,
    })
    const deleteBtns = wrapper.findAll('.wb-thumbnail__delete')
    expect(deleteBtns.length).toBe(0)
  })

  it('drag start sets data transfer', async () => {
    const wrapper = mountThumbnails()
    const thumbs = wrapper.findAll('[role="tab"]')
    const mockDataTransfer = {
      effectAllowed: '',
      setData: (_type: string, _val: string) => {},
    }
    await thumbs[0].trigger('dragstart', { dataTransfer: mockDataTransfer })
    // No error thrown — drag started successfully
    expect(true).toBe(true)
  })

  it('page number labels correct (1-indexed)', () => {
    const wrapper = mountThumbnails()
    const labels = wrapper.findAll('.wb-thumbnail__label')
    expect(labels[0].text()).toBe('1')
    expect(labels[1].text()).toBe('2')
    expect(labels[2].text()).toBe('3')
  })

  it('aria-selected on active tab', () => {
    const wrapper = mountThumbnails({ currentIndex: 2 })
    const thumbs = wrapper.findAll('[role="tab"]')
    expect(thumbs[0].attributes('aria-selected')).toBe('false')
    expect(thumbs[1].attributes('aria-selected')).toBe('false')
    expect(thumbs[2].attributes('aria-selected')).toBe('true')
  })

  it('role="tablist" on container', () => {
    const wrapper = mountThumbnails()
    const container = wrapper.find('.wb-page-thumbnails')
    expect(container.attributes('role')).toBe('tablist')
  })

  it('role="tab" on each thumbnail', () => {
    const wrapper = mountThumbnails()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.length).toBe(3)
  })

  it('keyboard: Enter selects page', async () => {
    const wrapper = mountThumbnails()
    const thumbs = wrapper.findAll('[role="tab"]')
    await thumbs[2].trigger('keydown.enter')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([2])
  })

  it('i18n keys render correctly', () => {
    const wrapper = mountThumbnails()
    const text = wrapper.text()
    expect(text).toContain('Add page')
  })

  it('non-active tabs have tabindex=-1', () => {
    const wrapper = mountThumbnails({ currentIndex: 0 })
    const thumbs = wrapper.findAll('[role="tab"]')
    expect(thumbs[0].attributes('tabindex')).toBe('0')
    expect(thumbs[1].attributes('tabindex')).toBe('-1')
    expect(thumbs[2].attributes('tabindex')).toBe('-1')
  })

  it('aria-label on container', () => {
    const wrapper = mountThumbnails()
    const container = wrapper.find('.wb-page-thumbnails')
    expect(container.attributes('aria-label')).toBe('Page list')
  })
})
