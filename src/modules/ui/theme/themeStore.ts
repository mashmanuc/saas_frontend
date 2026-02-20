/**
 * Consolidated theme store — re-exports the canonical store from @/stores/themeStore.
 * The single Pinia store uses `data-theme` attribute on <html> and localStorage key `theme`.
 * Theme values: 'light' | 'dark' | 'classic'.
 *
 * This file exists for backward compatibility so imports from '@/modules/ui/theme' keep working.
 */
import { useThemeStore, THEME_OPTIONS } from '@/stores/themeStore'

export { useThemeStore, THEME_OPTIONS }

export type ThemeId = 'light' | 'dark' | 'classic'
