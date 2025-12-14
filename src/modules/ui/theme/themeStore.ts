import { defineStore } from 'pinia'
import { themes, defaultThemeId, themeToCssVars } from './themes'
import type { ThemeId, ThemeTokens } from './themes'

interface ThemeState {
  currentThemeId: ThemeId
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    currentThemeId: defaultThemeId,
  }),

  getters: {
    currentTheme(): ThemeTokens {
      return themes[this.currentThemeId]
    },

    cssVars(): Record<string, string> {
      return themeToCssVars(this.currentTheme)
    },

    isDarkTheme(): boolean {
      return this.currentThemeId === 'themeB'
    },
  },

  actions: {
    setTheme(themeId: ThemeId): void {
      if (!themes[themeId]) {
        console.warn(`[ThemeStore] Unknown theme: ${themeId}, falling back to default`)
        themeId = defaultThemeId
      }

      this.currentThemeId = themeId
      this.applyTheme()

      // Track theme change
      console.log('[ui.theme_change]', { themeId })

      // Persist preference
      try {
        localStorage.setItem('m4sh_theme', themeId)
      } catch {
        // localStorage may be unavailable
      }
    },

    applyTheme(): void {
      const vars = this.cssVars
      const root = document.documentElement

      Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value)
      })
    },

    initFromStorage(): void {
      try {
        const stored = localStorage.getItem('m4sh_theme') as ThemeId | null
        if (stored && themes[stored]) {
          this.currentThemeId = stored
        }
      } catch {
        // localStorage may be unavailable
      }

      this.applyTheme()
    },

    initFromRouteMeta(meta: { themeId?: ThemeId }): void {
      if (meta.themeId && themes[meta.themeId]) {
        this.currentThemeId = meta.themeId
        this.applyTheme()
      }
    },
  },
})
