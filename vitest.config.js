import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/modules/profile/**/*.{js,vue}'],
    },
  },
})
