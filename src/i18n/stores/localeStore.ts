// F3: Locale Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { i18nApi, SupportedLocale } from '../api/i18n'
import { setLocale } from '../index'
import { LANGUAGES, getLanguageByCode } from '@/config/languages'

export const useLocaleStore = defineStore('locale', () => {
  // State
  const currentLocale = ref<string>(localStorage.getItem('locale') || 'uk')
  const supportedLocales = ref<SupportedLocale[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const currentLocaleInfo = computed(() => getLanguageByCode(currentLocale.value))

  const activeLocales = computed(() =>
    supportedLocales.value.filter((l) => l.is_active)
  )

  const localeOptions = computed(() =>
    activeLocales.value.map((l) => ({
      label: l.native_name,
      value: l.code,
    }))
  )

  const isRTL = computed(() => {
    const rtlLocales = ['ar', 'he', 'fa']
    return rtlLocales.includes(currentLocale.value)
  })

  // Actions
  async function loadSupportedLocales() {
    isLoading.value = true
    error.value = null
    try {
      supportedLocales.value = await i18nApi.getLocales()
    } catch (e: any) {
      error.value = e.message || 'Failed to load locales'
      // Fallback to config languages
      supportedLocales.value = LANGUAGES.slice(0, 4).map((l) => ({
        code: l.code,
        name: l.name,
        native_name: l.native,
        is_active: true,
        is_default: l.code === 'uk',
        translation_progress: 100,
      }))
    } finally {
      isLoading.value = false
    }
  }

  async function changeLocale(locale: string) {
    await setLocale(locale)
    currentLocale.value = locale

    // Sync with backend if authenticated
    try {
      await i18nApi.setUserLocale(locale)
    } catch {
      // Ignore if not authenticated
    }
  }

  async function initLocale(userPreference?: string) {
    // Priority: user preference > localStorage > browser > default
    const storedLocale = localStorage.getItem('locale')
    const browserLocale = navigator.language.split('-')[0]

    const locale = userPreference || storedLocale || browserLocale || 'uk'

    const supportedCodes = LANGUAGES.slice(0, 4).map((l) => l.code)
    const finalLocale = supportedCodes.includes(locale) ? locale : 'uk'

    await changeLocale(finalLocale)
  }

  function $reset() {
    currentLocale.value = 'uk'
    supportedLocales.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    currentLocale,
    supportedLocales,
    isLoading,
    error,

    // Computed
    currentLocaleInfo,
    activeLocales,
    localeOptions,
    isRTL,

    // Actions
    loadSupportedLocales,
    changeLocale,
    initLocale,
    $reset,
  }
})
