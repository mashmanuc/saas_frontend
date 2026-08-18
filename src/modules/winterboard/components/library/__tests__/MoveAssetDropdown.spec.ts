/**
 * Phase 33 B7: MoveAssetDropdown unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import MoveAssetDropdown from '../MoveAssetDropdown.vue'
import type { LibraryFolderTree } from '../../../types/library'

// HYG-2: стаб `requestAnimationFrame` видалено — саме він і ламав тести.
// Він виконував колбек СИНХРОННО, тож `updateMenuPosition()` спрацьовував
// до того, як Vue відрендерив телепортоване меню (`MoveAssetDropdown.vue:118`
// — `isOpen = true` і лише потім rAF). Наслідок: меню не з'являлось у DOM
// взагалі, і всі шість тестів бачили `null`. jsdom надає власний rAF —
// з ним компонент відкривається штатно (перевірено окремим прогоном).

// HYG-2: тут стояла глушилка `unhandledRejection`, яка ковтала
// «insertBefore of null» від Teleport. Її прибрано: зелений тест поверх
// схованої помилки — це той самий `except Exception: pass`, який ми
// забороняємо. Справжня причина була нижче (див. beforeEach/afterEach).

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
    // Свідомо НЕ чистимо body тут: раніше це затирало DOM під ще живим
    // компонентом попереднього тесту, і Vue при unmount не знаходив
    // батька для телепортованого вузла → «insertBefore of null».
    // Прибирання — лише в afterEach, і лише ПІСЛЯ unmount().
  })

  afterEach(() => {
    // Порядок критичний: спершу знімаємо компонент (Vue прибирає свій
    // телепортований вузол, поки батько ще на місці), і лише потім DOM.
    if (currentWrapper) {
      currentWrapper.unmount()
      currentWrapper = null
    }
    document.body.innerHTML = ''
  })

  it('renders trigger button', () => {
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
    const wrapper = currentWrapper = mount(MoveAssetDropdown, {
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
