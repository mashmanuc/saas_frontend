/**
 * UI Contract Integration - Smoke Test
 * Перевіряє базову інтеграцію токенів та тем
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

describe('UI Contract Tokens Integration', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
  })

  it.skip('токени ui-contract завантажені глобально', () => {
    const styles = Array.from(document.styleSheets)
    const hasTokens = styles.some(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || [])
        return rules.some(rule => 
          rule.cssText && rule.cssText.includes('--ui-color-primary')
        )
      } catch {
        return false
      }
    })
    
    expect(hasTokens).toBe(true)
  })

  it('data-theme атрибут встановлюється на root елементі', async () => {
    const { useThemeStore } = await import('../../src/stores/themeStore.js')
    const themeStore = useThemeStore(pinia)
    
    const root = document.documentElement
    themeStore.applyTheme('light')
    
    expect(root.getAttribute('data-theme')).toBe('light')
    
    themeStore.applyTheme('dark')
    expect(root.getAttribute('data-theme')).toBe('dark')
    
    themeStore.applyTheme('classic')
    expect(root.getAttribute('data-theme')).toBe('classic')
  })

  it.skip('CSS змінні ui-contract наслідують main.css', () => {
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)
    
    // Перевіряємо, що змінні визначені
    const primaryColor = computedStyle.getPropertyValue('--ui-color-primary')
    const bgColor = computedStyle.getPropertyValue('--ui-color-bg')
    
    expect(primaryColor).toBeTruthy()
    expect(bgColor).toBeTruthy()
  })

  it('теми перемикаються без помилок', async () => {
    const { useThemeStore } = await import('../../src/stores/themeStore.js')
    const themeStore = useThemeStore(pinia)
    
    const themes = ['light', 'dark', 'classic']
    
    for (const theme of themes) {
      expect(() => themeStore.setTheme(theme)).not.toThrow()
      expect(themeStore.theme).toBe(theme)
      expect(document.documentElement.getAttribute('data-theme')).toBe(theme)
    }
  })
})
