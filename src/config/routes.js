export const ROLE_HOME_ROUTES = {
  superadmin: '/staff',
  admin: '/staff',
  staff: '/staff',
  tutor: '/tutor',
  student: '/student',
}

export function getDefaultRouteForRole(role) {
  return ROLE_HOME_ROUTES[role] || '/'
}

export function hasAccess(user, route) {
  const allowedRoles = route?.meta?.roles
  if (!allowedRoles || !allowedRoles.length) {
    return true
  }
  if (!user?.role) {
    return false
  }
  return allowedRoles.includes(user.role)
}
