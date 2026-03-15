/**
 * [P10-B.T2] Unit tests — WBMarkerCreateModal (Marker creation modal)
 * Ref: DAY5_ALL_AGENTS.md B.T2
 *
 * Tests:
 * 1.  Shows when visible=true
 * 2.  NOT shown when visible=false
 * 3.  "Create" button disabled when title is empty
 * 4.  "Create" button enabled when title is non-empty
 * 5.  Category select defaults to "theory"
 * 6.  All 6 categories present in select
 * 7.  Emit submit with { title, category } on create click
 * 8.  Emit close on "Cancel" click
 * 9.  Emit close on backdrop click
 * 10. Title input auto-focused on open
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import WBMarkerCreateModal from '@/modules/winterboard/components/replay/WBMarkerCreateModal.vue'

// ─── i18n stub ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      lessonMap: {
        category: {
          theory: 'Theory',
          formula: 'Formula',
          example: 'Example',
          practice: 'Practice',
          solution: 'Solution',
          custom: 'Other',
        },
      },
      markerModal: {
        title: 'Create marker',
        close: 'Close',
        nameLabel: 'Title',
        namePlaceholder: 'Enter marker title',
        categoryLabel: 'Category',
        cancel: 'Cancel',
        create: 'Create',
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
  return mount(WBMarkerCreateModal, {
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
    attachTo: document.body,
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBMarkerCreateModal (B.T2)', () => {
  it('shows when visible=true', () => {
    const wrapper = mountModal({ visible: true })
    expect(wrapper.find('.wb-marker-modal').exists()).toBe(true)
    wrapper.unmount()
  })

  it('NOT shown when visible=false', () => {
    const wrapper = mountModal({ visible: false })
    expect(wrapper.find('.wb-marker-modal').exists()).toBe(false)
    wrapper.unmount()
  })

  it('"Create" button disabled when title is empty', () => {
    const wrapper = mountModal()
    const createBtn = wrapper.find('.wb-marker-modal__btn--primary')
    expect(createBtn.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('"Create" button enabled when title is non-empty', async () => {
    const wrapper = mountModal()
    const input = wrapper.find('#wb-marker-title')
    await input.setValue('My Marker')
    const createBtn = wrapper.find('.wb-marker-modal__btn--primary')
    expect(createBtn.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('category select defaults to "theory"', () => {
    const wrapper = mountModal()
    const select = wrapper.find<HTMLSelectElement>('#wb-marker-category')
    expect(select.element.value).toBe('theory')
    wrapper.unmount()
  })

  it('all 6 categories present in select', () => {
    const wrapper = mountModal()
    const options = wrapper.findAll('#wb-marker-category option')
    expect(options).toHaveLength(6)
    const values = options.map(o => o.attributes('value'))
    expect(values).toEqual(['theory', 'formula', 'example', 'practice', 'solution', 'custom'])
    wrapper.unmount()
  })

  it('emit submit with { title, category } on create click', async () => {
    const wrapper = mountModal()
    const input = wrapper.find('#wb-marker-title')
    await input.setValue('Important concept')
    const select = wrapper.find('#wb-marker-category')
    await select.setValue('formula')
    const createBtn = wrapper.find('.wb-marker-modal__btn--primary')
    await createBtn.trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
    const payload = wrapper.emitted('submit')![0][0] as { title: string; category: string }
    expect(payload.title).toBe('Important concept')
    expect(payload.category).toBe('formula')
    wrapper.unmount()
  })

  it('emit close on "Cancel" click', async () => {
    const wrapper = mountModal()
    const cancelBtn = wrapper.find('.wb-marker-modal__btn--secondary')
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('emit close on backdrop click', async () => {
    const wrapper = mountModal()
    const backdrop = wrapper.find('.wb-marker-modal__backdrop')
    await backdrop.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('title input auto-focused on open', async () => {
    const wrapper = mountModal({ visible: false })
    await wrapper.setProps({ visible: true })
    await nextTick()
    await nextTick()
    const input = wrapper.find('#wb-marker-title')
    expect(input.exists()).toBe(true)
    // Focus is set via ref — check the element is the active element in document
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
  })
})
