import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import i18n, { setupI18n } from './i18n'
import './assets/main.css'
import './assets/fullcalendar.css'
import './styles/m4sh.css'
import { useNotifyStore } from './stores/notifyStore'
import { useSettingsStore } from './stores/settingsStore'
import { useThemeStore } from './stores/themeStore'
import { useRealtimeStore } from './stores/realtimeStore'
import { useNotificationsStore } from './stores/notificationsStore'
import { useAuthStore } from './modules/auth/store/authStore'
import { createErrorCollector } from './modules/diagnostics/plugins/errorCollector'
import { initTokenRefresh } from './core/auth/tokenRefresh'
import { apiClient } from './utils/apiClient'
import VueKonva from 'vue-konva'

// Initialize calendar debug module (only in debug mode)
if (import.meta.env.VITE_CALENDAR_DEBUG === 'true') {
  import('./modules/booking/debug').then(module => {
    module.initCalendarDebug()
  })
}

const app = createApp(App)
app.use(pinia)
app.use(i18n)
app.use(VueKonva)

// Install error collector for diagnostics
const errorCollector = createErrorCollector({
  mode: import.meta.env.DEV ? 'console+remote' : 'console+remote'
})
app.use(errorCollector)

setupI18n(localStorage.getItem('locale') || 'uk').then(() => {
  const settings = useSettingsStore()
  settings.init()

  const theme = useThemeStore()
  theme.init()

  const notify = useNotifyStore()
  notify.init()

  const realtime = useRealtimeStore()
  realtime.init()

  const notifications = useNotificationsStore()
  notifications.init()

  // Initialize token refresh system
  const authStore = useAuthStore()
  initTokenRefresh({
    axiosInstance: apiClient,
    initialToken: authStore.access,
    onRefreshed: () => {
      console.log('[TokenRefresh] Token refreshed successfully')
    },
    onExpired: () => {
      console.warn('[TokenRefresh] Session expired')
      authStore.forceLogout()
    },
    onError: (error) => {
      console.error('[TokenRefresh] Refresh error:', error)
    }
  })

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      try {
        useRealtimeStore().dispose?.()
      } catch {
        // ignore
      }
      try {
        useNotificationsStore().dispose?.()
      } catch {
        // ignore
      }
      try {
        useAuthStore().dispose?.()
      } catch {
        // ignore
      }
    })
  }

  app.use(router)
  app.mount('#app')
})
