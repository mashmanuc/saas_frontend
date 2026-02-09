/**
 * Entitlements Module
 * 
 * DOMAIN-06: Entitlements — Feature Gates, Grace Period, Plan Features
 * 
 * Entry point for the entitlements module.
 */

// Store
export { useEntitlementsStore } from './stores/entitlementsStore'

// API
export { entitlementsApi } from './api/entitlements'

// Composables
export { useFeatureGate, useFeatureGates } from './composables/useFeatureGate'

// Components
export { default as GraceBanner } from './components/GraceBanner.vue'
export { default as FeatureGate } from './components/FeatureGate.vue'

// Views
export { default as PlanFeaturesView } from './views/PlanFeaturesView.vue'

// Routes
export { entitlementsRoutes } from './router/routes'
