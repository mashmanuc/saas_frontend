/**
 * Trust Module Routes
 * 
 * DOMAIN-12: Trust & Safety Routing
 */

import { useAuthStore } from '@/modules/auth/store/authStore'

const requiresAuth = () => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) {
    return { path: '/auth/login', query: { redirect: window.location.pathname } }
  }
  return true
}

export const trustRoutes = [
  {
    path: '/trust/blocked',
    name: 'BlockedUsers',
    component: () => import('./views/BlockedUsersView.vue'),
    beforeEnter: [requiresAuth],
    meta: {
      title: 'trust.blocked.title',
      requiresAuth: true,
    },
  },
  {
    path: '/trust/appeals',
    name: 'MyAppeals',
    component: () => import('./views/AppealsView.vue'),
    beforeEnter: [requiresAuth],
    meta: {
      title: 'trust.appeals.title',
      requiresAuth: true,
    },
  },
]

export default trustRoutes
