/**
 * M4SH Theme System - 3 Global Themes
 * Inspired by Kami's clean, professional aesthetic
 */

export type ThemeId = 'themeA' | 'themeB' | 'themeC'

export interface ThemeTokens {
  // Background
  colorBg: string
  colorBgSecondary: string
  colorBgTertiary: string
  colorBgHover: string
  colorBgActive: string

  // Foreground / Text
  colorFg: string
  colorFgSecondary: string
  colorFgTertiary: string
  colorFgInverse: string

  // Brand / Accent
  colorBrand: string
  colorBrandLight: string
  colorBrandDark: string

  // Semantic
  colorSuccess: string
  colorSuccessLight: string
  colorWarning: string
  colorWarningLight: string
  colorError: string
  colorErrorLight: string
  colorInfo: string
  colorInfoLight: string

  // Border
  colorBorder: string
  colorBorderStrong: string
  colorBorderFocus: string

  // Shadows
  shadowSm: string
  shadowMd: string
  shadowLg: string
  shadowElev: string

  // Radius
  radiusSm: string
  radiusMd: string
  radiusLg: string
  radiusXl: string
  radiusFull: string

  // Toolbar specific
  toolbarBg: string
  toolbarBorder: string
  toolbarShadow: string
  toolbarBtnHover: string
  toolbarBtnActive: string
}

/**
 * Theme A: Light Professional (Default)
 * Clean white background with blue accents - similar to Kami
 */
export const themeA: ThemeTokens = {
  // Background
  colorBg: '#ffffff',
  colorBgSecondary: '#f8fafc',
  colorBgTertiary: '#f1f5f9',
  colorBgHover: '#f1f5f9',
  colorBgActive: '#e2e8f0',

  // Foreground
  colorFg: '#0f172a',
  colorFgSecondary: '#475569',
  colorFgTertiary: '#94a3b8',
  colorFgInverse: '#ffffff',

  // Brand - Professional Blue
  colorBrand: '#2563eb',
  colorBrandLight: '#dbeafe',
  colorBrandDark: '#1d4ed8',

  // Semantic
  colorSuccess: '#16a34a',
  colorSuccessLight: '#dcfce7',
  colorWarning: '#d97706',
  colorWarningLight: '#fef3c7',
  colorError: '#dc2626',
  colorErrorLight: '#fee2e2',
  colorInfo: '#0284c7',
  colorInfoLight: '#e0f2fe',

  // Border
  colorBorder: '#e2e8f0',
  colorBorderStrong: '#cbd5e1',
  colorBorderFocus: '#2563eb',

  // Shadows
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  shadowElev: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',

  // Radius
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  radiusXl: '1rem',
  radiusFull: '9999px',

  // Toolbar
  toolbarBg: '#ffffff',
  toolbarBorder: '#e2e8f0',
  toolbarShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  toolbarBtnHover: '#f1f5f9',
  toolbarBtnActive: '#dbeafe',
}

/**
 * Theme B: Dark Professional
 * Dark mode with purple accents for focus sessions
 */
export const themeB: ThemeTokens = {
  // Background
  colorBg: '#0f172a',
  colorBgSecondary: '#1e293b',
  colorBgTertiary: '#334155',
  colorBgHover: '#334155',
  colorBgActive: '#475569',

  // Foreground
  colorFg: '#f8fafc',
  colorFgSecondary: '#cbd5e1',
  colorFgTertiary: '#94a3b8',
  colorFgInverse: '#0f172a',

  // Brand - Purple
  colorBrand: '#8b5cf6',
  colorBrandLight: '#2e1065',
  colorBrandDark: '#a78bfa',

  // Semantic
  colorSuccess: '#22c55e',
  colorSuccessLight: '#14532d',
  colorWarning: '#f59e0b',
  colorWarningLight: '#451a03',
  colorError: '#ef4444',
  colorErrorLight: '#450a0a',
  colorInfo: '#38bdf8',
  colorInfoLight: '#0c4a6e',

  // Border
  colorBorder: '#334155',
  colorBorderStrong: '#475569',
  colorBorderFocus: '#8b5cf6',

  // Shadows
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
  shadowElev: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',

  // Radius
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  radiusXl: '1rem',
  radiusFull: '9999px',

  // Toolbar
  toolbarBg: '#1e293b',
  toolbarBorder: '#334155',
  toolbarShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  toolbarBtnHover: '#334155',
  toolbarBtnActive: '#2e1065',
}

/**
 * Theme C: Warm Cream
 * Soft, warm tones for comfortable extended use
 */
