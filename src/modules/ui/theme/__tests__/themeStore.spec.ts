import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '../themeStore'
import { defaultThemeId } from '../themes'

describe('themeStore', () => {
  let localStorageMock: Record<string, string> = {}
  let setItemSpy: ReturnType<typeof vi.fn>
  let getItemSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('setTheme', () => {
    it('should change currentThemeId', () => {
      const store = useThemeStore()
      expect(store.currentThemeId).toBe(defaultThemeId)

      store.setTheme('themeB')
      expect(store.currentThemeId).toBe('themeB')

      store.setTheme('themeC')
      expect(store.currentThemeId).toBe('themeC')
    })

    it('should save to localStorage', () => {
      const store = useThemeStore()
      store.setTheme('themeB')

      expect(setItemSpy).toHaveBeenCalledWith('m4sh_theme', 'themeB')
    })

    it('should fallback to default for invalid themeId', () => {
      const store = useThemeStore()
      store.setTheme('invalidTheme' as any)

      // Should keep current theme or fallback to default
      expect(['themeA', 'themeB', 'themeC']).toContain(store.currentThemeId)
    })
  })

  describe('applyTheme', () => {
    it('should set CSS variables on document.documentElement', () => {
      const store = useThemeStore()
      const mockSetProperty = vi.fn()
      vi.spyOn(document.documentElement.style, 'setProperty').mockImplementation(mockSetProperty)

      store.applyTheme()

      // Should have called setProperty for CSS variables
      expect(mockSetProperty).toHaveBeenCalled()
      // Check that brand color was set
      const calls = mockSetProperty.mock.calls
      const hasBrandColor = calls.some(([key]) => key === '--color-brand')
      expect(hasBrandColor).toBe(true)
    })
  })

  describe('initFromStorage', () => {
    it('should read theme from localStorage', () => {
      // Set mock value before creating store
      localStorageMock['m4sh_theme'] = 'themeB'

      const store = useThemeStore()
      store.initFromStorage()

      expect(store.currentThemeId).toBe('themeB')
    })

    it('should use default if localStorage is empty', () => {
      // localStorage is empty by default in beforeEach

      const store = useThemeStore()
      store.initFromStorage()

      expect(store.currentThemeId).toBe(defaultThemeId)
    })

    it('should fallback to default for invalid stored value', () => {
      localStorageMock['m4sh_theme'] = 'nonexistent'

      const store = useThemeStore()
      store.initFromStorage()

      expect(store.currentThemeId).toBe(defaultThemeId)
    })
  })

  describe('getters', () => {
    it('currentTheme should return theme tokens object', () => {
      const store = useThemeStore()
      store.setTheme('themeA')

      const theme = store.currentTheme
      expect(theme).toBeDefined()
      // Theme tokens have colorBrand
      expect(theme.colorBrand).toBeDefined()
    })

    it('cssVars should return CSS variables object', () => {
      const store = useThemeStore()
      const cssVars = store.cssVars

      expect(cssVars).toBeDefined()
      expect(typeof cssVars).toBe('object')
      expect(cssVars['--color-brand']).toBeDefined()
    })
  })
})
