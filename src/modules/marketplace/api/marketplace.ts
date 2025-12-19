// TASK MF1: Marketplace API

import apiClient from '@/utils/apiClient'

// Types
export interface Education {
  id: number
  institution: string
  degree: string
  field: string
  startYear: number
  endYear?: number
  current: boolean
}

export interface Certification {
  id: number
  name: string
  issuer: string
  issueDate: string
  expiryDate?: string
  credentialUrl?: string
}

export interface Subject {
  id: number
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  description?: string
}

export interface Language {
  code: string
  name: string
  level: 'basic' | 'conversational' | 'fluent' | 'native'
}

export type LanguageLevel = Language['level']

export interface Badge {
  type: string
  name: string
  description: string
  icon: string
  earnedAt: string
}

export type ProfileStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended'

export interface TutorProfile {
  id: number
  slug: string
  user: {
    id: number
    full_name: string
    avatar_url: string
  }
  headline: string
  bio: string
  photo: string
  video_intro_url: string
  education: Education[]
  experience_years: number
  certifications: Certification[]
  subjects: Subject[]
  languages: Language[]
  country: string
  timezone: string
  hourly_rate: number
  currency: string
  trial_lesson_price: number | null
  total_lessons: number
  total_students: number
  average_rating: number
  total_reviews: number
  response_time_hours: number
  badges: Badge[]
  is_public: boolean
  status: ProfileStatus
  created_at: string
  updated_at: string
}

export interface SubjectWriteRef {
  code: string
  level?: Subject['level']
}

export interface LanguageWriteRef {
  code: string
  level: LanguageLevel
}

export interface TutorProfileUpsertPayload {
  headline: string
  bio?: string
  hourly_rate?: number
  currency?: string
  trial_lesson_price?: number | null
  video_intro_url?: string
  country?: string
  timezone?: string
  subjects?: SubjectWriteRef[]
  languages?: LanguageWriteRef[]
}

export type TutorProfilePatchPayload = Partial<TutorProfileUpsertPayload>

export interface TutorListItem {
  id: number
  slug: string
  full_name?: string
  photo?: string
  headline: string
  country: string
  hourly_rate: number
  currency: string
  average_rating: number
  total_reviews: number
  total_lessons: number
  badges: Badge[]
  subjects: string[]
  languages: string[]
}

export interface CatalogFilters {
  q?: string
  language?: string[]
  subject?: string[]
  price_min?: number
  price_max?: number
  experience_min?: number
  country?: string
  timezone?: string
  format?: 'online' | 'offline' | 'hybrid'
  has_certifications?: boolean
}

// v0.20.0: Extended Search Types
export interface SearchFilters {
  query: string
  subject: string | null
  category: string | null
  country: string | null
  language: string | null
  minPrice: number | null
  maxPrice: number | null
  minRating: number | null
  minExperience: number | null
  hasVideo: boolean
  isVerified: boolean
}

export interface Category {
  slug: string
  name: string
  icon: string
  color: string
  tutor_count: number
  subject_count: number
  is_featured: boolean
}

export interface SubjectOption {
  slug: string
  name: string
  category: string
  category_name: string
  tutor_count: number
}

export interface CountryOption {
  code: string
  name: string
  count: number
}

export interface LanguageOption {
  code: string
  name: string
  count: number
}

export interface ExtendedFilterOptions {
  categories: Category[]
  subjects: SubjectOption[]
  countries: CountryOption[]
  languages: LanguageOption[]
  priceRange: { min: number; max: number; avg: number }
  experienceRange: { min: number; max: number }
}

export interface Suggestion {
  type: 'subject' | 'tutor' | 'category'
  text: string
  slug?: string
  category?: string
  photo?: string
}

export interface SearchResponse {
  count: number
  results: TutorListItem[]
  search_time_ms?: number
}

export interface FilterOptions {
  subjects: Array<{ value: string; label: string; count: number }>
  countries: Array<{ value: string; label: string; count: number }>
  languages: Array<{ value: string; label: string; count: number }>
  priceRange: { min: number; max: number }
}

