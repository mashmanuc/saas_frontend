import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '../../i18n/locales/uk.json'
import Preview from './Preview.vue'
createApp(Preview).use(createPinia()).use(createI18n({ legacy: false, locale: 'uk', messages: { uk } })).mount('#app')
