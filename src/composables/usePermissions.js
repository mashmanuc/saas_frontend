/**
 * Permissions UI Sync — v0.16.0
 * Заборонити кнопки, приховати дії, показувати tooltips "Немає доступу"
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Permission actions
 */
export const PERMISSION = {
  // Board permissions
  BOARD_VIEW: 'board:view',
  BOARD_EDIT: 'board:edit',
  BOARD_DELETE: 'board:delete',
  BOARD_SHARE: 'board:share',
  
  // Chat permissions
  CHAT_VIEW: 'chat:view',
  CHAT_SEND: 'chat:send',
  CHAT_DELETE: 'chat:delete',
  
  // Lesson permissions
  LESSON_VIEW: 'lesson:view',
  LESSON_CREATE: 'lesson:create',
  LESSON_EDIT: 'lesson:edit',
  LESSON_DELETE: 'lesson:delete',
  LESSON_JOIN: 'lesson:join',
  
  // User permissions
  USER_VIEW: 'user:view',
  USER_EDIT: 'user:edit',
  USER_INVITE: 'user:invite',
  USER_REMOVE: 'user:remove',
  
  // Call permissions
  CALL_START: 'call:start',
  CALL_JOIN: 'call:join',
  CALL_SCREEN_SHARE: 'call:screen_share',
  
  // Admin permissions
  ADMIN_ACCESS: 'admin:access',
  ADMIN_SETTINGS: 'admin:settings',
}

/**
 * Permission state store
 */
const permissionsState = ref(new Map())
const isLoading = ref(false)
const lastFetch = ref(null)

/**
 * Set permissions from backend
 */
export function setPermissions(permissions) {
  if (Array.isArray(permissions)) {
    permissionsState.value = new Map(permissions.map(p => [p, true]))
  } else if (typeof permissions === 'object') {
    permissionsState.value = new Map(Object.entries(permissions))
  }
  lastFetch.value = Date.now()
}

/**
 * Clear all permissions
 */
export function clearPermissions() {
  permissionsState.value = new Map()
  lastFetch.value = null
}

/**
 * Check if user has permission
 */
export function hasPermission(permission) {
  return permissionsState.value.get(permission) === true
}

/**
 * Check if user has any of the permissions
 */
export function hasAnyPermission(permissions) {
  return permissions.some(p => hasPermission(p))
}

/**
 * Check if user has all permissions
 */
export function hasAllPermissions(permissions) {
  return permissions.every(p => hasPermission(p))
}

/**
 * Permissions composable
 */
export function usePermissions() {
  const { t } = useI18n()
  
  /**
   * Check single permission
   */
  const can = (permission) => {
    return computed(() => hasPermission(permission))
  }
  
  /**
   * Check any permission
   */
  const canAny = (permissions) => {
    return computed(() => hasAnyPermission(permissions))
  }
  
  /**
   * Check all permissions
   */
  const canAll = (permissions) => {
    return computed(() => hasAllPermissions(permissions))
  }
  
  /**
   * Get disabled state for UI element
   */
  const isDisabled = (permission) => {
    return computed(() => !hasPermission(permission))
  }
  
  /**
   * Get tooltip for disabled element
   */
  const getDisabledTooltip = (permission) => {
    return computed(() => {
      if (hasPermission(permission)) {
        return null
      }
      return t('permissions.noAccess')
    })
  }
  
  /**
   * Get button props with permission check
   */
  const getButtonProps = (permission, options = {}) => {
    return computed(() => {
      const allowed = hasPermission(permission)
      
      return {
        disabled: !allowed || options.disabled,
        class: {
          'permission-denied': !allowed,
          ...options.class,
        },
        title: allowed ? options.title : t('permissions.noAccess'),
        'aria-disabled': !allowed,
      }
    })
  }
  
  /**
   * Get link props with permission check
   */
  const getLinkProps = (permission, options = {}) => {
    return computed(() => {
      const allowed = hasPermission(permission)
      
      if (!allowed) {
        return {
          href: '#',
          class: 'permission-denied',
          title: t('permissions.noAccess'),
          onClick: (e) => e.preventDefault(),
          'aria-disabled': true,
        }
      }
      
      return {
        href: options.href,
        class: options.class,
        title: options.title,
      }
    })
  }
  
  /**
   * Wrap action with permission check
   */
  const withPermission = (permission, action, fallback = null) => {
    return (...args) => {
      if (hasPermission(permission)) {
        return action(...args)
      }
      
      if (fallback) {
        return fallback(...args)
      }
      
      console.warn(`[permissions] Action blocked: ${permission}`)
      return null
    }
  }
  
  return {
    // State
    permissions: permissionsState,
    isLoading,
    
    // Checkers
    can,
    canAny,
    canAll,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // UI helpers
    isDisabled,
    getDisabledTooltip,
    getButtonProps,
    getLinkProps,
    
    // Action wrapper
    withPermission,
    
    // State management
    setPermissions,
    clearPermissions,
  }
}

/**
 * Permission directive
 * Usage: v-permission="'board:edit'" or v-permission="['board:edit', 'board:delete']"
 */
export const vPermission = {
  mounted(el, binding) {
    updateElement(el, binding)
  },
  updated(el, binding) {
    updateElement(el, binding)
  },
}

function updateElement(el, binding) {
  const permissions = Array.isArray(binding.value) ? binding.value : [binding.value]
  const mode = binding.arg || 'disable' // 'disable' | 'hide' | 'remove'
  const requireAll = binding.modifiers.all
  
  const hasAccess = requireAll 
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions)
  
  if (hasAccess) {
    // Restore element
    el.style.display = ''
    el.removeAttribute('disabled')
    el.classList.remove('permission-denied')
    el.removeAttribute('title')
    el.removeAttribute('aria-disabled')
  } else {
    switch (mode) {
      case 'hide':
        el.style.display = 'none'
        break
        
      case 'remove':
        el.parentNode?.removeChild(el)
        break
        
      case 'disable':
      default:
        el.setAttribute('disabled', 'disabled')
        el.classList.add('permission-denied')
        el.setAttribute('title', 'Немає доступу')
        el.setAttribute('aria-disabled', 'true')
        break
    }
  }
}

/**
 * Permission guard for routes
 */
export function createPermissionGuard(router) {
  router.beforeEach((to, from, next) => {
    const requiredPermissions = to.meta.permissions
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      next()
      return
    }
    
    const requireAll = to.meta.requireAllPermissions
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions)
    
    if (hasAccess) {
      next()
    } else {
      // Redirect to access denied page or home
      next({ name: 'AccessDenied', query: { redirect: to.fullPath } })
    }
  })
}

/**
 * Permission-aware component wrapper
 */
export function withPermissionCheck(component, permission, fallback = null) {
  return {
    name: `PermissionChecked${component.name || 'Component'}`,
    setup(props, { slots }) {
      const allowed = computed(() => hasPermission(permission))
      
      return () => {
        if (allowed.value) {
          return h(component, props, slots)
        }
        
        if (fallback) {
          return h(fallback, props, slots)
        }
        
        return null
      }
    },
  }
}

export default {
  usePermissions,
  vPermission,
  createPermissionGuard,
  withPermissionCheck,
  setPermissions,
  clearPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  PERMISSION,
}
