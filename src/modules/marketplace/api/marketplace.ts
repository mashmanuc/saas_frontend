// TASK MF1: Marketplace API

import apiClient from '@/utils/apiClient'
import type { TutorActivityStatus } from '../types/activityStatus'

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

const FILTERS_CACHE_KEY_PREFIX = 'marketplace_filters_cache'
const EXT_FILTERS_CACHE_KEY_PREFIX = 'marketplace_ext_filters_cache'
const CACHE_VERSION = 2 // v0.85: bumped for catalog_version support
const DEFAULT_TTL_MS = 15 * 60 * 1000 // 15 minutes

interface FiltersCache {
  v: number
  savedAt: number
  ttlMs: number
  etag: string | null
  expiresAt: number | null
  catalogVersion: string | null // v0.85: catalog version for self-healing
  data: any | null
}

function isCacheValid(cache: FiltersCache | null, currentCatalogVersion?: string | null): boolean {
  if (!cache) return false
  if (cache.v !== CACHE_VERSION) return false
  if (Date.now() - cache.savedAt > cache.ttlMs) return false
  if (!cache.data) return false
  
  // v0.85: Invalidate cache if catalog version changed (self-healing)
  if (currentCatalogVersion && cache.catalogVersion && cache.catalogVersion !== currentCatalogVersion) {
    return false
  }
  
  // Critical: validate that subjects array exists and is not empty
  // This prevents the "eternal empty cache" bug
  if (Array.isArray(cache.data.subjects)) {
    if (cache.data.subjects.length === 0) return false
  } else if (cache.data.data?.subjects) {
    if (Array.isArray(cache.data.data.subjects) && cache.data.data.subjects.length === 0) return false
  }
  
  return true
}

function loadCachedFilters(key: string, currentCatalogVersion?: string | null): { etag: string | null; expiresAt: number | null; catalogVersion: string | null; data: any | null; isValid: boolean } {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { etag: null, expiresAt: null, catalogVersion: null, data: null, isValid: false }
    
    const parsed = JSON.parse(raw) as FiltersCache
    const valid = isCacheValid(parsed, currentCatalogVersion)
    
    return {
      etag: typeof parsed?.etag === 'string' ? parsed.etag : null,
      expiresAt: typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : null,
      catalogVersion: typeof parsed?.catalogVersion === 'string' ? parsed.catalogVersion : null,
      data: parsed?.data ?? null,
      isValid: valid,
    }
  } catch {
    return { etag: null, expiresAt: null, catalogVersion: null, data: null, isValid: false }
  }
}

