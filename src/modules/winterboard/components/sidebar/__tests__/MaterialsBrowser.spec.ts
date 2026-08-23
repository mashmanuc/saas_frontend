import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import MaterialsBrowser from '../MaterialsBrowser.vue'

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockLoadFolders = vi.fn().mockResolvedValue(undefined)
const mockLoadAssets = vi.fn().mockResolvedValue(undefined)
const mockSelectFolder = vi.fn()
const mockToggleFoldersPanel = vi.fn()

// DIR-хвости-2 §2 (2026-08-24): шлях мока був '../../composables/…' —
// зі спеки це components/composables/… (НЕ ІСНУЄ), тож vi.mock реєструвався
// на неіснуючий модуль, компонент тягнув СПРАВЖНІЙ composable → справжній
// apiClient → 16 × «no active Pinia», а асерти випадково збігались із
// деградованим порожнім станом. Тест був зелений і НІЧОГО не стеріг —
// клас MoveAssetDropdown. Шлях виправлено; нижче — асерт, що мок СПРАЦЮВАВ.
vi.mock('../../../composables/useMaterialsBrowser', async () => {
  // Справжні ref-и, не {value}: голий обʼєкт у темплейті НЕ розгортається,
  // і isLoadingAssets ставав truthy → компонент показував лоадер замість
  // empty-state (друга знахідка того ж дня: мок був і хибно ПІДключений,
  // і хибно СФОРМОВАНИЙ — обидва ховались один за одним).
  const { ref } = await import('vue')
  return {
    useMaterialsBrowser: () => ({
      folders: ref([]),
      assets: ref([]),
      selectedFolderId: ref(null),
      isLoadingFolders: ref(false),
      isLoadingAssets: ref(false),
      isFoldersPanelOpen: ref(true),
      error: ref(null),
      loadFolders: mockLoadFolders,
      loadAssets: mockLoadAssets,
      selectFolder: mockSelectFolder,
      toggleFoldersPanel: mockToggleFoldersPanel,
      FAVORITES_ID: -1,
      RECENT_ID: -2,
    }),
  }
})

// ─── Helper ─────────────────────────────────────────────────────────────────

function createWrapper() {
  const i18n = createI18n({
    legacy: false,
    locale: 'uk',
    messages: {
      uk: {
        winterboard: {
          materials: {
            hideFolders: 'Сховати папки',
            showFolders: 'Показати папки',
            emptyFolder: 'Папка порожня',
            emptyFolderHint: 'Завантажте файли або перетягніть їх сюди',
            uploadFile: 'Завантажити файл',
          },
        },
      },
    },
  })

  return mount(MaterialsBrowser, {
    global: {
      plugins: [i18n],
      stubs: {
        LibraryFolderTree: true,
        WBAssetItem: true,
        FolderIcon: true,
        FolderOpenIcon: true,
      },
    },
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MaterialsBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the component', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.materials-browser').exists()).toBe(true)
  })

  it('mount тягне дані ЧЕРЕЗ мок (страж проти зеленого-без-мока)', async () => {
    createWrapper()
    await flushPromises()
    // Якщо шлях vi.mock знову розійдеться з імпортом компонента —
    // цей тест впаде першим, а не мовчазний лог.
    expect(mockLoadFolders).toHaveBeenCalled()
  })

  it('renders toggle button', () => {
    const wrapper = createWrapper()
    const toggleBtn = wrapper.find('.materials-browser__toggle')
    expect(toggleBtn.exists()).toBe(true)
  })

  it('toggle button has correct aria-label', () => {
    const wrapper = createWrapper()
    const toggleBtn = wrapper.find('.materials-browser__toggle')
    expect(toggleBtn.attributes('aria-label')).toBe('Сховати папки')
  })

  it('renders assets container', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.materials-browser__assets').exists()).toBe(true)
  })

  it('shows empty state when no assets', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.materials-browser__empty').exists()).toBe(true)
  })

  // Phase 33 B7: Upload button in empty state
  describe('Phase 33: upload button in empty state', () => {
    it('renders upload button in empty state for tutor', async () => {
      const i18n = createI18n({
        legacy: false,
        locale: 'uk',
        messages: {
          uk: {
            winterboard: {
              materials: {
                hideFolders: 'Сховати папки',
                showFolders: 'Показати папки',
                emptyFolder: 'Папка порожня',
                emptyFolderHint: 'Завантажте файли або перетягніть їх сюди',
                uploadFile: 'Завантажити файл',
              },
            },
          },
        },
      })

      const wrapper = mount(MaterialsBrowser, {
        props: {
          isTutor: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            LibraryFolderTree: true,
            WBAssetItem: true,
            FolderIcon: true,
            FolderOpenIcon: true,
          },
        },
      })

      await flushPromises()
      
      const uploadBtn = wrapper.find('.materials-browser__empty-upload')
      expect(uploadBtn.exists()).toBe(true)
      expect(uploadBtn.text()).toContain('Завантажити файл')
    })

    it('does not render upload button in empty state for student', async () => {
      const i18n = createI18n({
        legacy: false,
        locale: 'uk',
        messages: {
          uk: {
            winterboard: {
              materials: {
                hideFolders: 'Сховати папки',
                showFolders: 'Показати папки',
                emptyFolder: 'Папка порожня',
                emptyFolderHint: 'Завантажте файли або перетягніть їх сюди',
                uploadFile: 'Завантажити файл',
              },
            },
          },
        },
      })

      const wrapper = mount(MaterialsBrowser, {
        props: {
          isTutor: false,
        },
        global: {
          plugins: [i18n],
          stubs: {
            LibraryFolderTree: true,
            WBAssetItem: true,
            FolderIcon: true,
            FolderOpenIcon: true,
          },
        },
      })

      await wrapper.vm.$nextTick()
      
      const uploadBtn = wrapper.find('.materials-browser__empty-upload')
      expect(uploadBtn.exists()).toBe(false)
    })

    it('emits upload-request when upload button clicked', async () => {
      const i18n = createI18n({
        legacy: false,
        locale: 'uk',
        messages: {
          uk: {
            winterboard: {
              materials: {
                hideFolders: 'Сховати папки',
                showFolders: 'Показати папки',
                emptyFolder: 'Папка порожня',
                emptyFolderHint: 'Завантажте файли або перетягніть їх сюди',
                uploadFile: 'Завантажити файл',
              },
            },
          },
        },
      })

      const wrapper = mount(MaterialsBrowser, {
        props: {
          isTutor: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            LibraryFolderTree: true,
            WBAssetItem: true,
            FolderIcon: true,
            FolderOpenIcon: true,
          },
        },
      })

      await flushPromises()
      
      const uploadBtn = wrapper.find('.materials-browser__empty-upload')
      await uploadBtn.trigger('click')
      
      expect(wrapper.emitted('upload-request')).toBeTruthy()
    })
  })
})