type RawFilterOptionsResponse = {
  subjects?: Array<{ slug?: string; name?: string; tutor_count?: number }>
  countries?: Array<{ code?: string; name?: string; count?: number }>
  languages?: Array<{ code?: string; name?: string; count?: number }>
  priceRange?: { min?: number; max?: number }
  price_range?: { min?: number; max?: number }
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// API Client
export const marketplaceApi = {
  /**
   * Get public tutors list.
   */
  async getTutors(
    filters?: CatalogFilters,
    page: number = 1,
    pageSize: number = 20,
    sort: string = 'rating'
  ): Promise<PaginatedResponse<TutorListItem>> {
    const params: Record<string, unknown> = {
      ...(filters || {}),
      page,
      page_size: Math.min(Number(pageSize) || 20, 24),
      sort,
    }

    // Canonical v0.34 param name
    if (typeof params.q !== 'string' && typeof (params as any).search === 'string') {
      params.q = (params as any).search
      delete (params as any).search
    }

    if (typeof params.q === 'string') {
      const v = params.q.trim()
      if (v.length < 2) {
        delete (params as any).q
      } else {
        params.q = v
      }
    }

    const response = await apiClient.get('/marketplace/tutors/', { params })
    return response as unknown as PaginatedResponse<TutorListItem>
  },

  /**
   * Get tutor profile by slug.
   */
  async getTutorProfile(slug: string): Promise<TutorProfile> {
    const response = await apiClient.get(`/marketplace/tutors/${slug}/`)
    return response as unknown as TutorProfile
  },

  /**
   * Get own profile.
   */
  async getMyProfile(): Promise<TutorProfile> {
    const response = await apiClient.get('/marketplace/profile/')
    return response as unknown as TutorProfile
  },

  /**
   * Create profile.
   */
  async createProfile(data: TutorProfileUpsertPayload): Promise<TutorProfile> {
    const response = await apiClient.post('/marketplace/profile/', data)
    return response as unknown as TutorProfile
  },

  /**
   * Update profile.
   */
  async updateProfile(id: number, data: TutorProfilePatchPayload): Promise<TutorProfile> {
    void id
    const response = await apiClient.patch('/marketplace/profile/', data)
    return response as unknown as TutorProfile
  },

  /**
   * Submit profile for review.
   */
  async submitForReview(): Promise<TutorProfile> {
    const response = await apiClient.post('/marketplace/profile/submit/')
    return response as unknown as TutorProfile
  },

  /**
   * Publish profile.
   */
  async publishProfile(id: number): Promise<TutorProfile> {
    void id
    const response = await apiClient.post('/marketplace/profile/publish/')
    return response as unknown as TutorProfile
  },

  /**
   * Unpublish profile.
   */
  async unpublishProfile(id: number): Promise<TutorProfile> {
    void id
    const response = await apiClient.post('/marketplace/profile/unpublish/')
    return response as unknown as TutorProfile
  },

  /**
   * Upload video intro.
   */
  async uploadVideoIntro(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('video', file)
    const response = await apiClient.post('/marketplace/tutors/video/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response as unknown as { url: string }
  },

  /**
   * Get all badges.
   */
  async getBadges(): Promise<Badge[]> {
    const response = await apiClient.get('/marketplace/badges/')
    return response as unknown as Badge[]
  },

  /**
   * Get filter options (subjects, countries, languages).
   */
  async getFilterOptions(): Promise<FilterOptions> {
    const response = (await apiClient.get('/marketplace/filters/')) as unknown as RawFilterOptionsResponse
    const rawPrice = response.priceRange || response.price_range || {}

    const normalizeOption = (
      item: any,
      keys: { value: string[]; label: string[]; count: string[] }
    ): { value: string; label: string; count: number } | null => {
      if (!item || typeof item !== 'object') return null

      const pickFirst = (obj: any, candidates: string[]) => {
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
        count: Number(count ?? 0),
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
            .map((x) => x as { value: string; label: string; count: number })
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
            .map((x) => x as { value: string; label: string; count: number })
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
            .map((x) => x as { value: string; label: string; count: number })
        : [],
      priceRange: {
        min: Number(rawPrice.min ?? 0),
        max: Number(rawPrice.max ?? 0),
      },
    }
  },

  /**
   * Search tutors.
   */
  async searchTutors(query: string): Promise<TutorListItem[]> {
    const response = await apiClient.get('/marketplace/tutors/search/', {
      params: { q: query },
    })
    return response as unknown as TutorListItem[]
  },

  /**
   * Full-text search with filters.
   */
  async search(params: {
    q?: string
    subject?: string | null
    category?: string | null
    country?: string | null
    language?: string | null
    min_price?: number | null
    max_price?: number | null
    min_rating?: number | null
    min_experience?: number | null
    has_video?: boolean
    is_verified?: boolean
    page?: number
    page_size?: number
    ordering?: string
  }): Promise<SearchResponse> {
    // Clean null values
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v != null && v !== '')
    )
    const response = await apiClient.get('/marketplace/search/', { params: cleanParams })
    return response as unknown as SearchResponse
  },

  /**
   * Get search suggestions (autocomplete).
   */
  async getSearchSuggestions(query: string): Promise<Suggestion[]> {
    const response = await apiClient.get('/marketplace/search/suggestions/', {
      params: { q: query },
    })
    return response as unknown as Suggestion[]
  },

  /**
   * Get extended filter options.
   */
  async getExtendedFilterOptions(): Promise<ExtendedFilterOptions> {
    const response = await apiClient.get('/marketplace/filters/')
    return response as unknown as ExtendedFilterOptions
  },

  /**
   * Get subject categories.
   */
  async getCategories(): Promise<Category[]> {
    const response = await apiClient.get('/marketplace/categories/')
    return response as unknown as Category[]
  },

  /**
   * Get popular tutors.
   */
  async getPopularTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/marketplace/tutors/popular/', {
      params: { limit },
    })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get new tutors.
   */
  async getNewTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/marketplace/tutors/new/', {
      params: { limit },
    })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get recommended tutors for current user.
   */
  async getRecommendedTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/marketplace/tutors/recommended/', {
      params: { limit },
    })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get featured tutors.
   */
  async getFeaturedTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/marketplace/tutors/featured/', {
      params: { limit },
    })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get similar tutors.
   */
  async getSimilarTutors(slug: string, limit: number = 5): Promise<TutorListItem[]> {
    const response = await apiClient.get(`/marketplace/tutors/${slug}/similar/`, {
      params: { limit },
    })
    return response as unknown as TutorListItem[]
  },

  /**
   * Log search click for analytics.
   */
  async logSearchClick(searchLogId: number, profileId: number, position: number): Promise<void> {
    await apiClient.post('/marketplace/search/log-click/', {
      search_log_id: searchLogId,
      profile_id: profileId,
      position,
    })
  },
}

export default marketplaceApi