export const themeC: ThemeTokens = {
  // Background
  colorBg: '#fefdfb',
  colorBgSecondary: '#faf8f5',
  colorBgTertiary: '#f5f0e8',
  colorBgHover: '#f5f0e8',
  colorBgActive: '#ebe4d8',

  // Foreground
  colorFg: '#292524',
  colorFgSecondary: '#57534e',
  colorFgTertiary: '#a8a29e',
  colorFgInverse: '#fefdfb',

  // Brand - Warm Orange
  colorBrand: '#ea580c',
  colorBrandLight: '#ffedd5',
  colorBrandDark: '#c2410c',

  // Semantic
  colorSuccess: '#15803d',
  colorSuccessLight: '#dcfce7',
  colorWarning: '#b45309',
  colorWarningLight: '#fef3c7',
  colorError: '#b91c1c',
  colorErrorLight: '#fee2e2',
  colorInfo: '#0369a1',
  colorInfoLight: '#e0f2fe',

  // Border
  colorBorder: '#e7e5e4',
  colorBorderStrong: '#d6d3d1',
  colorBorderFocus: '#ea580c',

  // Shadows
  shadowSm: '0 1px 2px rgba(41, 37, 36, 0.05)',
  shadowMd: '0 4px 6px -1px rgba(41, 37, 36, 0.1), 0 2px 4px -2px rgba(41, 37, 36, 0.1)',
  shadowLg: '0 10px 15px -3px rgba(41, 37, 36, 0.1), 0 4px 6px -4px rgba(41, 37, 36, 0.1)',
  shadowElev: '0 20px 25px -5px rgba(41, 37, 36, 0.1), 0 8px 10px -6px rgba(41, 37, 36, 0.1)',

  // Radius
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  radiusXl: '1rem',
  radiusFull: '9999px',

  // Toolbar
  toolbarBg: '#fefdfb',
  toolbarBorder: '#e7e5e4',
  toolbarShadow: '0 4px 12px rgba(41, 37, 36, 0.08)',
  toolbarBtnHover: '#f5f0e8',
  toolbarBtnActive: '#ffedd5',
}

export const themes: Record<ThemeId, ThemeTokens> = {
  themeA,
  themeB,
  themeC,
}

export const defaultThemeId: ThemeId = 'themeA'

/**
 * Convert theme tokens to CSS custom properties
 */
export function themeToCssVars(theme: ThemeTokens): Record<string, string> {
  return {
    '--color-bg': theme.colorBg,
    '--color-bg-secondary': theme.colorBgSecondary,
    '--color-bg-tertiary': theme.colorBgTertiary,
    '--color-bg-hover': theme.colorBgHover,
    '--color-bg-active': theme.colorBgActive,

    '--color-fg': theme.colorFg,
    '--color-fg-secondary': theme.colorFgSecondary,
    '--color-fg-tertiary': theme.colorFgTertiary,
    '--color-fg-inverse': theme.colorFgInverse,

    '--color-brand': theme.colorBrand,
    '--color-brand-light': theme.colorBrandLight,
    '--color-brand-dark': theme.colorBrandDark,

    '--color-success': theme.colorSuccess,
    '--color-success-light': theme.colorSuccessLight,
    '--color-warning': theme.colorWarning,
    '--color-warning-light': theme.colorWarningLight,
    '--color-error': theme.colorError,
    '--color-error-light': theme.colorErrorLight,
    '--color-info': theme.colorInfo,
    '--color-info-light': theme.colorInfoLight,

    '--color-border': theme.colorBorder,
    '--color-border-strong': theme.colorBorderStrong,
    '--color-border-focus': theme.colorBorderFocus,

    '--shadow-sm': theme.shadowSm,
    '--shadow-md': theme.shadowMd,
    '--shadow-lg': theme.shadowLg,
    '--shadow-elev': theme.shadowElev,

    '--radius-sm': theme.radiusSm,
    '--radius-md': theme.radiusMd,
    '--radius-lg': theme.radiusLg,
    '--radius-xl': theme.radiusXl,
    '--radius-full': theme.radiusFull,

    '--toolbar-bg': theme.toolbarBg,
    '--toolbar-border': theme.toolbarBorder,
    '--toolbar-shadow': theme.toolbarShadow,
    '--toolbar-btn-hover': theme.toolbarBtnHover,
    '--toolbar-btn-active': theme.toolbarBtnActive,

    // Legacy aliases for backward compatibility
    '--color-primary': theme.colorBrand,
    '--color-primary-light': theme.colorBrandLight,
    '--color-text-primary': theme.colorFg,
    '--color-text-secondary': theme.colorFgSecondary,
    '--color-text-tertiary': theme.colorFgTertiary,
  }
}
