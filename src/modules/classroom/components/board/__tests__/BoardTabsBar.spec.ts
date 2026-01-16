/**
 * BoardTabsBar Component Tests
 * v0.82.0
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BoardTabsBar from '../BoardTabsBar.vue'
import type { PageMetadata } from '@/core/whiteboard/adapters'

describe('BoardTabsBar', () => {
  const mockPages: PageMetadata[] = [
    { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
    { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
    { id: 'page-3', title: 'Page 3', index: 2, version: 1, updatedAt: '2024-01-03' },
  ]

  it('renders tabs for all pages', () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const tabs = wrapper.findAll('.board-tab:not(.board-tab--add)')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].text()).toContain('Page 1')
    expect(tabs[1].text()).toContain('Page 2')
    expect(tabs[2].text()).toContain('Page 3')
  })

  it('marks active tab with active class', () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-2',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const tabs = wrapper.findAll('.board-tab:not(.board-tab--add)')
    expect(tabs[0].classes()).not.toContain('board-tab--active')
    expect(tabs[1].classes()).toContain('board-tab--active')
    expect(tabs[2].classes()).not.toContain('board-tab--active')
  })

  it('emits switch event when tab is clicked', async () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const tabs = wrapper.findAll('.board-tab:not(.board-tab--add)')
    await tabs[1].trigger('click')

    expect(wrapper.emitted('switch')).toBeTruthy()
    expect(wrapper.emitted('switch')?.[0]).toEqual(['page-2'])
  })

  it('renders add button', () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const addButton = wrapper.find('.board-tab--add')
    expect(addButton.exists()).toBe(true)
    expect(addButton.text()).toBe('+')
  })

  it('emits add event when add button is clicked', async () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const addButton = wrapper.find('.board-tab--add')
    await addButton.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')?.[0]).toEqual([])
  })

  it('disables add button when canCreate is false', () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: false,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const addButton = wrapper.find('.board-tab--add')
    expect(addButton.attributes('disabled')).toBeDefined()
  })

  it('shows close button on tabs when multiple pages exist', () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const closeButtons = wrapper.findAll('.board-tab__close')
    expect(closeButtons.length).toBeGreaterThan(0)
  })

  it('hides close button when only one page exists', () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: [mockPages[0]],
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const closeButtons = wrapper.findAll('.board-tab__close')
    expect(closeButtons).toHaveLength(0)
  })

  it('emits delete event when close button is clicked', async () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const tabs = wrapper.findAll('.board-tab:not(.board-tab--add)')
    const closeButton = tabs[1].find('.board-tab__close')
    await closeButton.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual(['page-2'])
  })

  it('does not emit switch when close button is clicked', async () => {
    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: mockPages,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const tabs = wrapper.findAll('.board-tab:not(.board-tab--add)')
    const closeButton = tabs[1].find('.board-tab__close')
    await closeButton.trigger('click')

    expect(wrapper.emitted('switch')).toBeFalsy()
  })

  it('displays page title or fallback index', () => {
    const pagesWithoutTitle: PageMetadata[] = [
      { id: 'page-1', title: '', index: 0, version: 1, updatedAt: '2024-01-01' },
      { id: 'page-2', title: 'Custom Title', index: 1, version: 1, updatedAt: '2024-01-02' },
    ]

    const wrapper = mount(BoardTabsBar, {
      props: {
        pages: pagesWithoutTitle,
        activePageId: 'page-1',
        canCreate: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const tabs = wrapper.findAll('.board-tab:not(.board-tab--add)')
    expect(tabs[0].text()).toContain('Page 1')
    expect(tabs[1].text()).toContain('Custom Title')
  })
})
