import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import i18n from './i18n'
import './assets/main.css'
import './assets/fullcalendar.css'
import './styles/m4sh.css'
import { useNotifyStore } from './stores/notifyStore'
import { useSettingsStore } from './stores/settingsStore'
import { useThemeStore } from './stores/themeStore'
import { useRealtimeStore } from './stores/realtimeStore'
import { useNotificationsStore } from './stores/notificationsStore'
import { createErrorCollector } from './modules/diagnostics/plugins/errorCollector'
import VueKonva from 'vue-konva'

const app = createApp(App)
app.use(pinia)
app.use(i18n)
app.use(VueKonva)

// Install error collector for diagnostics
const errorCollector = createErrorCollector({
  mode: import.meta.env.DEV ? 'console+remote' : 'console+remote'
})
app.use(errorCollector)

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

app.use(router)
app.mount('#app')
