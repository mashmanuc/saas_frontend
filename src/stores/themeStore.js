import { defineStore } from 'pinia'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME = 'light'

// Теми: light (зелена), dark («Графіт», нейтральна сіра), classic («Біла класика»: білий і
// нейтральний сірий, акцент — зелений бренду). Кольори — у `assets/main.css`, контракт —
// saas_docs/frontend/design-system/DARK_THEME_CONTRACT_2026-10-05.md.
export const THEME_OPTIONS = Object.freeze(['light', 'dark', 'classic'])

// Запасна палітра темної теми «Нічний ліс» — прихована (рішення власника 2026-10-05:
// «став тему Графіт, а Ліс запасна і прихована»). У меню її немає; вмикається лише
// вручну: localStorage dark_palette = 'forest' і перезавантажити сторінку.
const DARK_PALETTE_KEY = 'dark_palette'
const HIDDEN_DARK_PALETTES = Object.freeze(['forest'])

const getStoredTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
}

const getStoredDarkPalette = () => {
  if (typeof window === 'undefined') return null
  const value = localStorage.getItem(DARK_PALETTE_KEY)
  return HIDDEN_DARK_PALETTES.includes(value) ? value : null
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: getStoredTheme(),
    _mediaQuery: null,
    _systemListener: null,
  }),

  actions: {
    init() {
      if (typeof window === 'undefined') return

      if (!this._mediaQuery) {
        this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      }

      if (!this._systemListener) {
        this._systemListener = (event) => {
          if (this.theme === 'system') {
            this.applyTheme('system', event.matches)
          }
        }

        if (this._mediaQuery.addEventListener) {
          this._mediaQuery.addEventListener('change', this._systemListener)
        } else if (this._mediaQuery.addListener) {
          this._mediaQuery.addListener(this._systemListener)
        }
      }

      this.applyTheme(this.theme)
    },

    setTheme(value) {
      if (!THEME_OPTIONS.includes(value)) {
        value = DEFAULT_THEME
      }

      this.theme = value

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, value)
      }

      this.applyTheme(value)
    },

    applyTheme(theme) {
      if (typeof document === 'undefined') return

      const root = document.documentElement

      // Set data-theme attribute for CSS variable switching
      root.setAttribute('data-theme', theme)

      // Запасна палітра темної теми (прихована, див. вище) — лише поверх dark
      const palette = theme === 'dark' ? getStoredDarkPalette() : null
      if (palette) {
        root.setAttribute('data-dark-palette', palette)
      } else {
        root.removeAttribute('data-dark-palette')
      }

      // Also set class for Tailwind dark mode compatibility
      if (theme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    },
  },
})
