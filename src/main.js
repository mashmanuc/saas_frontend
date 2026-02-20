import { createApp, watch } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import i18n, { setupI18n } from './i18n'
import './styles/tokens.css'
import './assets/main.css'
import './assets/fullcalendar.css'
import './styles/m4sh.css'
import './assets2/ui-contract/tokens/tokens.css'
import { notifications as notificationBus } from './utils/notify'
import { useNotifyStore } from './stores/notifyStore'
import { useSettingsStore } from './stores/settingsStore'
import { useThemeStore } from './stores/themeStore'
import { useRealtimeStore } from './stores/realtimeStore'
import { useNotificationsStore } from './stores/notificationsStore'
import { useAuthStore } from './modules/auth/store/authStore'
import { createErrorCollector } from './modules/diagnostics/plugins/errorCollector'
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

setupI18n(localStorage.getItem('locale') || 'uk').then(async () => {
  const settings = useSettingsStore()
  settings.init()

  const theme = useThemeStore()
  theme.init()

  const notify = useNotifyStore()
  notify.init()
  try {
    notificationBus.init({
      exposeDebug: import.meta.env.DEV,
      debugNamespace: '__M4_DEBUG__',
    })
  } catch (error) {
    console.error('[main] Failed to initialize notification bus:', error)
  }

  const realtime = useRealtimeStore()
  realtime.init()

  const authStore = useAuthStore()
  const notificationsStore = useNotificationsStore()

  await authStore.bootstrap()

  const preloadNotifications = () => {
    if (!notificationsStore.items.length) {
      notificationsStore
        .loadNotifications({ limit: 10 })
        .catch((error) => console.error('[main] Failed to preload notifications:', error))
    }
  }

  if (authStore.isAuthenticated) {
    preloadNotifications()
  } else {
    const stopWatch = watch(
      () => authStore.isAuthenticated,
      (isAuth) => {
        if (isAuth) {
          preloadNotifications()
          stopWatch()
        }
      }
    )
  }

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
