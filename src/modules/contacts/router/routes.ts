/**
 * Contacts Module Routes
 * 
 * DOMAIN-07: Contact Tokens Routing
 */

import { useAuthStore } from '@/modules/auth/store/authStore'
import { USER_ROLES } from '@/types/user'

const requiresAuth = () => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) {
    return { path: '/auth/login', query: { redirect: window.location.pathname } }
  }
  return true
}

const requiresTutor = () => {
  const authStore = useAuthStore()
  const role = authStore.userRole
  if (role !== USER_ROLES.TUTOR && role !== USER_ROLES.ADMIN) {
    return { path: '/dashboard' }
  }
  return true
}

export const contactsRoutes = [
  {
    path: '/contacts',
    name: 'Contacts',
    component: () => import('./views/ContactsView.vue'),
    beforeEnter: [requiresAuth, requiresTutor],
    meta: {
      title: 'contacts.title',
      requiresAuth: true,
      requiresTutor: true,
    },
  },
  {
    path: '/contacts/purchase',
    name: 'ContactsPurchase',
    component: () => import('./views/PurchaseView.vue'),
    beforeEnter: [requiresAuth, requiresTutor],
    meta: {
      title: 'contacts.purchase.title',
      requiresAuth: true,
      requiresTutor: true,
    },
  },
  {
    path: '/contacts/purchase/success',
    name: 'ContactsPurchaseSuccess',
    component: () => import('./views/PurchaseSuccessView.vue'),
    beforeEnter: [requiresAuth],
    meta: {
      title: 'contacts.purchase.success',
      requiresAuth: true,
    },
  },
  {
    path: '/contacts/purchase/cancel',
    name: 'ContactsPurchaseCancel',
    component: () => import('./views/PurchaseCancelView.vue'),
    beforeEnter: [requiresAuth],
    meta: {
      title: 'contacts.purchase.cancel',
      requiresAuth: true,
    },
  },
  {
    path: '/contacts/ledger',
    name: 'ContactsLedger',
    component: () => import('./views/LedgerView.vue'),
    beforeEnter: [requiresAuth, requiresTutor],
    meta: {
      title: 'contacts.ledger.title',
      requiresAuth: true,
      requiresTutor: true,
    },
  },
]

export default contactsRoutes
