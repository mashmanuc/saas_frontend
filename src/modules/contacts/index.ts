/**
 * Contacts Module
 * 
 * DOMAIN-07: Contact Tokens
 * 
 * Entry point for the contacts module.
 */

// Store
export { useContactTokensStore } from './stores/contactTokensStore'

// API
export { contactsApi } from './api/contacts'

// Components
export { default as ContactBalanceWidget } from './components/ContactBalanceWidget.vue'
export { default as ContactLedgerTable } from './components/ContactLedgerTable.vue'
export { default as TokenGrantModal } from './components/TokenGrantModal.vue'
export { default as PurchaseTokensModal } from './components/PurchaseTokensModal.vue'
export { default as MonthlyAllowanceWidget } from './components/MonthlyAllowanceWidget.vue'

// Routes
export { contactsRoutes } from './router/routes'

// Views
export { default as ContactsView } from './views/ContactsView.vue'
