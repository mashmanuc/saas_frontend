// Marketplace Module Exports

// Views
export { default as TutorCatalogView } from './views/TutorCatalogView.vue'
export { default as TutorProfileView } from './views/TutorProfileView.vue'
export { default as MyProfileView } from './views/MyProfileView.vue'
export { default as SearchResultsView } from './views/SearchResultsView.vue'
export { default as CategoryView } from './views/CategoryView.vue'

// Stores
export { useMarketplaceStore } from './stores/marketplaceStore'
export { useSearchStore } from './stores/searchStore'

// Composables
export { useMarketplace, useProfile, useMyProfile } from './composables/useMarketplace'
export { useSearch } from './composables/useSearch'
export { useFilters } from './composables/useFilters'

// API
export { default as marketplaceApi } from './api/marketplace'
export type {
  TutorProfile,
  TutorListItem,
  CatalogFilters,
  FilterOptions,
  Badge,
  Education,
  Subject,
  Language,
  Certification,
  ProfileStatus,
  // v0.20.0 types
  SearchFilters,
  Category,
  SubjectOption,
  CountryOption,
  LanguageOption,
  ExtendedFilterOptions,
  Suggestion,
  SearchResponse,
} from './api/marketplace'
