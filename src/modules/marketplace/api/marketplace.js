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

    return apiClient.get('/marketplace/tutors/', { params })
  },

  async getTutorProfile(slug) {
    if (!slug) throw new Error('Tutor slug is required')
    return apiClient.get(`/marketplace/tutors/${slug}/`)
  },

  async getMyProfile() {
    return apiClient.get('/marketplace/profile/')
  },

  async createProfile(data) {
    return apiClient.post('/marketplace/profile/', data)
  },

  async updateProfile(id, data) {
    if (typeof id !== 'number') throw new Error('Profile id is required')
    return apiClient.patch('/marketplace/profile/', data)
  },

  async submitForReview() {
    return apiClient.post('/marketplace/profile/submit/')
  },

  async publishProfile(id) {
    if (typeof id !== 'number') throw new Error('Profile id is required')
    return apiClient.post('/marketplace/profile/publish/')
  },

  async unpublishProfile(id) {
    if (typeof id !== 'number') throw new Error('Profile id is required')
    return apiClient.post('/marketplace/profile/unpublish/')
  },

  async getFilterOptions() {
    const response = await apiClient.get('/marketplace/filters/')
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
}

export default marketplaceApi
