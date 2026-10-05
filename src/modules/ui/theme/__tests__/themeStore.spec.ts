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
    document.documentElement.removeAttribute('data-dark-palette')
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

  // Рішення власника 2026-10-05: «став тему Графіт, а Ліс запасна і прихована».
  // «Графіт» — значення самої темної теми; «Нічний ліс» вмикається лише з localStorage.
  describe('прихована запасна палітра темної теми', () => {
    it('без прапорця темна тема — без data-dark-palette («Графіт»)', () => {
      const store = useThemeStore()
      store.setTheme('dark')

      expect(document.documentElement.hasAttribute('data-dark-palette')).toBe(false)
    })

    it('dark_palette=forest вмикає «Нічний ліс» поверх темної теми', () => {
      localStorageMock['dark_palette'] = 'forest'
      const store = useThemeStore()
      store.setTheme('dark')

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(document.documentElement.getAttribute('data-dark-palette')).toBe('forest')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('невідома палітра ігнорується', () => {
      localStorageMock['dark_palette'] = 'neon'
      const store = useThemeStore()
      store.setTheme('dark')

      expect(document.documentElement.hasAttribute('data-dark-palette')).toBe(false)
    })

    it('світла тема знімає палітру, навіть якщо прапорець лишився', () => {
      localStorageMock['dark_palette'] = 'forest'
      const store = useThemeStore()
      store.setTheme('dark')
      store.setTheme('light')

      expect(document.documentElement.hasAttribute('data-dark-palette')).toBe(false)
    })

    it('у меню тем «Нічного лісу» немає', () => {
      const store = useThemeStore()
      store.setTheme('forest' as any)

      expect(store.theme).toBe('light')
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
