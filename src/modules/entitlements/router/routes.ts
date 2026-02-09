/**
 * Entitlements Module Routes
 * 
 * DOMAIN-06: Entitlements Routing
 */

import { useAuthStore } from '@/modules/auth/store/authStore'

const requiresAuth = () => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) {
    return { path: '/auth/login', query: { redirect: window.location.pathname } }
  }
  return true
}

export const entitlementsRoutes = [
  {
    path: '/plan-features',
    name: 'PlanFeatures',
    component: () => import('./views/PlanFeaturesView.vue'),
    beforeEnter: [requiresAuth],
    meta: {
      title: 'entitlements.features.title',
      requiresAuth: true,
    },
  },
]

export default entitlementsRoutes
