export const ROLE_HOME_ROUTES = {
  superadmin: '/staff',
  admin: '/staff',
  staff: '/staff',
  tutor: '/tutor',
  student: '/student',
}

export function getDefaultRouteForRole(role) {
  const key = typeof role === 'string' ? role.toLowerCase() : role
  return ROLE_HOME_ROUTES[key] || '/'
}

export function hasAccess(user, route) {
  const allowedRoles = route?.meta?.roles
  if (!allowedRoles || !allowedRoles.length) {
    return true
  }
  if (!user?.role) {
    return false
  }
  const userRole = typeof user.role === 'string' ? user.role.toLowerCase() : user.role
  return allowedRoles.some(r => (typeof r === 'string' ? r.toLowerCase() : r) === userRole)
}
