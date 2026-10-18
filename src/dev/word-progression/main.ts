import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import Preview from './Preview.vue'

// Окремий локальний entry; App, логін, платні AI й продова БД не запускаються.
if (!import.meta.env.DEV) throw new Error('Цей перегляд доступний лише локально.')
createApp(Preview).use(createPinia())
  .use(createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } }))
  .mount('#app')
