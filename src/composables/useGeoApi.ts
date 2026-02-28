import { ref } from 'vue'
import { apiClient as api } from '@/api/client'

export interface City {
  code: string
  name: string
  name_uk: string
  slug: string
  country_code: string
}

export interface FetchCitiesParams {
  country: string
  query?: string
}

// --- LRU-кеш результатів пошуку ---
// Module-level: один кеш на весь додаток, живе протягом сесії.
// JS Map зберігає порядок вставки — використовуємо це для LRU (найстаріший — перший).

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 хвилин — міста не змінюються часто
const CACHE_MAX_SIZE = 50 // максимум 50 унікальних запитів

interface CacheEntry {
  cities: City[]
  ts: number
}

const cityCache = new Map<string, CacheEntry>()

function cacheKey(params: FetchCitiesParams): string {
  return `${params.country}:${(params.query ?? '').toLowerCase().trim()}`
}

function cacheGet(key: string): City[] | null {
  const entry = cityCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cityCache.delete(key)
    return null
  }
  // LRU: переміщуємо в кінець при зверненні (Map зберігає порядок)
  cityCache.delete(key)
  cityCache.set(key, entry)
  return entry.cities
}

function cacheSet(key: string, cities: City[]): void {
  // Витісняємо найстаріший запис коли кеш повний
  if (cityCache.size >= CACHE_MAX_SIZE) {
    const oldest = cityCache.keys().next().value
    if (oldest !== undefined) cityCache.delete(oldest)
  }
  cityCache.set(key, { cities, ts: Date.now() })
}
// --- кінець кешу ---

export function useGeoApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // AbortController для скасування застарілих запитів
  let currentController: AbortController | null = null

  async function fetchCities(params: FetchCitiesParams): Promise<City[]> {
    const key = cacheKey(params)

    // Кеш-хіт: повертаємо без запиту, без spinner — миттєво
    const cached = cacheGet(key)
    if (cached) return cached

    // Cancel any in-flight request before starting a new one
    if (currentController) {
      currentController.abort()
    }
    const controller = new AbortController()
    currentController = controller

    loading.value = true
    error.value = null

    try {
      // apiClient interceptor auto-unwraps res.data, so result is already the array
      const cities = await api.get('/v1/geo/cities/', {
        params: {
          country: params.country,
          query: params.query,
        },
        signal: controller.signal,
      })
      const result = (cities as unknown as City[]) || []
      // Кешуємо лише успішні непорожні відповіді
      if (result.length > 0) cacheSet(key, result)
      return result
    } catch (e: any) {
      // Silently ignore aborted requests — they are expected
      if (e?.name === 'AbortError' || e?.name === 'CanceledError' || controller.signal.aborted) {
        return []
      }
      error.value = 'Failed to fetch cities'
      return []
    } finally {
      // Only update loading if this is still the active request
      if (currentController === controller) {
        loading.value = false
        currentController = null
      }
    }
  }

  function cancelPending() {
    if (currentController) {
      currentController.abort()
      currentController = null
      loading.value = false
    }
  }

  return {
    fetchCities,
    cancelPending,
    loading,
    error,
  }
}
