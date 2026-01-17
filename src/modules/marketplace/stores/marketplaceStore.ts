// TASK MF2: Marketplace Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { debounce } from '@/utils/debounce'
import { mapMarketplaceErrorToMessage, parseMarketplaceApiError } from '../utils/apiErrors'
import { i18n } from '@/i18n'
import marketplaceApi, {
  type TutorListItem,
  type TutorProfile,
  type TutorProfileFull,
  type TutorProfileUpdate,
  type ProfileUpdateResponse,
  type CatalogFilters,
  type FilterOptions,
  type TutorProfileUpsertPayload,
  type TutorProfilePatchPayload,
  type SubjectCatalog,
  type SpecialtyTagCatalog,
  type TagGroup,
} from '../api/marketplace'
import { debugPayload } from '../adapters/profileAdapter'
import { notifyError } from '@/utils/notify'

export const useMarketplaceStore = defineStore('marketplace-v2', () => {
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
  const currentProfile = ref<TutorProfileFull | null>(null)
  const isLoadingProfile = ref(false)

  // My profile state (editing)
  const myProfile = ref<TutorProfileFull | null>(null)
  const isLoadingMyProfile = ref(false)
  const isSaving = ref(false)

  // Filter options
  const filterOptions = ref<FilterOptions | null>(null)

  // Error state
  const error = ref<string | null>(null)
  const validationErrors = ref<Record<string, string[]> | null>(null)

  // v0.60.1 Catalog state
  const catalogSubjects = ref<SubjectCatalog[]>([])
  const catalogTags = ref<SpecialtyTagCatalog[]>([])
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

  const missingProfileSections = computed(() => {
    const missing: string[] = []
    const profile = myProfile.value

    if (!profile) return missing

    if (!profile.media?.photo_url) {
      missing.push(t('marketplace.profile.editor.photoTitle'))
    }

    if (!profile.headline?.trim()) {
      missing.push(t('marketplace.profile.editor.headlineLabel'))
    }

    if (!profile.bio?.trim()) {
      missing.push(t('marketplace.profile.editor.bioLabel'))
    }

    if (!Array.isArray(profile.subjects) || profile.subjects.length === 0) {
      missing.push(t('marketplace.profile.editor.subjectsLabel'))
    }

    if (!Array.isArray(profile.languages) || profile.languages.length === 0) {
      missing.push(t('marketplace.profile.editor.languagesLabel'))
    }

    if (!profile.pricing || !profile.pricing.hourly_rate || profile.pricing.hourly_rate <= 0) {
      missing.push(t('marketplace.profile.editor.hourlyRateLabel'))
    }

    return missing
  })

  const isProfileComplete = computed(() => {
    if (!myProfile.value) return false
    return missingProfileSections.value.length === 0
  })

  const canSubmitForReview = computed(() => {
    return isProfileComplete.value
  })

  const canPublish = computed(() => {
    return isProfileComplete.value
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
      // v0.60.1: Use new endpoint getTutorMeProfile
      const profile = await marketplaceApi.getTutorMeProfile()
      // Convert TutorProfileFull to legacy TutorProfile format for compatibility
      myProfile.value = profile as any
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
      // v0.60.1: Debug payload before sending
      if (import.meta.env.DEV) {
        debugPayload(data as TutorProfileUpdate, 'marketplaceStore.createProfile')
      }
      await marketplaceApi.updateTutorMeProfile(data as TutorProfileUpdate)
      myProfile.value = await marketplaceApi.getTutorMeProfile()
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, t('marketplace.errors.createProfile'))
      
      // Show toast with first validation error
      if (validationErrors.value) {
        const firstField = Object.keys(validationErrors.value)[0]
        const firstMessages = validationErrors.value[firstField]
        if (firstMessages && firstMessages.length > 0) {
          notifyError(`${firstField}: ${firstMessages[0]}`)
        }
      }
      
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
      // v0.60.1: Debug payload before sending
      if (import.meta.env.DEV) {
        debugPayload(data as TutorProfileUpdate, 'marketplaceStore.updateProfile')
      }
      await marketplaceApi.updateTutorMeProfile(data as TutorProfileUpdate)
      myProfile.value = await marketplaceApi.getTutorMeProfile()
    } catch (err) {
      setValidationErrorsFromApi(err)
      error.value = mapApiError(err, t('marketplace.errors.updateProfile'))
      
      // Show toast with first validation error
      if (validationErrors.value) {
        const firstField = Object.keys(validationErrors.value)[0]
        const firstMessages = validationErrors.value[firstField]
        if (firstMessages && firstMessages.length > 0) {
          notifyError(`${firstField}: ${firstMessages[0]}`)
        }
      }
      
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
      await marketplaceApi.submitForReview()
      myProfile.value = await marketplaceApi.getTutorMeProfile()
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
      await marketplaceApi.publishProfile()
      myProfile.value = await marketplaceApi.getTutorMeProfile()
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
      await marketplaceApi.unpublishProfile()
      myProfile.value = await marketplaceApi.getTutorMeProfile()
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

  function getTagsByGroup(group: TagGroup): SpecialtyTagCatalog[] {
    return catalogTags.value.filter((t) => t.group === group)
  }

  function getSubjectByCode(code: string): SubjectCatalog | undefined {
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
    missingProfileSections,
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
