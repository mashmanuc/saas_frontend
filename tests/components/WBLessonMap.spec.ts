/**
 * [P10-B.T1] Unit tests — WBLessonMap (Lesson navigation sidebar)
 * Ref: DAY5_ALL_AGENTS.md B.T1
 *
 * Tests:
 * 1.  Renders marker list items
 * 2.  Shows empty state when markers is []
 * 3.  Emits seek on marker click
 * 4.  Emits seek on Enter keydown
 * 5.  Emits create on "+" button click
 * 6.  Emits delete on delete button click
 * 7.  Active marker gets --active class
 * 8.  canEdit=false hides add button
 * 9.  canEdit=false hides delete buttons
 * 10. Markers sorted by order then operation_index
 * 11. Category badge has correct background color
 * 12. Thumbnail image rendered when thumbnail_url present
 * 13. Placeholder rendered when thumbnail_url empty
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBLessonMap from '@/modules/winterboard/components/replay/WBLessonMap.vue'
import type { WBLessonMarker } from '@/modules/winterboard/types/winterboard'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      lessonMap: {
        title: 'Lesson Map',
        empty: 'No markers yet. Add your first!',
        addMarker: 'Add marker',
        deleteMarker: 'Delete marker',
        category: {
          theory: 'Theory',
          formula: 'Formula',
          example: 'Example',
          practice: 'Practice',
          solution: 'Solution',
          custom: 'Other',
        },
      },
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages,
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMarker(overrides: Partial<WBLessonMarker> = {}): WBLessonMarker {
  return {
    id: 'marker-1',
    title: 'Test marker',
    operation_index: 10,
    page_id: 'page-1',
    board_position: { x: 0, y: 0 },
    thumbnail_url: '',
    category: 'theory',
    order: 0,
    created_at: '2026-03-15T12:00:00Z',
    ...overrides,
  }
}

function mountMap(props: Record<string, unknown> = {}) {
  return mount(WBLessonMap, {
    props: {
      markers: [],
      activeMarkerId: null,
      canEdit: true,
      ...props,
    },
    global: {
      plugins: [i18n],
    },
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBLessonMap (B.T1)', () => {
  it('renders marker list items', () => {
    const markers = [makeMarker({ id: 'm1' }), makeMarker({ id: 'm2', title: 'Second' })]
    const wrapper = mountMap({ markers })
    const items = wrapper.findAll('.wb-lesson-map__item')
    expect(items).toHaveLength(2)
  })

  it('shows empty state when markers is []', () => {
    const wrapper = mountMap({ markers: [] })
    expect(wrapper.find('.wb-lesson-map__empty').exists()).toBe(true)
    expect(wrapper.find('.wb-lesson-map__empty').text()).toContain('No markers yet')
  })

  it('emits seek on marker click', async () => {
    const marker = makeMarker({ id: 'm1' })
    const wrapper = mountMap({ markers: [marker] })
    await wrapper.find('.wb-lesson-map__item').trigger('click')
    expect(wrapper.emitted('seek')).toBeTruthy()
    expect(wrapper.emitted('seek')![0][0]).toMatchObject({ id: 'm1' })
  })

  it('emits seek on Enter keydown', async () => {
    const marker = makeMarker({ id: 'm1' })
    const wrapper = mountMap({ markers: [marker] })
    await wrapper.find('.wb-lesson-map__item').trigger('keydown.enter')
    expect(wrapper.emitted('seek')).toBeTruthy()
    expect(wrapper.emitted('seek')![0][0]).toMatchObject({ id: 'm1' })
  })

  it('emits create on "+" button click', async () => {
    const wrapper = mountMap({ canEdit: true })
    const addBtn = wrapper.find('.wb-lesson-map__add')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    expect(wrapper.emitted('create')).toBeTruthy()
  })

  it('emits delete on delete button click', async () => {
    const marker = makeMarker({ id: 'm1' })
    const wrapper = mountMap({ markers: [marker], canEdit: true })
    const deleteBtn = wrapper.find('.wb-lesson-map__delete')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0][0]).toBe('m1')
  })

  it('active marker gets --active class', () => {
    const markers = [makeMarker({ id: 'm1' }), makeMarker({ id: 'm2', title: 'Other' })]
    const wrapper = mountMap({ markers, activeMarkerId: 'm1' })
    const items = wrapper.findAll('.wb-lesson-map__item')
    expect(items[0].classes()).toContain('wb-lesson-map__item--active')
    expect(items[1].classes()).not.toContain('wb-lesson-map__item--active')
  })

  it('canEdit=false hides add button', () => {
    const wrapper = mountMap({ canEdit: false })
    expect(wrapper.find('.wb-lesson-map__add').exists()).toBe(false)
  })

  it('canEdit=false hides delete buttons', () => {
    const marker = makeMarker({ id: 'm1' })
    const wrapper = mountMap({ markers: [marker], canEdit: false })
    expect(wrapper.find('.wb-lesson-map__delete').exists()).toBe(false)
  })

  it('markers sorted by order then operation_index', () => {
    const markers = [
      makeMarker({ id: 'm3', title: 'Third', order: 2, operation_index: 5 }),
      makeMarker({ id: 'm1', title: 'First', order: 0, operation_index: 10 }),
      makeMarker({ id: 'm2', title: 'Second', order: 0, operation_index: 20 }),
    ]
    const wrapper = mountMap({ markers })
    const titles = wrapper.findAll('.wb-lesson-map__title').map(el => el.text())
    expect(titles).toEqual(['First', 'Second', 'Third'])
  })

  it('category badge has correct background color', () => {
    const marker = makeMarker({ id: 'm1', category: 'formula' })
    const wrapper = mountMap({ markers: [marker] })
    const badge = wrapper.find('.wb-lesson-map__badge')
    expect(badge.attributes('style')).toContain('background-color: #8b5cf6')
  })

  it('thumbnail image rendered when thumbnail_url present', () => {
    const marker = makeMarker({ id: 'm1', thumbnail_url: 'https://example.com/thumb.jpg' })
    const wrapper = mountMap({ markers: [marker] })
    const img = wrapper.find('.wb-lesson-map__thumb-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/thumb.jpg')
  })

  it('placeholder rendered when thumbnail_url empty', () => {
    const marker = makeMarker({ id: 'm1', thumbnail_url: '' })
    const wrapper = mountMap({ markers: [marker] })
    expect(wrapper.find('.wb-lesson-map__thumb-img').exists()).toBe(false)
    expect(wrapper.find('.wb-lesson-map__thumb-placeholder').exists()).toBe(true)
  })
})
