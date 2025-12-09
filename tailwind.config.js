/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
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
      boxShadow: {
        theme: '0 8px 25px var(--shadow)',
        'theme-strong': '0 12px 35px var(--shadow-strong)',
      },
    },
  },
  plugins: [],
}
