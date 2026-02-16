import apiClient from '@/utils/apiClient'

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

/**
 * Fetch cities from geo API
 * v1.0: City fields for tutor profiles
 */
export async function fetchCities(params: FetchCitiesParams): Promise<City[]> {
  const response = await apiClient.get('/v1/geo/cities/', {
    params: {
      country: params.country,
      query: params.query
    }
  })
  return response.data as City[]
}

/**
 * Fetch single city by code
 * v1.0: City fields for tutor profiles
 */
export async function fetchCityByCode(code: string): Promise<City | null> {
  try {
    const response = await apiClient.get(`/v1/geo/cities/${code}/`)
    return response.data as City
  } catch {
    return null
  }
}
