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

  async function fetchCities(params: FetchCitiesParams): Promise<City[]> {
    loading.value = true
    error.value = null
    
    try {
      // apiClient interceptor auto-unwraps res.data, so result is already the array
      const cities = await api.get('/v1/geo/cities/', {
        params: {
          country: params.country,
          query: params.query
        }
      })
      return (cities as unknown as City[]) || []
    } catch (e) {
      error.value = 'Failed to fetch cities'
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    fetchCities,
    loading,
    error
  }
}
