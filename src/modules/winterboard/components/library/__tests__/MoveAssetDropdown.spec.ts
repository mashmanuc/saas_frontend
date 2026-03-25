/**
 * Phase 33 B7: MoveAssetDropdown unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import MoveAssetDropdown from '../MoveAssetDropdown.vue'
import type { LibraryFolderTree } from '../../../types/library'

// Mock requestAnimationFrame for jsdom
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })

// Suppress Vue Teleport insertBefore errors in jsdom (DOM cleaned up before Vue unmount)
const origListeners = process.listeners('unhandledRejection')
beforeAll(() => {
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', (reason: unknown) => {
    if (reason instanceof TypeError && String(reason.message).includes('insertBefore')) return
    // Re-throw non-Teleport errors
    throw reason
  })
})
afterAll(() => {
  process.removeAllListeners('unhandledRejection')
  for (const listener of origListeners) {
    process.on('unhandledRejection', listener as (...args: unknown[]) => void)
  }
})

// Mock flattenFolderTree
vi.mock('../../../utils/flattenFolderTree', () => ({
  flattenFolderTree: vi.fn((folders: LibraryFolderTree[]) => {
    const result: Array<{ id: number; name: string; depth: number }> = []
    function flatten(nodes: LibraryFolderTree[], depth = 0) {
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, depth })
        if (node.children.length > 0) {
          flatten(node.children, depth + 1)
        }
      }
    }
    flatten(folders)
    return result
  }),
}))

const mockFolders: LibraryFolderTree[] = [
  {
    id: 1,
    name: 'Math',
    parent: null,
    children: [
      {
        id: 2,
        name: 'Algebra',
        parent: 1,
        children: [],
        assets_count: 5,
      },
    ],
    assets_count: 10,
  },
  {
    id: 3,
    name: 'Physics',
    parent: null,
    children: [],
    assets_count: 3,
  },
]

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: {
    uk: {
      winterboard: {
        library: {
          moveToFolder: 'Перемістити в папку',
          noFolder: 'Без папки',
        },
      },
    },
  },
})

describe('MoveAssetDropdown', () => {
  let currentWrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    // Clear body for Teleport
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    // Unmount wrapper before clearing DOM to avoid Teleport insertBefore errors
    if (currentWrapper) {
      currentWrapper.unmount()
      currentWrapper = null
    }
    document.body.innerHTML = ''
  })

  it('renders trigger button', () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: null,
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
    })

    const trigger = wrapper.find('[data-testid="move-asset-btn"]')
    expect(trigger.exists()).toBe(true)
  })

  it('opens dropdown on trigger click', async () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: null,
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
      attachTo: document.body,
    })

    const trigger = wrapper.find('[data-testid="move-asset-btn"]')
    await trigger.trigger('click')

    // Dropdown is teleported to body
    const dropdown = document.querySelector('[data-testid="move-dropdown"]')
    expect(dropdown).toBeTruthy()
  })

  it('renders folder list with correct indentation', async () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: null,
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="move-asset-btn"]').trigger('click')

    const mathBtn = document.querySelector('[data-testid="move-to-1"]') as HTMLElement
    const algebraBtn = document.querySelector('[data-testid="move-to-2"]') as HTMLElement

    expect(mathBtn).toBeTruthy()
    expect(algebraBtn).toBeTruthy()

    // Check indentation (depth 0 = 12px, depth 1 = 12 + 16px)
    expect(mathBtn?.style.paddingLeft).toBe('12px')
    expect(algebraBtn?.style.paddingLeft).toBe('28px')
  })

  it('highlights current folder as disabled', async () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: 1, // Math folder
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="move-asset-btn"]').trigger('click')

    const mathBtn = document.querySelector('[data-testid="move-to-1"]') as HTMLButtonElement
    expect(mathBtn?.disabled).toBe(true)
    expect(mathBtn?.classList.contains('move-asset-dropdown__item--current')).toBe(true)
  })

  it('shows "No folder" option', async () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: 1,
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="move-asset-btn"]').trigger('click')

    const rootBtn = document.querySelector('[data-testid="move-to-root"]')
    expect(rootBtn).toBeTruthy()
    expect(rootBtn?.textContent).toContain('Без папки')
  })

  it('emits moved with correct folderId on selection', async () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: null,
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="move-asset-btn"]').trigger('click')
    await flushPromises()

    const mathBtn = document.querySelector('[data-testid="move-to-1"]') as HTMLElement
    mathBtn?.click()

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('moved')).toBeTruthy()
    expect(wrapper.emitted('moved')?.[0]).toEqual([100, 1])
  })

  it('closes dropdown on selection', async () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: null,
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="move-asset-btn"]').trigger('click')
    
    let dropdown = document.querySelector('[data-testid="move-dropdown"]')
    expect(dropdown).toBeTruthy()

    const mathBtn = document.querySelector('[data-testid="move-to-1"]') as HTMLElement
    mathBtn?.click()

    await wrapper.vm.$nextTick()

    dropdown = document.querySelector('[data-testid="move-dropdown"]')
    expect(dropdown).toBeFalsy()
  })

  it('emits close event when dropdown closes', async () => {
    const wrapper = mount(MoveAssetDropdown, {
      props: {
        assetId: 100,
        currentFolder: null,
        folders: mockFolders,
      },
      global: {
        plugins: [i18n],
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="move-asset-btn"]').trigger('click')

    const mathBtn = document.querySelector('[data-testid="move-to-1"]') as HTMLElement
    mathBtn?.click()

    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
