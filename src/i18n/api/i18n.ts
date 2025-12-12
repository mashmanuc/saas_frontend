// F2: i18n API Client
import apiClient from '@/utils/apiClient'

export interface SupportedLocale {
  code: string
  name: string
  native_name: string
  is_active: boolean
  is_default: boolean
  translation_progress: number
}

export interface TranslationNamespace {
  namespace: string
  translations: Record<string, string>
}

export const i18nApi = {
  // Get supported locales
  getLocales: async (): Promise<SupportedLocale[]> => {
    const response = await apiClient.get<SupportedLocale[]>('/i18n/locales/')
    return response.data
  },

  // Get translations for locale
  getTranslations: async (
    locale: string,
    namespace?: string
  ): Promise<Record<string, string>> => {
    const response = await apiClient.get<Record<string, string>>(
      `/i18n/translations/${locale}/`,
      { params: { namespace } }
    )
    return response.data
  },

  // Set user locale preference
  setUserLocale: async (locale: string): Promise<void> => {
    await apiClient.post('/i18n/user/locale/', { locale })
  },

  // Get missing translations (admin)
  getMissingTranslations: async (locale: string): Promise<string[]> => {
    const response = await apiClient.get<string[]>(
      `/i18n/translations/missing/${locale}/`
    )
    return response.data
  },
}
