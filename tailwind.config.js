/** @type {import('tailwindcss').Config} */
// G-2 Stage 4 (PR-G2.4): import canonical breakpoint numbers from
// frontend/src/config/breakpoints.ts (single source of truth).
// Tailwind 3.4 uses jiti loader → can resolve .ts modules.
// Refs: saas_docs/plans/G2_CSS_TOKENS_RESEARCH_2026-05-02.md §6 Stage 4,
//       INV-G2-2: CSS не дублює layoutStore breakpoint numbers.
import { BREAKPOINTS } from './src/config/breakpoints.ts'

// Build Tailwind `screens` from canonical BREAKPOINTS.
// Tailwind defaults: sm=640, md=768, lg=1024, xl=1280, 2xl=1536 (matches BREAKPOINTS).
// Custom: xs=480, display=1920 (extensions, also matches BREAKPOINTS).
const screens = Object.fromEntries(
  Object.entries(BREAKPOINTS).map(([key, val]) => [key, `${val}px`]),
)

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    screens, // ← override defaults with canonical SSoT (replaces both default sm/md/lg/xl/2xl AND extends.screens.xs/display)
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        primary: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          foreground: 'var(--accent-contrast)',
        },
        secondary: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--text-primary)',
        },
        accent: 'var(--accent)',
        surface: {
          DEFAULT: 'var(--card-bg)',
          muted: 'var(--bg-secondary)',
          page: 'var(--bg-primary)',
        },
        foreground: 'var(--text-primary)',
        muted: {
          DEFAULT: 'var(--text-secondary)',
          foreground: 'var(--text-secondary)',
        },
        border: 'var(--border-color)',
        danger: 'var(--danger-bg)',
        success: 'var(--success-bg)',
        warning: 'var(--warning-bg)',
        info: 'var(--info-bg)',
      },
      borderRadius: {
        xs:   'var(--radius-xs)',
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      // screens defined у theme.screens above (replaces defaults from canonical SSoT).
      // Removed extends.screens.xs/display — duplicate now lives in BREAKPOINTS.
      boxShadow: {
        theme: '0 8px 25px var(--shadow)',
        'theme-strong': '0 12px 35px var(--shadow-strong)',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky:   'var(--z-sticky)',
        overlay:  'var(--z-overlay)',
        modal:    'var(--z-modal)',
        toast:    'var(--z-toast)',
        tooltip:  'var(--z-tooltip)',
      },
    },
  },
  plugins: [],
}
