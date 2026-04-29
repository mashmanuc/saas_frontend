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
      // Ensure media files (avatars, uploads) are served from backend in dev mode
      '/media': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // Winterboard API (legacy direct path)
      '/winterboard/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // WebSocket connections — all /ws/* endpoints (gateway, winterboard, inquiries, calendar, room, webrtc, etc.)
      '/ws': {
        target: process.env.VITE_DEV_WS_TARGET || 'ws://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      // Legacy WebSocket path (kept for backward compat)
      '/websocket': {
        target: process.env.VITE_DEV_WS_TARGET || 'ws://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  test: {
    css: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks — stable caching for node_modules
          if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) return 'vendor-vue'
          if (id.includes('node_modules/konva')) return 'vendor-konva'
          // Phase O PR-O4: Three.js dedicated chunk — used only by lazy-loaded
          // SolidCardRenderer (geometry_solid). Keeps main / chunk-winterboard
          // small; loaded only коли board first renders solid asset.
          if (id.includes('node_modules/three')) return 'vendor-three'
          if (id.includes('node_modules/lucide-vue-next')) return 'vendor-ui'
          if (id.includes('node_modules/dayjs') || id.includes('node_modules/axios')) return 'vendor-utils'
          if (id.includes('node_modules/vue-i18n')) return 'vendor-i18n'

          // Feature modules — split by domain (only src/ files, not node_modules)
          if (id.includes('/src/')) {
            if (id.includes('/modules/winterboard/')) return 'chunk-winterboard'
            if (id.includes('/modules/chat/') || id.includes('/modules/chat-realtime/') || id.includes('/stores/chatStore')) return 'chunk-chat'
            if (id.includes('/modules/board/') || id.includes('/stores/boardStore')) return 'chunk-board'
            if (id.includes('/modules/marketplace/')) return 'chunk-marketplace'
            if (id.includes('/modules/booking/')) return 'chunk-booking'
            if (id.includes('/modules/knowledge/')) return 'chunk-knowledge'
          }
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
