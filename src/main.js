import { createApp, watch } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import i18n, { setupI18n, getInitialLocale } from './i18n'
import './styles/tokens.css'
import './assets/main.css'
import './assets/responsive.css'
import './modules/winterboard/styles/winterboard-responsive.css'
import './assets/fullcalendar.css'
import './styles/m4sh.css'
/* assets2/ui-contract/tokens removed — all tokens in src/styles/tokens.css */
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
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from '@/app/queryClient'
import { setupQueryBridge, teardownQueryBridge } from '@/services/queryBridge'

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
app.use(VueQueryPlugin, { queryClient })

// Install error collector for diagnostics
const errorCollector = createErrorCollector({
  mode: import.meta.env.DEV ? 'console+remote' : 'console+remote'
})
app.use(errorCollector)

setupI18n(getInitialLocale()).then(async () => {
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

  await authStore.bootstrap()

  // Phase 29: WS → Query invalidation bridge (after auth + realtime ready)
  setupQueryBridge({ queryClient })

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      try {
        teardownQueryBridge()
        queryClient.clear()
      } catch {
        // ignore
      }
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
