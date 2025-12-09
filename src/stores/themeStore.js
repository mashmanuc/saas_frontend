import { defineStore } from 'pinia'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME = 'light'

// Available themes: light (green), dark (blue-cyan), classic (purple)
export const THEME_OPTIONS = Object.freeze(['light', 'dark', 'classic'])

const getStoredTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
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

      // Also set class for Tailwind dark mode compatibility
      if (theme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    },
  },
})
