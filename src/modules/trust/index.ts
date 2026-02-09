/**
 * Trust Module
 * 
 * DOMAIN-12: Trust & Safety — Block, Report, Bans, Appeals
 * 
 * Entry point for the trust module.
 */

// Store
export { useTrustStore } from './stores/trustStore'

// API
export { trustApi } from './api/trust'

// Components
export { default as BlockUserModal } from './components/BlockUserModal.vue'
export { default as ReportUserModal } from './components/ReportUserModal.vue'
export { default as BlockedUsersList } from './components/BlockedUsersList.vue'
export { default as TrustGuardBanner } from './components/TrustGuardBanner.vue'

// Views
export { default as BlockedUsersView } from './views/BlockedUsersView.vue'
export { default as AppealsView } from './views/AppealsView.vue'

// Routes
export { trustRoutes } from './router/routes'
