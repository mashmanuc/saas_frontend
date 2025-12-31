import apiClient from '@/utils/apiClient'

export interface Locale {
  code: string
  name: string
  native_name: string
  is_active: boolean
  is_default: boolean
  translation_progress: number
}

export interface MissingTranslation {
  key: string
  namespace: string | null
  default_value: string | null
  description: string | null
}

export interface MissingTranslationsResponse {
  count: number
  items: MissingTranslation[]
}

export const i18nApi = {
  getLocales: async () => {
    return await apiClient.get<Locale[]>('/v1/i18n/locales/')
  },

  getMissingTranslations: async (locale: string) => {
    return await apiClient.get<MissingTranslationsResponse>(
      `/v1/i18n/translations/missing/${locale}/`
    )
  },

  getTranslationProgress: async () => {
    return await apiClient.get('/v1/i18n/progress/')
  },
}
