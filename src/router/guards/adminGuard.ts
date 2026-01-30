/**
 * Admin/Operator Guard
 * Перевіряє чи користувач має роль ADMIN, SUPERADMIN або OPERATOR
 */

import { useAuthStore } from '@/modules/auth/store/authStore'
import { USER_ROLES } from '@/types/user'
import type { RouteLocationNormalized, NavigationGuardNext } from 'vue-router'

export function requiresAdminOrOperator(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void {
  const authStore = useAuthStore()
  const user = authStore.user

  if (!user) {
    next({ path: '/auth/login', query: { redirect: to.fullPath } })
    return
  }

  const allowedRoles = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, 'OPERATOR']
  const hasAccess = allowedRoles.includes(user.role)

  if (!hasAccess) {
    next({ path: '/', replace: true })
    return
  }

  next()
}

export default requiresAdminOrOperator
