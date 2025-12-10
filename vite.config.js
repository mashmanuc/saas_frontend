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
})
