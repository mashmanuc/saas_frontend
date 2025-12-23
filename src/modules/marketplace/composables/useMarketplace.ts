// TASK MF11: useMarketplace Composable

import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import type { CatalogFilters } from '../api/marketplace'

/**
 * Composable for tutor catalog functionality.
 */
export function useMarketplace() {
  const store = useMarketplaceStore()
  const route = useRoute()
  const router = useRouter()

  const {
    tutors,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
    isLoading,
    hasMore,
    filters,
    sortBy,
    filterOptions,
    error,
  } = storeToRefs(store)

  // Sync filters with URL
  function syncFiltersWithUrl() {
    const urlFilters: CatalogFilters = {}

    if (typeof route.query.q === 'string') urlFilters.q = route.query.q

    if (route.query.subject) {
      const v = route.query.subject
      const raw = Array.isArray(v) ? (v as string[]) : [v as string]
      urlFilters.subject = raw.flatMap((s) => String(s).split(',').filter(Boolean))
    }
    if (route.query.language) {
      const v = route.query.language
      const raw = Array.isArray(v) ? (v as string[]) : [v as string]
      urlFilters.language = raw.flatMap((s) => String(s).split(',').filter(Boolean))
    }

    if (typeof route.query.country === 'string') urlFilters.country = route.query.country
    if (typeof route.query.timezone === 'string') urlFilters.timezone = route.query.timezone
    if (typeof route.query.format === 'string') urlFilters.format = route.query.format as any
    if (typeof route.query.direction === 'string') urlFilters.direction = route.query.direction

    if (typeof route.query.price_min === 'string') urlFilters.price_min = Number(route.query.price_min)
    if (typeof route.query.price_max === 'string') urlFilters.price_max = Number(route.query.price_max)
    if (typeof route.query.experience_min === 'string') urlFilters.experience_min = Number(route.query.experience_min)
    if (typeof route.query.experience_max === 'string') urlFilters.experience_max = Number(route.query.experience_max)

    if (route.query.has_certifications === 'true') urlFilters.has_certifications = true

    if (Object.keys(urlFilters).length > 0) {
      store.setFilters(urlFilters)
    }

    if (route.query.sort) {
      store.setSort(route.query.sort as string)
    }
  }

  // Update URL when filters change
  function updateUrlWithFilters(newFilters: CatalogFilters) {
    const query: Record<string, string | string[]> = {}

    if (typeof newFilters.q === 'string' && newFilters.q.trim().length >= 2) query.q = newFilters.q.trim()

    if (Array.isArray(newFilters.subject) && newFilters.subject.length > 0) {
      query.subject = newFilters.subject.length === 1 ? newFilters.subject[0] : newFilters.subject
    }
    if (Array.isArray(newFilters.language) && newFilters.language.length > 0) {
      query.language = newFilters.language.length === 1 ? newFilters.language[0] : newFilters.language
    }

    if (newFilters.country) query.country = newFilters.country
    if (newFilters.timezone) query.timezone = newFilters.timezone
    if (newFilters.format) query.format = newFilters.format
    if (newFilters.direction) query.direction = newFilters.direction

    if (typeof newFilters.price_min === 'number') query.price_min = String(newFilters.price_min)
    if (typeof newFilters.price_max === 'number') query.price_max = String(newFilters.price_max)
    if (typeof newFilters.experience_min === 'number') query.experience_min = String(newFilters.experience_min)
    if (typeof newFilters.experience_max === 'number') query.experience_max = String(newFilters.experience_max)

    if (newFilters.has_certifications) query.has_certifications = 'true'
    if (sortBy.value !== 'recommended') query.sort = sortBy.value

    router.replace({ query })
  }

  // Watch for filter changes and update URL
  watch(
    () => ({ ...filters.value, sort: sortBy.value }),
    (payload) => {
      const { sort, ...rest } = payload as any
      updateUrlWithFilters(rest)
    },
    { deep: true }
  )

  onMounted(() => {
    syncFiltersWithUrl()
  })

  return {
    // State
    tutors,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
    isLoading,
    hasMore,
    filters,
    sortBy,
    filterOptions,
    error,

    // Actions
    loadTutors: store.loadTutors,
    loadMore: store.loadMore,
    setFilters: store.setFilters,
    clearFilters: store.clearFilters,
    setSort: store.setSort,
    setPage: store.setPage,
    loadFilterOptions: store.loadFilterOptions,
    syncFiltersWithUrl,
  }
}

/**
 * Composable for viewing a tutor profile.
 */
export function useProfile() {
  const store = useMarketplaceStore()
  const route = useRoute()

  const { currentProfile, isLoadingProfile, error } = storeToRefs(store)

  const slug = computed(() => route.params.slug as string)

  onMounted(() => {
    if (slug.value) {
      store.loadProfile(slug.value)
    }
  })

  watch(slug, (newSlug) => {
    if (newSlug) {
      store.loadProfile(newSlug)
    }
  })

  return {
    profile: currentProfile,
    isLoading: isLoadingProfile,
    error,
    slug,
    loadProfile: store.loadProfile,
    clearProfile: store.clearCurrentProfile,
  }
}

/**
 * Composable for managing own tutor profile.
 */
export function useMyProfile() {
  const store = useMarketplaceStore()

  const {
    myProfile,
    isLoadingMyProfile,
    isSaving,
    isProfileComplete,
    canSubmitForReview,
    canPublish,
    error,
  } = storeToRefs(store)

  onMounted(() => {
    store.loadMyProfile()
  })

  return {
    profile: myProfile,
    isLoading: isLoadingMyProfile,
    isSaving,
    isComplete: isProfileComplete,
    canSubmit: canSubmitForReview,
    canPublish,
    error,

    // Actions
    loadProfile: store.loadMyProfile,
    createProfile: store.createProfile,
    updateProfile: store.updateProfile,
    submitForReview: store.submitForReview,
    publishProfile: store.publishProfile,
    unpublishProfile: store.unpublishProfile,
  }
}

export default {
  useMarketplace,
  useProfile,
  useMyProfile,
}