function saveCachedFilters(key: string, payload: { etag: string | null; expiresIn: number | null; catalogVersion: string | null; data: any }): void {
  try {
    const now = Date.now()
    const expiresAt = typeof payload.expiresIn === 'number' && payload.expiresIn > 0
      ? now + payload.expiresIn * 1000
      : null
    
    const cache: FiltersCache = {
      v: CACHE_VERSION,
      savedAt: now,
      ttlMs: DEFAULT_TTL_MS,
      etag: payload.etag,
      expiresAt,
      catalogVersion: payload.catalogVersion,
      data: payload.data,
    }
    
    localStorage.setItem(key, JSON.stringify(cache))
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
  slot_id: string
  start_at: string
  duration_min: number
  status: 'available' | 'booked' | 'blocked'
}

export interface CalendarDayCell {
  date: string
  day_status: string
  slots: AvailableSlot[]
}

export interface TutorCalendarResponse {
  tutor_id: number
  timezone: string
  week_start: string
  week_end: string
  horizon_weeks: number
  generated_at: string
  cells: CalendarDayCell[]
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

// v0.60: TagGroup enum (must match backend)
export type TagGroup = 'grades' | 'exams' | 'levels' | 'goals' | 'formats' | 'audience'

// v0.60.1: Tag in profile context (read)
export interface TagPublic {
  code: string
  label: string
  group: TagGroup
}

// v0.60.1: Specialty tag (read) - alias for compatibility
export interface SpecialtyTagPublic {
  code: string
  label: string
  short_label: string
  group: 'exams' | 'grades' | 'formats' | 'goals'
  sort_order?: number
  is_global?: boolean
}

// v0.60.1: Subject in profile context (read)
export interface SubjectPublic {
  code: string              // Slug предмета
  title: string             // Локалізована назва
  tags: SpecialtyTagPublic[] // Масив тегів
  custom_direction_text: string | null // Опис напрямку (300-800 chars)
}

// v0.60.1: Subject format for write operations
export interface SubjectWrite {
  code: string              // Slug предмета
  tags: string[]            // Масив кодів тегів
  custom_direction_text?: string | null // Опис (300-800 chars або null)
}

// Legacy Subject type (deprecated, use SubjectPublic)
/**
 * @deprecated Use SubjectPublic instead. Legacy format removed in v0.60.1.
 */
export interface Subject {
  id: number
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  description?: string
}

/**
 * @deprecated Use SubjectPublic instead. Legacy format removed in v0.60.1.
 */
export interface SubjectLegacy {
  name: string
  levels: string[]
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

// v0.60.1: Full tutor profile (read)
export interface TutorProfileFull {
  profile_version: number
  published_at: string
  slug: string
  user_id: number  // v0.60.1: tutor user ID for calendar
  user_name?: string  // P0.1: Privacy-safe name from API (format: "FirstName L.")
  bio: string
  headline: string
  education: Education[]
  certifications: Certification[]
  languages: Language[]
  teaching_languages?: Array<{ code: string; level: LanguageLevel }>  // v0.84: languages tutor teaches in
  subjects: SubjectPublic[]  // v0.60.1: normalized format
  experience_years: number
  is_published?: boolean  // v0.60.1: publication status
  pricing: {
    hourly_rate: number
    currency: string
    trial_lesson_price: number | null
  }
  media: {
    photo_url: string | null
    video_intro_url: string
  }
  availability_summary: {
    weekly_hours: number
    timezone: string
  }
  stats: {
    total_lessons: number
    total_students: number
    average_rating: number
    total_reviews: number
    response_time_hours: number
  }
  completeness_score?: number  // v0.95.1: profile completeness (0.0 - 1.0)
}

// v0.60.1: Profile update payload (write)
export interface TutorProfileUpdate {
  bio: string
  headline: string
  education: Education[]
  certifications: Certification[]
  languages: Language[]
  teaching_languages?: Array<{ code: string; level: LanguageLevel }>  // v0.84: languages tutor teaches in
  subjects: SubjectWrite[]  // v0.60.1: write format
  experience_years: number
  is_published?: boolean  // v0.60.1: profile publication status
  // Optional profile fields supported by the editor (may not exist in TutorProfileFull typing yet)
  country?: string
  timezone?: string
  format?: 'online' | 'offline' | 'hybrid' | ''

  // Privacy
  gender?: string
  show_gender?: boolean
  birth_year?: number | null
  show_age?: boolean
  telegram_username?: string
  // City (v1.0)
  city_code?: string | null
  is_city_public?: boolean
  pricing: {
    hourly_rate: number
    currency: string
    trial_lesson_price?: number | null
  }
  media: {
    photo_url?: string | null
    video_intro_url?: string
  }
}

// v0.60.1: Profile update response
export interface ProfileUpdateResponse {
  profile_version: number
  draft_state: string
}

// Legacy TutorProfile (deprecated, use TutorProfileFull)
/**
 * @deprecated Use TutorProfileFull instead. Legacy format.
 */
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
  subjects: SubjectPublic[]  // v0.60: updated to new format
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
  badges_history?: BadgeHistoryItem[]  // v0.60: badge history from profile payload
  is_public: boolean
  status: ProfileStatus
  created_at: string
  updated_at: string
  has_availability?: boolean
}

// Alias for backward compatibility
export interface TutorProfileOwn extends TutorProfile {}

// v0.60: Write payload for subjects (deprecated, use SubjectWrite)
/**
 * @deprecated Use SubjectWrite instead
 */
export interface SubjectWritePayload {
  code: string
  tags: string[]  // array of tag codes
  custom_direction_text?: string
}

// Legacy SubjectWriteRef (deprecated)
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
  subjects?: SubjectWritePayload[]  // v0.60: updated to new format
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
  slot_id: string
  starts_at: string
  duration_min: number
  message?: string
}

export type TutorProfilePatchPayload = Partial<TutorProfileUpsertPayload>

export interface TutorListItem {
  id: number
  slug: string
  full_name?: string  // Legacy field, prefer display_name
  display_name?: string  // P0.1: Privacy-safe name (format: "FirstName L.")
  photo?: string
  headline: string
  country: string
  hourly_rate: number
  currency: string
  average_rating: number
  total_reviews: number
  total_lessons: number
  badges: Badge[]
  subjects: Array<{
    code: string
    title: string
    tags?: Array<{
      code: string
      label: string
      group: string
    }>
    custom_direction_text?: string | null
  }>
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
  city?: string
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
  city: string | null
  language: string | null
  minPrice: number | null
  maxPrice: number | null
  minRating: number | null
  minExperience: number | null
  format: string | null
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

export interface CityOption {
  slug: string
  name: string
  count: number
}

export interface ExtendedFilterOptions {
  categories: Category[]
  subjects: SubjectOption[]
  countries: CountryOption[]
  cities: CityOption[]
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

// v0.60.1: Catalog types
export interface SubjectCatalog {
  code: string
  title: string
  category: string
  is_active: boolean
}

export interface SpecialtyTagCatalog {
  code: string
  label: string
  short_label: string
  group: string
  sort_order: number
  is_global: boolean
}

// Legacy catalog types (deprecated)
/**
 * @deprecated Use SubjectCatalog instead
 */
export interface CatalogSubject {
  code: string
  title: string
  category: string
  category_name: string
  tutor_count: number
}

/**
 * @deprecated Use SpecialtyTagCatalog instead
 */
export interface CatalogTag {
  code: string
  label: string
  short_label?: string
  group: TagGroup
  is_global: boolean
  subject_code?: string | null
}

export interface FilterOptions {
  subjects: Array<{ value: string; label: string; count: number }>
  default_subjects?: Array<{ value: string; label: string; count: number }> // v0.88: whitelist for chips
  countries: Array<{ value: string; label: string; count: number }>
  languages: Array<{ value: string; label: string; count: number }>
  priceRange: { min: number; max: number }
  catalogVersion?: string // v0.85: catalog version for self-healing cache
  subjectTagMap?: any // v0.85: subject tag map (use SubjectTagMap type from types/subjectTagMap.ts)
}

type RawFilterOptionsResponse = {
  subjects?: Array<{ slug?: string; name?: string; tutor_count?: number }>
  default_subjects?: Array<{ slug?: string; name?: string; tutor_count?: number }> // v0.88: whitelist
  countries?: Array<{ code?: string; name?: string; count?: number }>
  languages?: Array<{ code?: string; name?: string; count?: number }>
  priceRange?: { min?: number; max?: number }
  price_range?: { min?: number; max?: number }
  catalog_version?: string // v0.85: snake_case from backend
  catalogVersion?: string // v0.85: camelCase variant
  subject_tag_map?: any // v0.85: snake_case from backend
  subjectTagMap?: any // v0.85: camelCase variant
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
  totalPages?: number
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
   * Get public tutor profile by slug (v0.60.1 normalized format).
   * GET /api/v1/marketplace/tutors/<slug>/profile/
   */
  async getTutorProfile(slug: string): Promise<TutorProfileFull> {
    const response = await apiClient.get(`/v1/marketplace/tutors/${slug}/profile/`)
    return response as unknown as TutorProfileFull
  },

  /**
   * Get own profile (v0.60.1 normalized format).
   * GET /api/v1/tutors/me/profile/
   */
  async getTutorMeProfile(): Promise<TutorProfileFull> {
    const response = await apiClient.get('/v1/tutors/me/profile/')
    return response as unknown as TutorProfileFull
  },

  /**
   * Get own profile snapshot (last published version).
   * GET /api/v1/tutors/me/profile/snapshot/
   */
  async getTutorMeSnapshot(): Promise<TutorProfileFull> {
    const response = await apiClient.get('/v1/tutors/me/profile/snapshot/')
    return response as unknown as TutorProfileFull
  },

  /**
   * Create tutor profile (v0.83.0).
   * POST /api/marketplace/profile/
   */
  async createTutorProfile(data: TutorProfileUpdate): Promise<TutorProfileFull> {
    const response = await apiClient.post('/marketplace/profile/', data)
    return response as unknown as TutorProfileFull
  },

  /**
   * Update tutor profile (v0.60.1 normalized format).
   * PUT /api/v1/tutors/me/profile/
   * @returns Profile update response with version
   */
  async updateTutorMeProfile(data: TutorProfileUpdate): Promise<ProfileUpdateResponse> {
    const response = await apiClient.put('/v1/tutors/me/profile/', data)
    return response as unknown as ProfileUpdateResponse
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


  async createTrialRequest(slug: string, payload: TrialRequestPayload): Promise<any> {
    const response = await apiClient.post(`/v1/marketplace/tutors/${slug}/trial-request/`, payload)
    return response as unknown as any
  },

  async presignCertificationUpload(payload: PresignCertificationRequest): Promise<PresignCertificationResponse> {
    const response = await apiClient.post('/v1/uploads/presign/certification/', payload)
    return response as unknown as PresignCertificationResponse
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
    // v0.85: Build versioned cache key
    let cacheKey = FILTERS_CACHE_KEY_PREFIX
    
    // First, try to get catalog version from a quick peek at cache
    const quickPeek = loadCachedFilters(cacheKey)
    const catalogVersion = quickPeek.catalogVersion
    
    if (catalogVersion) {
      cacheKey = `${FILTERS_CACHE_KEY_PREFIX}:${catalogVersion}`
    }
    
    const cached = loadCachedFilters(cacheKey, catalogVersion)
    
    // P0 fix: only use cache if it's valid (TTL + non-empty subjects)
    if (cached.isValid && cached.data) {
      return cached.data as FilterOptions
    }

    let response: RawFilterOptionsResponse
    try {
      // P0 fix: only send ETag if cache is valid, otherwise force fresh fetch
      if (cached.isValid && cached.etag) {
        const full = await apiGetFull<any>('/v1/marketplace/filters/', {
          headers: { 'If-None-Match': cached.etag },
          validateStatus: (s: number) => (s >= 200 && s < 300) || s === 304,
        })
        // P0 fix: on 304, re-validate cache before returning
        if (full.status === 304) {
          if (cached.isValid && cached.data) {
            return cached.data as FilterOptions
          }
          // Cache invalid despite 304 → clear ETag and retry
          localStorage.removeItem(cacheKey)
          return this.getFilterOptions()
        }
        const payload = full.data
        const data = payload?.data ?? payload
        const etag = (payload?.etag ?? full.headers?.etag ?? cached.etag) || null
        const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
        const newCatalogVersion = data?.catalog_version || data?.catalogVersion || null
        response = data as RawFilterOptionsResponse
        
        // v0.85: Save with catalog version
        const versionedKey = newCatalogVersion ? `${FILTERS_CACHE_KEY_PREFIX}:${newCatalogVersion}` : cacheKey
        saveCachedFilters(versionedKey, { 
          etag: etag ? String(etag) : null, 
          expiresIn, 
          catalogVersion: newCatalogVersion, 
          data: response 
        })
      } else {
        const full = await apiGetFull<any>('/v1/marketplace/filters/', {
          validateStatus: (s: number) => s >= 200 && s < 300,
        })
        const payload = full.data
        const data = payload?.data ?? payload
        const etag = (payload?.etag ?? full.headers?.etag ?? null)
        const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
        const newCatalogVersion = data?.catalog_version || data?.catalogVersion || null
        response = data as RawFilterOptionsResponse
        
        // v0.85: Save with catalog version
        const versionedKey = newCatalogVersion ? `${FILTERS_CACHE_KEY_PREFIX}:${newCatalogVersion}` : cacheKey
        saveCachedFilters(versionedKey, { 
          etag: etag ? String(etag) : null, 
          expiresIn, 
          catalogVersion: newCatalogVersion, 
          data: response 
        })
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
      default_subjects: Array.isArray(response.default_subjects)
        ? response.default_subjects
            .map((s) =>
              normalizeOption(s, {
                value: ['value', 'slug', 'code'],
                label: ['label', 'name'],
                count: ['count', 'tutor_count'],
              })
            )
            .filter(Boolean)
            .map((x) => x as { value: string; label: string; count: number })
        : undefined,
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
      catalogVersion: response.catalog_version || response.catalogVersion,
      subjectTagMap: response.subject_tag_map || response.subjectTagMap,
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
    // v0.85: Build versioned cache key
    let cacheKey = EXT_FILTERS_CACHE_KEY_PREFIX
    
    // First, try to get catalog version from a quick peek at cache
    const quickPeek = loadCachedFilters(cacheKey)
    const catalogVersion = quickPeek.catalogVersion
    
    if (catalogVersion) {
      cacheKey = `${EXT_FILTERS_CACHE_KEY_PREFIX}:${catalogVersion}`
    }
    
    const cached = loadCachedFilters(cacheKey, catalogVersion)
    
    // P0 fix: only use cache if it's valid (TTL + non-empty subjects)
    if (cached.isValid && cached.data) {
      return cached.data as ExtendedFilterOptions
    }

    try {
      // P0 fix: only send ETag if cache is valid, otherwise force fresh fetch
      if (cached.isValid && cached.etag) {
        const full = await apiGetFull<any>('/v1/marketplace/filters/', {
          headers: { 'If-None-Match': cached.etag },
          validateStatus: (s: number) => (s >= 200 && s < 300) || s === 304,
        })
        // P0 fix: on 304, re-validate cache before returning
        if (full.status === 304) {
          if (cached.isValid && cached.data) {
            return cached.data as ExtendedFilterOptions
          }
          // Cache invalid despite 304 → clear ETag and retry
          localStorage.removeItem(cacheKey)
          return this.getExtendedFilterOptions()
        }
        const payload = full.data
        const data = payload?.data ?? payload
        const etag = (payload?.etag ?? full.headers?.etag ?? cached.etag) || null
        const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
        const newCatalogVersion = data?.catalog_version || data?.catalogVersion || null
        
        // v0.85: Save with catalog version
        const versionedKey = newCatalogVersion ? `${EXT_FILTERS_CACHE_KEY_PREFIX}:${newCatalogVersion}` : cacheKey
        saveCachedFilters(versionedKey, { 
          etag: etag ? String(etag) : null, 
          expiresIn, 
          catalogVersion: newCatalogVersion, 
          data 
        })
        return data as ExtendedFilterOptions
      }

      const full = await apiGetFull<any>('/v1/marketplace/filters/', {
        validateStatus: (s: number) => s >= 200 && s < 300,
      })
      const payload = full.data
      const data = payload?.data ?? payload
      const etag = (payload?.etag ?? full.headers?.etag ?? null)
      const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : null
      const newCatalogVersion = data?.catalog_version || data?.catalogVersion || null
      
      // v0.85: Save with catalog version
      const versionedKey = newCatalogVersion ? `${EXT_FILTERS_CACHE_KEY_PREFIX}:${newCatalogVersion}` : cacheKey
      saveCachedFilters(versionedKey, { 
        etag: etag ? String(etag) : null, 
        expiresIn, 
        catalogVersion: newCatalogVersion, 
        data 
      })
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
   * Get catalog subjects with localized titles (v0.60.1).
   * GET /api/v1/catalog/subjects?locale=uk
   */
  async getCatalogSubjects(locale: string = 'uk'): Promise<SubjectCatalog[]> {
    const response = await apiClient.get('/v1/catalog/subjects', {
      params: { locale },
    })
    return response as unknown as SubjectCatalog[]
  },

  /**
   * Get catalog tags with localized labels (v0.60.1).
   * GET /api/v1/catalog/tags?locale=uk&group=exams
   */
  async getCatalogTags(
    locale: string = 'uk',
    group?: string
  ): Promise<SpecialtyTagCatalog[]> {
    const params: Record<string, string> = { locale }
    if (group) {
      params.group = group
    }
    
    const response = await apiClient.get('/v1/catalog/tags', { params })
    return response as unknown as SpecialtyTagCatalog[]
  },

  /**
   * Get tutor calendar (v0.59 public availability contract).
   * Frontend helper guarantees required params even if caller forgets to pass them.
   */
  async getTutorCalendar(params: {
    tutorId: number
    weekStart?: string
    timezone?: string
  }): Promise<TutorCalendarResponse> {
    const safeWeekStart = normalizeWeekStart(params.weekStart)
    const safeTimezone = params.timezone || getBrowserTimezone()
    
    console.log('[marketplaceApi.getTutorCalendar] Request:', {
      tutorId: params.tutorId,
      weekStart: safeWeekStart,
      timezone: safeTimezone,
      url: `/v1/marketplace/tutors/${params.tutorId}/calendar/`
    })
    
    const response = await apiClient.get(`/v1/marketplace/tutors/${params.tutorId}/calendar/`, {
      params: {
        // v0.59 compatibility: backend may expect either start or week_start (or both)
        start: safeWeekStart,
        week_start: safeWeekStart,
        tz: safeTimezone,
        timezone: safeTimezone,
      },
    })
    
    console.log('[marketplaceApi.getTutorCalendar] Response:', {
      status: 'success',
      data: response
    })
    
    return response as unknown as TutorCalendarResponse
  },

  /**
   * Get tutor activity status (v0.88.2).
   * GET /api/v1/marketplace/tutors/me/activity-status
   */
  async getTutorActivityStatus(): Promise<TutorActivityStatus> {
    const response = await apiClient.get('/v1/marketplace/tutors/me/activity-status')
    return response as unknown as TutorActivityStatus
  },
}

export default marketplaceApi

function normalizeWeekStart(raw?: string): string {
  const fallback = getCurrentMondayISO()
  if (!raw) {
    return fallback
  }
  
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }
  
  const day = parsed.getDay() // 0-6, Sunday=0
  const diff = day === 0 ? -6 : 1 - day
  parsed.setDate(parsed.getDate() + diff)
  return parsed.toISOString().split('T')[0]
}

function getCurrentMondayISO(): string {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  today.setDate(today.getDate() + diff)
  return today.toISOString().split('T')[0]
}

function getBrowserTimezone(): string {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) {
      return tz
    }
  }
  return 'Europe/Kyiv'
}
