// TASK MF2: Marketplace Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { debounce } from '@/utils/debounce'
import {
  marketplaceApi,
  type TutorListItem,
  type TutorProfile,
  type CatalogFilters,
  type FilterOptions,
  type TutorProfileUpsertPayload,
  type TutorProfilePatchPayload,
} from '../api/marketplace'

export const useMarketplaceStore = defineStore('marketplace', () => {
  // Catalog state
  const tutors = ref<TutorListItem[]>([])
  const totalCount = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(24)
  const isLoading = ref(false)
  const filters = ref<CatalogFilters>({})
  const sortBy = ref('rating')

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
  const validationErrors = ref<Record<string, string[]> | null>(null)

  function mapApiError(err: unknown, fallback: string): string {
    const anyErr = err as any
    const status = anyErr?.response?.status
    const payload = anyErr?.response?.data
    const detail = payload?.detail
    const code = payload?.error || detail

    if (status === 422) {
      return 'Перевірте коректність даних профілю.'
    }

    if (status === 429 || code === 'rate_limited') {
      return 'Забагато запитів. Спробуйте ще раз трохи пізніше.'
    }
    if (status === 413 || code === 'payload_too_large') {
      return 'Дані завеликі. Зменшіть обсяг і спробуйте ще раз.'
    }
    if (status === 403 || code === 'forbidden') {
      return 'Доступ заборонено.'
    }
    if (status >= 500) {
      return 'Помилка сервера. Спробуйте пізніше.'
    }

    return detail || payload?.message || fallback
  }

  function setValidationErrorsFromApi(err: unknown): void {
    const anyErr = err as any
    const status = anyErr?.response?.status
    const payload = anyErr?.response?.data
    if (status !== 422 || !payload || typeof payload !== 'object') {
      validationErrors.value = null
      return
    }

    const next: Record<string, string[]> = {}
    const errors = (payload as any).errors || (payload as any)
    if (errors && typeof errors === 'object') {
      for (const [k, v] of Object.entries(errors)) {
        if (k === 'detail' || k === 'error') continue
        if (Array.isArray(v)) {
          next[k] = v.map((x) => String(x))
        } else if (typeof v === 'string') {
          next[k] = [v]
        } else if (v != null) {
          next[k] = [JSON.stringify(v)]
        }
      }
    }
    validationErrors.value = Object.keys(next).length ? next : null
  }

  // Getters
  const hasMore = computed(() => tutors.value.length < totalCount.value)

  const isProfileComplete = computed(() => {
    if (!myProfile.value) return false
    return !!(
      myProfile.value.photo &&
      myProfile.value.bio &&
      myProfile.value.subjects.length > 0 &&
      myProfile.value.languages.length > 0 &&
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
  const debouncedReload = debounce(() => {
    void loadTutors(true)
  }, 300)

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
      error.value = mapApiError(err, 'Не вдалося завантажити тьюторів.')
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

  function setFilters(newFilters: Partial<CatalogFilters>): void {
    const next: CatalogFilters = { ...filters.value, ...newFilters }

    if (typeof next.q === 'string') {
      const v = next.q.trim()
      if (v.length < 2) {
        delete (next as any).q
      } else {
        next.q = v
      }
    }

    filters.value = next
    debouncedReload()
  }

  function clearFilters(): void {
    filters.value = {}
    debouncedReload()
  }

  function setSort(sort: string): void {
    sortBy.value = sort
    debouncedReload()
  }

  async function loadProfile(slug: string): Promise<void> {
    isLoadingProfile.value = true
    error.value = null

    try {
      currentProfile.value = await marketplaceApi.getTutorProfile(slug)
    } catch (err) {
      error.value = mapApiError(err, 'Не вдалося завантажити профіль тьютора.')
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

  async function createProfile(data: TutorProfileUpsertPayload): Promise<void> {
    isSaving.value = true
    error.value = null
    validationErrors.value = null

    try {
      myProfile.value = await marketplaceApi.createProfile(data)
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, 'Не вдалося створити профіль.')
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function updateProfile(data: TutorProfilePatchPayload): Promise<void> {
    isSaving.value = true
    error.value = null
    validationErrors.value = null

    try {
      const id = myProfile.value?.id
      if (typeof id === 'number') {
        myProfile.value = await marketplaceApi.updateProfile(id, data)
      } else {
        throw new Error('profile_not_found')
      }
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, 'Не вдалося зберегти профіль.')
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function submitForReview(): Promise<void> {
    isSaving.value = true
    error.value = null
    validationErrors.value = null

    try {
      myProfile.value = await marketplaceApi.submitForReview()
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, 'Не вдалося відправити профіль на модерацію.')
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function publishProfile(): Promise<void> {
    isSaving.value = true
    error.value = null
    validationErrors.value = null

    try {
      const id = myProfile.value?.id
      if (typeof id !== 'number') {
        throw new Error('profile_not_found')
      }
      myProfile.value = await marketplaceApi.publishProfile(id)
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, 'Не вдалося опублікувати профіль.')
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function unpublishProfile(): Promise<void> {
    isSaving.value = true
    error.value = null
    validationErrors.value = null

    try {
      const id = myProfile.value?.id
      if (typeof id !== 'number') {
        throw new Error('profile_not_found')
      }
      myProfile.value = await marketplaceApi.unpublishProfile(id)
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, 'Не вдалося зняти профіль з публікації.')
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
    validationErrors,

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
    loadFilterOptions,
    $reset,
  }
})

export default useMarketplaceStore
