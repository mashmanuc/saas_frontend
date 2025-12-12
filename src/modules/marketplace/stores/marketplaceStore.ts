// TASK MF2: Marketplace Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  marketplaceApi,
  type TutorListItem,
  type TutorProfile,
  type CatalogFilters,
  type FilterOptions,
} from '../api/marketplace'

export const useMarketplaceStore = defineStore('marketplace', () => {
  // Catalog state
  const tutors = ref<TutorListItem[]>([])
  const totalCount = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const isLoading = ref(false)
  const filters = ref<CatalogFilters>({})
  const sortBy = ref('-average_rating')

  // Current profile state (viewing)
  const currentProfile = ref<TutorProfile | null>(null)
  const isLoadingProfile = ref(false)

  // My profile state (editing)
  const myProfile = ref<TutorProfile | null>(null)
  const isLoadingMyProfile = ref(false)
  const isSaving = ref(false)

  // Filter options
  const filterOptions = ref<FilterOptions | null>(null)

  // Error state
  const error = ref<string | null>(null)

  // Getters
  const hasMore = computed(() => tutors.value.length < totalCount.value)

  const isProfileComplete = computed(() => {
    if (!myProfile.value) return false
    return !!(
      myProfile.value.photo &&
      myProfile.value.bio &&
      myProfile.value.subjects.length > 0 &&
      myProfile.value.hourly_rate > 0
    )
  })

  const canSubmitForReview = computed(() => {
    return myProfile.value?.status === 'draft' && isProfileComplete.value
  })

  const canPublish = computed(() => {
    return myProfile.value?.status === 'approved'
  })

  // Actions
  async function loadTutors(reset: boolean = false): Promise<void> {
    if (reset) {
      currentPage.value = 1
      tutors.value = []
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await marketplaceApi.getTutors(
        filters.value,
        currentPage.value,
        pageSize.value,
        sortBy.value
      )

      if (reset) {
        tutors.value = response.results
      } else {
        tutors.value = [...tutors.value, ...response.results]
      }
      totalCount.value = response.count
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load tutors'
      console.error('[MarketplaceStore] loadTutors error:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await loadTutors(false)
  }

  function setFilters(newFilters: CatalogFilters): void {
    filters.value = newFilters
    loadTutors(true)
  }

  function clearFilters(): void {
    filters.value = {}
    loadTutors(true)
  }

  function setSort(sort: string): void {
    sortBy.value = sort
    loadTutors(true)
  }

  async function loadProfile(slug: string): Promise<void> {
    isLoadingProfile.value = true
    error.value = null

    try {
      currentProfile.value = await marketplaceApi.getTutorProfile(slug)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load profile'
      currentProfile.value = null
      console.error('[MarketplaceStore] loadProfile error:', err)
    } finally {
      isLoadingProfile.value = false
    }
  }

  function clearCurrentProfile(): void {
    currentProfile.value = null
  }

  async function loadMyProfile(): Promise<void> {
    isLoadingMyProfile.value = true
    error.value = null

    try {
      myProfile.value = await marketplaceApi.getMyProfile()
    } catch (err) {
      // Profile doesn't exist yet - this is OK
      myProfile.value = null
    } finally {
      isLoadingMyProfile.value = false
    }
  }

  async function createProfile(data: Partial<TutorProfile>): Promise<void> {
    isSaving.value = true
    error.value = null

    try {
      myProfile.value = await marketplaceApi.createProfile(data)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create profile'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function updateProfile(data: Partial<TutorProfile>): Promise<void> {
    isSaving.value = true
    error.value = null

    try {
      myProfile.value = await marketplaceApi.updateProfile(data)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update profile'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function submitForReview(): Promise<void> {
    isSaving.value = true
    error.value = null

    try {
      myProfile.value = await marketplaceApi.submitForReview()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit for review'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function publishProfile(): Promise<void> {
    isSaving.value = true
    error.value = null

    try {
      myProfile.value = await marketplaceApi.publishProfile()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to publish profile'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function unpublishProfile(): Promise<void> {
    isSaving.value = true
    error.value = null

    try {
      myProfile.value = await marketplaceApi.unpublishProfile()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to unpublish profile'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function uploadPhoto(file: File): Promise<string> {
    isSaving.value = true
    error.value = null

    try {
      const result = await marketplaceApi.uploadPhoto(file)
      if (myProfile.value) {
        myProfile.value.photo = result.url
      }
      return result.url
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to upload photo'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function loadFilterOptions(): Promise<void> {
    try {
      filterOptions.value = await marketplaceApi.getFilterOptions()
    } catch (err) {
      console.error('[MarketplaceStore] loadFilterOptions error:', err)
    }
  }

  function $reset(): void {
    tutors.value = []
    totalCount.value = 0
    currentPage.value = 1
    filters.value = {}
    sortBy.value = '-average_rating'
    currentProfile.value = null
    myProfile.value = null
    filterOptions.value = null
    error.value = null
    isLoading.value = false
    isLoadingProfile.value = false
    isLoadingMyProfile.value = false
    isSaving.value = false
  }

  return {
    // State
    tutors,
    totalCount,
    currentPage,
    pageSize,
    isLoading,
    filters,
    sortBy,
    currentProfile,
    isLoadingProfile,
    myProfile,
    isLoadingMyProfile,
    isSaving,
    filterOptions,
    error,

    // Getters
    hasMore,
    isProfileComplete,
    canSubmitForReview,
    canPublish,

    // Actions
    loadTutors,
    loadMore,
    setFilters,
    clearFilters,
    setSort,
    loadProfile,
    clearCurrentProfile,
    loadMyProfile,
    createProfile,
    updateProfile,
    submitForReview,
    publishProfile,
    unpublishProfile,
    uploadPhoto,
    loadFilterOptions,
    $reset,
  }
})

export default useMarketplaceStore
