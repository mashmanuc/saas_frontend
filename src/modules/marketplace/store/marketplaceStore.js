import { defineStore } from 'pinia'
import { fetchMarketplaceTutors, fetchMarketplaceTutor } from '../api/marketplace'

const SORT_TO_ORDERING = {
  relevance: null,
  price_asc: 'settings__hourly_rate',
  price_desc: '-settings__hourly_rate',
  experience: '-settings__experience_years',
  rating: '-tutor_profile__rating',
}

function normalizeFilters(filters = {}) {
  const params = {}
  if (filters.search) params.search = filters.search
  if (filters.subjects?.length) params.subject = filters.subjects[0]
  if (typeof filters.price_min === 'number') params.price_min = filters.price_min
  if (typeof filters.price_max === 'number') params.price_max = filters.price_max
  if (filters.experience) params.experience_min = filters.experience
  if (filters.language) params.language = filters.language
  if (filters.has_certifications !== null) params.has_certifications = filters.has_certifications

  const ordering = SORT_TO_ORDERING[filters.sort]
  if (ordering) params.ordering = ordering
  return params
}

function extractNextParams(payload) {
  if (!payload) {
    return null
  }

  if (payload.next_cursor) {
    return { cursor: payload.next_cursor }
  }

  if (payload.next) {
    try {
      const url = new URL(payload.next, globalThis?.location?.origin || 'http://localhost')
      const cursor = url.searchParams.get('cursor')
      if (cursor) {
        return { cursor }
      }
      const page = url.searchParams.get('page')
      if (page) {
        return { page: Number(page) || page }
      }
    } catch (_err) {
      return null
    }
  }

  return null
}

export const useMarketplaceStore = defineStore('marketplace', {
  state: () => ({
    tutors: [],
    cursor: null,
    hasMore: true,
    nextPageParams: null,
    filters: {
      search: '',
      subjects: [],
      price_min: null,
      price_max: null,
      experience: null,
      language: null,
      sort: 'relevance',
      has_certifications: null,
    },
    loading: false,
    tutorLoading: false,
    currentTutor: null,
    error: null,
  }),
  actions: {
    setFilters(partial = {}) {
      this.filters = { ...this.filters, ...partial }
    },
    resetFilters() {
      this.filters = {
        search: '',
        subjects: [],
        price_min: null,
        price_max: null,
        experience: null,
        language: null,
        sort: 'relevance',
        has_certifications: null,
      }
      this.cursor = null
      this.nextPageParams = null
      this.hasMore = true
    },
    async loadTutors(params = {}) {
      this.loading = true
      this.error = null
      try {
        const paginationParams = { ...params }
        const payload = await fetchMarketplaceTutors({
          ...normalizeFilters(this.filters),
          ...paginationParams,
        })
        const results = payload?.results || []
        const isPaginationRequest = Boolean(paginationParams.cursor || paginationParams.page)
        if (isPaginationRequest) {
          this.tutors = [...this.tutors, ...results]
        } else {
          this.tutors = results
        }
        this.nextPageParams = extractNextParams(payload)
        this.cursor = this.nextPageParams?.cursor || null
        this.hasMore = Boolean(this.nextPageParams)
      } catch (error) {
        this.error = error?.response?.data?.detail || 'Не вдалося завантажити тьюторів'
        throw error
      } finally {
        this.loading = false
      }
    },
    async loadMore() {
      if (!this.hasMore || this.loading || !this.nextPageParams) return
      await this.loadTutors(this.nextPageParams)
    },
    async loadTutor(id) {
      if (!id) return null
      this.tutorLoading = true
      this.error = null
      try {
        const data = await fetchMarketplaceTutor(id)
        this.currentTutor = data
        return data
      } catch (error) {
        this.error = error?.response?.data?.detail || 'Не вдалося завантажити профіль тьютора'
        throw error
      } finally {
        this.tutorLoading = false
      }
    },
  },
})
