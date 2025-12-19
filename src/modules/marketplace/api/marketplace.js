import apiClient from '../../../utils/apiClient'

// Runtime API object (used by non-TS imports).
// Keep this in sync with marketplace.ts.

export const marketplaceApi = {
  async getTutors(filters = {}, page = 1, pageSize = 20, sort = 'rating') {
    const params = {
      ...(filters || {}),
      page,
      page_size: Math.min(Number(pageSize) || 20, 24),
      sort,
    }

    if (typeof params.q === 'string') {
      const v = params.q.trim()
      if (v.length < 2) {
        delete params.q
      } else {
        params.q = v
      }
    }

    return apiClient.get('/v1/marketplace/tutors/', { params })
  },

  async getTutorProfile(slug) {
    if (!slug) throw new Error('Tutor slug is required')
    return apiClient.get(`/v1/marketplace/tutors/${slug}/`)
  },

  async getMyProfile() {
    return apiClient.get('/v1/marketplace/tutors/me/')
  },

  async createProfile(data) {
    return apiClient.patch('/v1/marketplace/tutors/me/', data)
  },

  async updateProfile(data) {
    return apiClient.patch('/v1/marketplace/tutors/me/', data)
  },

  async submitForReview() {
    return apiClient.post('/v1/marketplace/tutors/me/submit/')
  },

  async publishProfile() {
    return apiClient.post('/v1/marketplace/tutors/me/publish/')
  },

  async unpublishProfile() {
    return apiClient.post('/v1/marketplace/tutors/me/unpublish/')
  },

  async getWeeklyAvailability(slug, params) {
    if (!slug) throw new Error('Tutor slug is required')
    return apiClient.get(`/v1/marketplace/tutors/${slug}/availability/weekly/`, { params })
  },

  async createTrialRequest(slug, payload) {
    if (!slug) throw new Error('Tutor slug is required')
    return apiClient.post(`/v1/marketplace/tutors/${slug}/trial-request/`, payload)
  },

  async getFilterOptions() {
    const response = await apiClient.get('/v1/marketplace/filters/')
    const rawPrice = response.priceRange || response.price_range || {}

    const normalizeOption = (item, keys) => {
      if (!item || typeof item !== 'object') return null

      const pickFirst = (obj, candidates) => {
        for (const k of candidates) {
          if (obj[k] != null) return obj[k]
        }
        return undefined
      }

      const value = pickFirst(item, keys.value)
      const label = pickFirst(item, keys.label)
      const count = pickFirst(item, keys.count)

      if (value == null || label == null) return null

      return {
        value: String(value),
        label: String(label),
        count: Number(count || 0),
      }
    }

    return {
      subjects: Array.isArray(response.subjects)
        ? response.subjects
            .map((s) =>
              normalizeOption(s, {
                value: ['value', 'slug', 'code'],
                label: ['label', 'name'],
                count: ['count', 'tutor_count'],
              })
            )
            .filter(Boolean)
        : [],
      countries: Array.isArray(response.countries)
        ? response.countries
            .map((c) =>
              normalizeOption(c, {
                value: ['value', 'code'],
                label: ['label', 'name'],
                count: ['count'],
              })
            )
            .filter(Boolean)
        : [],
      languages: Array.isArray(response.languages)
        ? response.languages
            .map((l) =>
              normalizeOption(l, {
                value: ['value', 'code'],
                label: ['label', 'name'],
                count: ['count'],
              })
            )
            .filter(Boolean)
        : [],
      priceRange: {
        min: Number(rawPrice.min || 0),
        max: Number(rawPrice.max || 0),
      },
    }
  },

  async search(params) {
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== '')
    )
    return apiClient.get('/v1/marketplace/search/', { params: cleanParams })
  },

  async getSearchSuggestions(query) {
    return apiClient.get('/v1/marketplace/search/suggestions/', { params: { q: query } })
  },

  async getExtendedFilterOptions() {
    return apiClient.get('/v1/marketplace/filters/')
  },

  async getCategories() {
    return apiClient.get('/v1/marketplace/categories/')
  },

  async getPopularTutors(limit = 10) {
    return apiClient.get('/v1/marketplace/tutors/popular/', { params: { limit } })
  },

  async getNewTutors(limit = 10) {
    return apiClient.get('/v1/marketplace/tutors/new/', { params: { limit } })
  },

  async getRecommendedTutors(limit = 10) {
    return apiClient.get('/v1/marketplace/tutors/recommended/', { params: { limit } })
  },

  async getFeaturedTutors(limit = 10) {
    return apiClient.get('/v1/marketplace/tutors/featured/', { params: { limit } })
  },

  async getSimilarTutors(slug, limit = 5) {
    if (!slug) throw new Error('Tutor slug is required')
    return apiClient.get(`/v1/marketplace/tutors/${slug}/similar/`, { params: { limit } })
  },

  async logSearchClick(searchLogId, profileId, position) {
    await apiClient.post('/v1/marketplace/search/log-click/', {
      search_log_id: searchLogId,
      profile_id: profileId,
      position,
    })
  },
}

export default marketplaceApi
