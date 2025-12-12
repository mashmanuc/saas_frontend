// Marketplace Module Exports

// Views
export { default as TutorCatalogView } from './views/TutorCatalogView.vue'
export { default as TutorProfileView } from './views/TutorProfileView.vue'
export { default as MyProfileView } from './views/MyProfileView.vue'

// Store
export { useMarketplaceStore } from './stores/marketplaceStore'

// Composables
export { useMarketplace, useProfile, useMyProfile } from './composables/useMarketplace'

// API
export { marketplaceApi } from './api/marketplace'
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
} from './api/marketplace'
