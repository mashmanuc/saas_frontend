// TASK MF1: Marketplace API

import apiClient from '@/utils/apiClient'

type ApiClientFullResponse<T> = {
  status: number
  data: T
  headers: Record<string, any>
}

async function apiGetFull<T>(path: string, config: any = {}): Promise<ApiClientFullResponse<T>> {
  const res = (await apiClient.get(path, { ...config, meta: { ...(config?.meta || {}), fullResponse: true } })) as any
  return {
    status: Number(res?.status ?? 0),
    data: res?.data as T,
    headers: (res?.headers || {}) as Record<string, any>,
  }
}

const FILTERS_CACHE_KEY = 'marketplace_filters_cache_v38'
const EXT_FILTERS_CACHE_KEY = 'marketplace_ext_filters_cache_v38'

function loadCachedFilters(key: string): { etag: string | null; expiresAt: number | null; data: any | null } {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { etag: null, expiresAt: null, data: null }
    const parsed = JSON.parse(raw)
    return {
      etag: typeof parsed?.etag === 'string' ? parsed.etag : null,
      expiresAt: typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : null,
      data: parsed?.data ?? null,
    }
  } catch {
    return { etag: null, expiresAt: null, data: null }
  }
}

function saveCachedFilters(key: string, payload: { etag: string | null; expiresIn: number | null; data: any }): void {
  try {
    const expiresAt = typeof payload.expiresIn === 'number' && payload.expiresIn > 0
      ? Date.now() + payload.expiresIn * 1000
      : null
    localStorage.setItem(
      key,
      JSON.stringify({
        etag: payload.etag,
        expiresAt,
        data: payload.data,
      })
    )
  } catch {
    // ignore
  }
}

async function fetchFirstOk<T>(paths: string[]): Promise<T> {
  let lastErr: unknown = null

  for (const path of paths) {
    try {
      const res = await apiClient.get(path)
      return res as unknown as T
    } catch (err: any) {
      const status = err?.response?.status
      lastErr = err
      if (status === 404) continue
      throw err
    }
  }

  throw lastErr ?? new Error('not_found')
}

function isHttp404(err: unknown): boolean {
  const status = (err as any)?.response?.status
  return status === 404
}

export interface AvailableSlot {
  startAtUTC: string
  status: 'available'
  duration: number
}

export interface TutorCalendarResponse {
  tutor_id: number
  week_start: string
  timezone: string
  cells: AvailableSlot[]
}

export interface ProfileDraft {
  payload: any
  server_rev: number
  conflict_state?: boolean
  conflict_fields?: string[]
  client_payload?: any
  server_payload?: any
}

export interface DraftConflictResolution {
  strategy: 'server' | 'client' | 'merge'
  payload?: any
}

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

export type CertificationStatus = 'pending' | 'approved' | 'rejected'

export interface Certification {
  id: number
  title: string
  issuer: string
  issued_year: number
  file_url: string
  status: CertificationStatus
  is_public: boolean
  rejection_reason: string | null
  created_at: string
}

export type PresignCertificationRequest = {
  filename: string
  content_type: string
  size: number
}

export type PresignCertificationResponse = {
  upload_url: string
  asset_key: string
  expires_in: number
}

export type CreateCertificationPayload = {
  title: string
  issuer?: string
  issued_year?: number | null
  asset_key: string
  is_public: boolean
}

export type UpdateCertificationPayload = Partial<Pick<Certification, 'title' | 'issuer' | 'issued_year' | 'is_public'>>

export type Review = {
  id: number
  rating: number
  text: string
  created_at: string
}

