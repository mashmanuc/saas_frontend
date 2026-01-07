// TASK MF2: Marketplace Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { debounce } from '@/utils/debounce'
import { mapMarketplaceErrorToMessage, parseMarketplaceApiError } from '../utils/apiErrors'
import { i18n } from '@/i18n'
import marketplaceApi, {
  type TutorListItem,
  type TutorProfile,
  type CatalogFilters,
  type FilterOptions,
  type TutorProfileUpsertPayload,
  type TutorProfilePatchPayload,
  type CatalogSubject,
  type CatalogTag,
  type TagGroup,
} from '../api/marketplace'

export const useMarketplaceStore = defineStore('marketplace', () => {
  // Catalog state
  const tutors = ref<TutorListItem[]>([])
  const totalCount = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(24)
  const isLoading = ref(false)
  const filters = ref<CatalogFilters>({})
  const sortBy = ref('recommended')

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

  // v0.60 Catalog state
  const catalogSubjects = ref<CatalogSubject[]>([])
  const catalogTags = ref<CatalogTag[]>([])
  const catalogLoading = ref(false)
  const catalogError = ref<string | null>(null)

  const t = (key: string): string => {
    try {
      return (i18n as any)?.global?.t?.(key) ?? key
    } catch (_err) {
      return key
    }
  }

  function mapApiError(err: unknown, fallback: string): string {
    return mapMarketplaceErrorToMessage(parseMarketplaceApiError(err), fallback)
  }

  function setValidationErrorsFromApi(err: unknown): void {
    const info = parseMarketplaceApiError(err)
    validationErrors.value = info.fields
  }

  // Getters
  const hasMore = computed(() => tutors.value.length < totalCount.value)

  const isProfileComplete = computed(() => {
    if (!myProfile.value) return false
    const avatarUrl = (myProfile.value as any).avatar_url || myProfile.value.user?.avatar_url
    return !!(
      avatarUrl &&
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
      totalPages.value = response.totalPages || 0
    } catch (err) {
      error.value = mapApiError(err, t('marketplace.errors.loadTutors'))
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

  function setPage(page: number): void {
    currentPage.value = page
    void loadTutors(true)
  }

  async function loadProfile(slug: string): Promise<void> {
    isLoadingProfile.value = true
    error.value = null

    try {
      currentProfile.value = await marketplaceApi.getTutorProfile(slug)
    } catch (err) {
      error.value = mapApiError(err, t('marketplace.errors.loadProfile'))
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
      error.value = mapApiError(err, t('marketplace.errors.createProfile'))
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
      myProfile.value = await marketplaceApi.updateProfile(data)
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, t('marketplace.errors.updateProfile'))
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
      error.value = mapApiError(err, t('marketplace.errors.submitForReview'))
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
      myProfile.value = await marketplaceApi.publishProfile()
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, t('marketplace.errors.publishProfile'))
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
      myProfile.value = await marketplaceApi.unpublishProfile()
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, t('marketplace.errors.unpublishProfile'))
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

  // v0.60 Catalog methods
  async function loadCatalogSubjects(locale: string = 'uk'): Promise<void> {
    try {
      catalogLoading.value = true
      catalogError.value = null
      catalogSubjects.value = await marketplaceApi.getCatalogSubjects(locale)
    } catch (err) {
      console.error('[MarketplaceStore] loadCatalogSubjects error:', err)
      catalogError.value = mapApiError(err, 'Failed to load subjects')
    } finally {
      catalogLoading.value = false
    }
  }

  async function loadCatalogTags(
    locale: string = 'uk',
    group?: TagGroup
  ): Promise<void> {
    try {
      catalogLoading.value = true
      catalogError.value = null
      catalogTags.value = await marketplaceApi.getCatalogTags(locale, group)
    } catch (err) {
      console.error('[MarketplaceStore] loadCatalogTags error:', err)
      catalogError.value = mapApiError(err, 'Failed to load tags')
    } finally {
      catalogLoading.value = false
    }
  }

  function getTagsByGroup(group: TagGroup): CatalogTag[] {
    return catalogTags.value.filter((t) => t.group === group)
  }

  function getSubjectByCode(code: string): CatalogSubject | undefined {
    return catalogSubjects.value.find((s) => s.code === code)
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
    catalogSubjects.value = []
    catalogTags.value = []
    catalogLoading.value = false
    catalogError.value = null
  }

  return {
    // State
    tutors,
    totalCount,
    totalPages,
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

    // v0.60 Catalog
    catalogSubjects,
    catalogTags,
    catalogLoading,
    catalogError,

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
    setPage,
    loadProfile,
    clearCurrentProfile,
    loadMyProfile,
    createProfile,
    updateProfile,
    submitForReview,
    publishProfile,
    unpublishProfile,
    loadFilterOptions,

    // v0.60 Catalog actions
    loadCatalogSubjects,
    loadCatalogTags,
    getTagsByGroup,
    getSubjectByCode,

    $reset,
  }
})

export default useMarketplaceStore
