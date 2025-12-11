import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

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
            './src/modules/board/components/Whiteboard.vue',
            './src/stores/boardStore.js',
          ],
          'chunk-chat': [
            './src/modules/chat/views/ChatView.vue',
            './src/modules/chat/components/ChatPanel.vue',
            './src/modules/chat/components/ChatMessage.vue',
            './src/stores/chatStore.js',
          ],
          'chunk-dashboard': [
            './src/modules/dashboard/views/DashboardView.vue',
            './src/modules/dashboard/views/DashboardTutor.vue',
            './src/modules/dashboard/views/DashboardStudent.vue',
          ],
          'chunk-notifications': [
            './src/modules/notifications/components/NotificationsDropdown.vue',
            './src/stores/notificationsStore.js',
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
      '@': '/src',
    },
  },
})