export type CreateReviewPayload = {
  rating: number
  text: string
  source_lesson_id?: number
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

export type BadgeHistoryItem = {
  badge: any
  action: string
  actor: any
  reason: string | null
  created_at: string
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
  has_availability?: boolean
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

export type WeeklyAvailabilitySlot = {
  starts_at: string
  duration_min: number
}

export type WeeklyAvailabilityResponse = {
  slots: WeeklyAvailabilitySlot[]
}

export type TrialRequestPayload = {
  starts_at: string
  duration_min: number
  message?: string
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
  experience_max?: number
  direction?: string
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
    sort: string = 'recommended'
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

    const response = await apiClient.get('/v1/marketplace/tutors/', { params })
    return response as unknown as PaginatedResponse<TutorListItem>
  },

  /**
   * Get tutor profile by slug.
   */
  async getTutorProfile(slug: string): Promise<TutorProfile> {
    const response = await apiClient.get(`/v1/marketplace/tutors/${slug}/`)
    return response as unknown as TutorProfile
  },

  /**
   * Get own profile.
   */
  async getMyProfile(): Promise<TutorProfile> {
    const response = await apiClient.get('/v1/marketplace/tutors/me/')
    return response as unknown as TutorProfile
  },

  /**
   * Create profile.
   */
  async createProfile(data: TutorProfileUpsertPayload): Promise<TutorProfile> {
    // v0.35: canonical owner endpoint
    // (backend may upsert on PATCH; keep this method for UI compatibility)
    const response = await apiClient.patch('/v1/marketplace/tutors/me/', data)
    return response as unknown as TutorProfile
  },

  /**
   * Update profile.
   */
  async updateProfile(data: TutorProfilePatchPayload): Promise<TutorProfile> {
    const response = await apiClient.patch('/v1/marketplace/tutors/me/', data)
    return response as unknown as TutorProfile
  },

  /**
   * Submit profile for review.
   */
  async submitForReview(): Promise<TutorProfile> {
    const response = await apiClient.post('/v1/marketplace/tutors/me/submit/')
    return response as unknown as TutorProfile
  },

  /**
   * Publish profile.
   */
  async publishProfile(): Promise<TutorProfile> {
    const response = await apiClient.post('/v1/marketplace/tutors/me/publish/')
    return response as unknown as TutorProfile
  },

  /**
   * Unpublish profile.
   */
  async unpublishProfile(): Promise<TutorProfile> {
    const response = await apiClient.post('/v1/marketplace/tutors/me/unpublish/')
    return response as unknown as TutorProfile
  },

  async getWeeklyAvailability(slug: string, params?: { week_start?: string; tz?: string }): Promise<WeeklyAvailabilityResponse> {
    const response = await apiClient.get(`/v1/marketplace/tutors/${slug}/availability/weekly/`, { params })
    return response as unknown as WeeklyAvailabilityResponse
  },

  async createTrialRequest(slug: string, payload: TrialRequestPayload): Promise<any> {
    const response = await apiClient.post(`/v1/marketplace/tutors/${slug}/trial-request/`, payload)
    return response as unknown as any
  },

  async presignCertificationUpload(payload: PresignCertificationRequest): Promise<PresignCertificationResponse> {
    const response = await apiClient.post('/v1/uploads/presign/certification/', payload)
    return response as unknown as PresignCertificationResponse
  },

  async getBadgeHistory(): Promise<BadgeHistoryItem[]> {
    const response = await apiClient.get('/v1/marketplace/badges/history/')
    return (Array.isArray(response) ? response : ((response as any)?.results || [])) as BadgeHistoryItem[]
  },

  async getMyCertifications(): Promise<Certification[]> {
    const response = await apiClient.get('/v1/marketplace/tutors/me/certifications/')
    const results = (response as any)?.results
    return (Array.isArray(results) ? results : []) as Certification[]
  },

  async createMyCertification(payload: CreateCertificationPayload): Promise<Certification> {
    const response = await apiClient.post('/v1/marketplace/tutors/me/certifications/', payload)
    return response as unknown as Certification
  },

  async updateMyCertification(id: number, payload: UpdateCertificationPayload): Promise<Certification> {
    const response = await apiClient.patch(`/v1/marketplace/tutors/me/certifications/${id}/`, payload)
    return response as unknown as Certification
  },

  async deleteMyCertification(id: number): Promise<void> {
    await apiClient.delete(`/v1/marketplace/tutors/me/certifications/${id}/`)
  },

  async getTutorReviews(
    slug: string,
    params?: { page?: number; page_size?: number }
  ): Promise<PaginatedResponse<Review>> {
    const response = await apiClient.get(`/v1/marketplace/tutors/${slug}/reviews/`, { params })
    return response as unknown as PaginatedResponse<Review>
  },

  async createTutorReview(slug: string, payload: CreateReviewPayload): Promise<Review> {
    const response = await apiClient.post(`/v1/marketplace/tutors/${slug}/reviews/`, payload)
    return response as unknown as Review
  },

  /**
   * Upload video intro.
   */
  async uploadVideoIntro(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('video', file)
    const response = await apiClient.post('/v1/marketplace/tutors/video/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response as unknown as { url: string }
  },

  /**
   * Get all badges.
   */
  async getBadges(): Promise<Badge[]> {
    const response = await apiClient.get('/v1/marketplace/badges/')
    return response as unknown as Badge[]
  },

  /**
   * Get filter options (subjects, countries, languages).
   */
  async getFilterOptions(): Promise<FilterOptions> {
    const cached = loadCachedFilters(FILTERS_CACHE_KEY)
    if (cached.data && cached.expiresAt && cached.expiresAt > Date.now()) {
      return cached.data as FilterOptions
    }

    let response: RawFilterOptionsResponse
    try {
      // Try modern endpoint first to support ETag/expires_in contract
      if (cached.etag) {
        const full = await apiGetFull<any>('/v1/marketplace/filters/', {
          headers: { 'If-None-Match': cached.etag },
          validateStatus: (s: number) => (s >= 200 && s < 300) || s === 304,
        })
        if (full.status === 304 && cached.data) {
          return cached.data as FilterOptions
        }
        const payload = full.data
        const data = payload?.data ?? payload
        const etag = (payload?.etag ?? full.headers?.etag ?? cached.etag) || null
        const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
        response = data as RawFilterOptionsResponse
        saveCachedFilters(FILTERS_CACHE_KEY, { etag: etag ? String(etag) : null, expiresIn, data: response })
      } else {
        const full = await apiGetFull<any>('/v1/marketplace/filters/', {
          validateStatus: (s: number) => s >= 200 && s < 300,
        })
        const payload = full.data
        const data = payload?.data ?? payload
        const etag = (payload?.etag ?? full.headers?.etag ?? null)
        const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
        response = data as RawFilterOptionsResponse
        saveCachedFilters(FILTERS_CACHE_KEY, { etag: etag ? String(etag) : null, expiresIn, data: response })
      }
    } catch (err) {
      if (isHttp404(err)) {
        return {
          subjects: [],
          countries: [],
          languages: [],
          priceRange: { min: 0, max: 0 },
        }
      }
      throw err
    }
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
    const response = await apiClient.get('/v1/marketplace/tutors/search/', {
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
    const response = await apiClient.get('/v1/marketplace/search/', { params: cleanParams })
    return response as unknown as SearchResponse
  },

  /**
   * Get search suggestions (autocomplete).
   */
  async getSearchSuggestions(query: string): Promise<Suggestion[]> {
    const response = await apiClient.get('/v1/marketplace/search/suggestions/', { params: { q: query } })
    return response as unknown as Suggestion[]
  },

  /**
   * Get extended filter options.
   */
  async getExtendedFilterOptions(): Promise<ExtendedFilterOptions> {
    const cached = loadCachedFilters(EXT_FILTERS_CACHE_KEY)
    if (cached.data && cached.expiresAt && cached.expiresAt > Date.now()) {
      return cached.data as ExtendedFilterOptions
    }

    try {
      // Prefer contract endpoint with ETag
      if (cached.etag) {
        const full = await apiGetFull<any>('/v1/marketplace/filters/', {
          headers: { 'If-None-Match': cached.etag },
          validateStatus: (s: number) => (s >= 200 && s < 300) || s === 304,
        })
        if (full.status === 304 && cached.data) {
          return cached.data as ExtendedFilterOptions
        }
        const payload = full.data
        const data = payload?.data ?? payload
        const etag = (payload?.etag ?? full.headers?.etag ?? cached.etag) || null
        const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
        saveCachedFilters(EXT_FILTERS_CACHE_KEY, { etag: etag ? String(etag) : null, expiresIn, data })
        return data as ExtendedFilterOptions
      }

      const full = await apiGetFull<any>('/v1/marketplace/filters/', {
        validateStatus: (s: number) => s >= 200 && s < 300,
      })
      const payload = full.data
      const data = payload?.data ?? payload
      const etag = (payload?.etag ?? full.headers?.etag ?? null)
      const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
      saveCachedFilters(EXT_FILTERS_CACHE_KEY, { etag: etag ? String(etag) : null, expiresIn, data })
      return data as ExtendedFilterOptions
    } catch (err) {
      if (isHttp404(err)) {
        return {
          categories: [],
          subjects: [],
          countries: [],
          languages: [],
          priceRange: { min: 0, max: 0, avg: 0 },
          experienceRange: { min: 0, max: 0 },
        }
      }
      throw err
    }
  },

  /**
   * Get subject categories.
   */
  async getCategories(): Promise<Category[]> {
    const response = await apiClient.get('/v1/marketplace/categories/')
    return response as unknown as Category[]
  },

  /**
   * Get popular tutors.
   */
  async getPopularTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/v1/marketplace/tutors/popular/', { params: { limit } })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get new tutors.
   */
  async getNewTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/v1/marketplace/tutors/new/', { params: { limit } })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get recommended tutors for current user.
   */
  async getRecommendedTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/v1/marketplace/tutors/recommended/', { params: { limit } })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get featured tutors.
   */
  async getFeaturedTutors(limit: number = 10): Promise<TutorListItem[]> {
    const response = await apiClient.get('/v1/marketplace/tutors/featured/', { params: { limit } })
    return response as unknown as TutorListItem[]
  },

  /**
   * Get similar tutors.
   */
  async getSimilarTutors(slug: string, limit: number = 5): Promise<TutorListItem[]> {
    const response = await apiClient.get(`/v1/marketplace/tutors/${slug}/similar/`, { params: { limit } })
    return response as unknown as TutorListItem[]
  },

  /**
   * Log search click for analytics.
   */
  async logSearchClick(searchLogId: number, profileId: number, position: number): Promise<void> {
    await apiClient.post('/v1/marketplace/search/log-click/', {
      search_log_id: searchLogId,
      profile_id: profileId,
      position,
    })
  },

  /**
   * Save profile draft with conflict detection.
   */
  async saveProfileDraft(payload: any, clientRev: number, clientHash: string): Promise<ProfileDraft> {
    const response = await apiClient.put('/v1/marketplace/me/profile/draft', {
      payload,
      client_rev: clientRev,
      client_hash: clientHash,
    })
    return response as unknown as ProfileDraft
  },

  /**
   * Get current profile draft.
   */
  async getProfileDraft(): Promise<ProfileDraft> {
    const response = await apiClient.get('/v1/marketplace/me/profile/draft')
    return response as unknown as ProfileDraft
  },

  /**
   * Resolve draft conflict.
   */
  async resolveProfileDraftConflict(resolution: DraftConflictResolution): Promise<ProfileDraft> {
    const response = await apiClient.post('/v1/marketplace/me/profile/draft/resolve', resolution)
    return response as unknown as ProfileDraft
  },

  /**
   * Get tutor calendar (v0.48 - public availability)
   */
  async getTutorCalendar(params: {
    tutorId: number
    weekStart: string
    timezone: string
  }): Promise<TutorCalendarResponse> {
    const response = await apiClient.get(`/api/v1/marketplace/tutors/${params.tutorId}/calendar/`, {
      params: {
        start: params.weekStart,
        tz: params.timezone,
      },
    })
    return response.data
  },
}

export default marketplaceApi
