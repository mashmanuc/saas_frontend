import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '../themeStore'

describe('themeStore (consolidated)', () => {
  let localStorageMock: Record<string, string> = {}
  let setItemSpy: ReturnType<typeof vi.fn>
  let getItemSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorageMock = {}

    getItemSpy = vi.fn((key: string) => localStorageMock[key] ?? null)
    setItemSpy = vi.fn((key: string, value: string) => {
      localStorageMock[key] = value
    })

    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
    })

    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  describe('setTheme', () => {
    it('should change theme to light/dark/classic', () => {
      const store = useThemeStore()
      expect(store.theme).toBe('light')

      store.setTheme('dark')
      expect(store.theme).toBe('dark')

      store.setTheme('classic')
      expect(store.theme).toBe('classic')
    })

    it('should save to localStorage with key "theme"', () => {
      const store = useThemeStore()
      store.setTheme('dark')

      expect(setItemSpy).toHaveBeenCalledWith('theme', 'dark')
    })

    it('should fallback to light for invalid value', () => {
      const store = useThemeStore()
      store.setTheme('invalidTheme' as any)

      expect(store.theme).toBe('light')
    })
  })

  describe('applyTheme', () => {
    it('should set data-theme attribute on <html>', () => {
      const store = useThemeStore()
      store.setTheme('dark')

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('should add "dark" class for dark theme', () => {
      const store = useThemeStore()
      store.setTheme('dark')

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should remove "dark" class for non-dark themes', () => {
      const store = useThemeStore()
      store.setTheme('dark')
      store.setTheme('light')

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('init', () => {
    it('should read theme from localStorage on init', () => {
      localStorageMock['theme'] = 'classic'

      // Re-create pinia so store reads fresh localStorage
      setActivePinia(createPinia())
      const store = useThemeStore()
      store.init()

      expect(store.theme).toBe('classic')
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic')
    })

    it('should default to light if localStorage is empty', () => {
      const store = useThemeStore()
      store.init()

      expect(store.theme).toBe('light')
    })
  })
})
