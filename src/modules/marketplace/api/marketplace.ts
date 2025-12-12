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

export interface TutorListItem {
  id: number
  slug: string
  full_name: string
  photo: string
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
  subject?: string
  country?: string
  language?: string
  min_price?: number
  max_price?: number
  min_rating?: number
  has_video?: boolean
  is_verified?: boolean
}

export interface FilterOptions {
  subjects: Array<{ value: string; label: string; count: number }>
  countries: Array<{ value: string; label: string; count: number }>
  languages: Array<{ value: string; label: string; count: number }>
  priceRange: { min: number; max: number }
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
    sort: string = '-average_rating'
  ): Promise<PaginatedResponse<TutorListItem>> {
    const params = {
      ...filters,
      page,
      page_size: pageSize,
      ordering: sort,
    }
    const response = await apiClient.get('/api/v1/marketplace/tutors/', { params })
    return response.data
  },

  /**
   * Get tutor profile by slug.
   */
  async getTutorProfile(slug: string): Promise<TutorProfile> {
    const response = await apiClient.get(`/api/v1/marketplace/tutors/${slug}/`)
    return response.data
  },

  /**
   * Get own profile.
   */
  async getMyProfile(): Promise<TutorProfile> {
    const response = await apiClient.get('/api/v1/marketplace/profile/')
    return response.data
  },

  /**
   * Create profile.
   */
  async createProfile(data: Partial<TutorProfile>): Promise<TutorProfile> {
    const response = await apiClient.post('/api/v1/marketplace/profile/', data)
    return response.data
  },

  /**
   * Update profile.
   */
  async updateProfile(data: Partial<TutorProfile>): Promise<TutorProfile> {
    const response = await apiClient.patch('/api/v1/marketplace/profile/', data)
    return response.data
  },

  /**
   * Submit profile for review.
   */
  async submitForReview(): Promise<TutorProfile> {
    const response = await apiClient.post('/api/v1/marketplace/profile/submit/')
    return response.data
  },

  /**
   * Publish profile.
   */
  async publishProfile(): Promise<TutorProfile> {
    const response = await apiClient.post('/api/v1/marketplace/profile/publish/')
    return response.data
  },

  /**
   * Unpublish profile.
   */
  async unpublishProfile(): Promise<TutorProfile> {
    const response = await apiClient.post('/api/v1/marketplace/profile/unpublish/')
    return response.data
  },

  /**
   * Upload profile photo.
   */
  async uploadPhoto(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('photo', file)
    const response = await apiClient.post('/api/v1/marketplace/profile/photo/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  /**
   * Upload video intro.
   */
  async uploadVideoIntro(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('video', file)
    const response = await apiClient.post('/api/v1/marketplace/profile/video/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  /**
   * Get all badges.
   */
  async getBadges(): Promise<Badge[]> {
    const response = await apiClient.get('/api/v1/marketplace/badges/')
    return response.data
  },

  /**
   * Get filter options (subjects, countries, languages).
   */
  async getFilterOptions(): Promise<FilterOptions> {
    const response = await apiClient.get('/api/v1/marketplace/filters/')
    return response.data
  },

  /**
   * Search tutors.
   */
  async searchTutors(query: string): Promise<TutorListItem[]> {
    const response = await apiClient.get('/api/v1/marketplace/tutors/search/', {
      params: { q: query },
    })
    return response.data
  },
}

export default marketplaceApi
