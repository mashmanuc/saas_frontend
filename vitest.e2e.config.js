import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Vitest E2E stub config (v0.49.5)
 * Використовується командою `npm run test:e2e`
 * для швидкої smoke-перевірки e2e-компонентів без Playwright.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/e2e/**/*.vitest.{ts,js}'],
    exclude: ['tests/e2e/**/*.spec.ts'],
    reporters: ['default'],
  },
})
