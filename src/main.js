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

const app = createApp(App)
app.use(pinia)
app.use(i18n)

const settings = useSettingsStore()
settings.init()

const theme = useThemeStore()
theme.init()

const notify = useNotifyStore()
notify.init()

app.use(router)
app.mount('#app')
