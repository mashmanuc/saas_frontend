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

    if (route.query.subject) urlFilters.subject = route.query.subject as string
    if (route.query.country) urlFilters.country = route.query.country as string
    if (route.query.language) urlFilters.language = route.query.language as string
    if (route.query.min_price) urlFilters.min_price = Number(route.query.min_price)
    if (route.query.max_price) urlFilters.max_price = Number(route.query.max_price)
    if (route.query.min_rating) urlFilters.min_rating = Number(route.query.min_rating)
    if (route.query.has_video === 'true') urlFilters.has_video = true
    if (route.query.is_verified === 'true') urlFilters.is_verified = true

    if (Object.keys(urlFilters).length > 0) {
      store.setFilters(urlFilters)
    }

    if (route.query.sort) {
      store.setSort(route.query.sort as string)
    }
  }

  // Update URL when filters change
  function updateUrlWithFilters(newFilters: CatalogFilters) {
    const query: Record<string, string> = {}

    if (newFilters.subject) query.subject = newFilters.subject
    if (newFilters.country) query.country = newFilters.country
    if (newFilters.language) query.language = newFilters.language
    if (newFilters.min_price) query.min_price = String(newFilters.min_price)
    if (newFilters.max_price) query.max_price = String(newFilters.max_price)
    if (newFilters.min_rating) query.min_rating = String(newFilters.min_rating)
    if (newFilters.has_video) query.has_video = 'true'
    if (newFilters.is_verified) query.is_verified = 'true'
    if (sortBy.value !== '-average_rating') query.sort = sortBy.value

    router.replace({ query })
  }

  // Watch for filter changes and update URL
  watch(filters, (newFilters) => {
    updateUrlWithFilters(newFilters)
  })

  onMounted(() => {
    syncFiltersWithUrl()
  })

  return {
    // State
    tutors,
    totalCount,
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
    loadFilterOptions: store.loadFilterOptions,
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
