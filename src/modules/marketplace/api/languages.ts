/**
 * Language catalog API client (v0.84.0)
 */
import { apiClient } from '@/api/client'

export interface Language {
  code: string
  title: string
  is_popular: boolean
  order: number
}

export interface LanguageTag {
  code: string
  title: string
  category: string
  order?: number
}

export interface LanguagesCatalog {
  languages: Language[]
  tags: {
    level?: LanguageTag[]
    format?: LanguageTag[]
    goal?: LanguageTag[]
    audience?: LanguageTag[]
  }
}

/**
 * Get all languages with translations
 */
// PR-FE-3 (2026-04-26): Fixed all 3 endpoints:
// - Removed double `/api/` prefix (baseURL already /api).
// - Wrong path order `/marketplace/v1/...` → `/v1/marketplace/...` (config/urls.py:66).
// BE routes verified: apps/marketplace/urls.py:117-122 mounted under
// `path('api/v1/marketplace/', include('apps.marketplace.urls'))` (config/urls.py:66).

export async function getLanguages(params?: {
  locale?: string
  popular_only?: boolean
}): Promise<Language[]> {
  return await apiClient.get('/v1/marketplace/catalog/languages/', {
    params: {
      locale: params?.locale || 'uk',
      popular_only: params?.popular_only || false,
    },
  })
}

/**
 * Get all language tags with translations
 */
export async function getLanguageTags(params?: {
  locale?: string
  category?: string
}): Promise<LanguageTag[]> {
  return await apiClient.get('/v1/marketplace/catalog/language-tags/', {
    params: {
      locale: params?.locale || 'uk',
      category: params?.category,
    },
  })
}

/**
 * Get complete languages catalog (languages + tags) in one request
 */
export async function getLanguagesCatalog(params?: {
  locale?: string
}): Promise<LanguagesCatalog> {
  return await apiClient.get('/v1/marketplace/catalog/languages-full/', {
    params: {
      locale: params?.locale || 'uk',
    },
  })
}
