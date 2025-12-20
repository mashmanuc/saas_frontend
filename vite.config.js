import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Get git info for app version
function getGitInfo() {
  try {
    const tag = execSync('git describe --tags --always').toString().trim()
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    return `${tag}+${hash}`
  } catch {
    return 'dev'
  }
}

const fullcalendarCssMockPlugin = () => ({
  name: 'fullcalendar-css-mock',
  enforce: 'pre',
  resolveId(id) {
    if (id.startsWith('@fullcalendar/') && id.endsWith('.css')) {
      return { id: '\0fullcalendar-css-mock', moduleSideEffects: false }
    }
    return null
  },
  load(id) {
    if (id === '\0fullcalendar-css-mock') {
      return ''
    }
    return null
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), fullcalendarCssMockPlugin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(getGitInfo()),
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    css: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-ui': ['lucide-vue-next'],
          'vendor-utils': ['dayjs', 'axios'],
          
          // Feature chunks
          'chunk-whiteboard': [
            './src/modules/board/views/BoardView.vue',
            './src/stores/boardStore.js',
          ],
          'chunk-chat': [
            './src/modules/chat/components/ChatPanel.vue',
            './src/modules/chat/components/ChatMessage.vue',
            './src/stores/chatStore.js',
          ],
          'chunk-dashboard': [
            './src/modules/dashboard/views/DashboardTutor.vue',
            './src/modules/dashboard/views/DashboardStudent.vue',
          ],
        },
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
  },
  // Resolve aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
})
