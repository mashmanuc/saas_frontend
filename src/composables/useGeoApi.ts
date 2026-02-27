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

export function useGeoApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // AbortController for cancelling stale requests (race condition prevention)
  let currentController: AbortController | null = null

  async function fetchCities(params: FetchCitiesParams): Promise<City[]> {
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
          query: params.query
        },
        signal: controller.signal
      })
      return (cities as unknown as City[]) || []
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
    error
  }
}
