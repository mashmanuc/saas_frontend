/**
 * Phase 30: Audit Overlay — Enable Check
 *
 * DEV → always ON
 * PROD → is_staff + localStorage opt-in ('m4_audit_overlay' = 'true')
 */

export function isAuditEnabled(): boolean {
  if (import.meta.env.DEV) return true

  try {
    const localFlag = localStorage.getItem('m4_audit_overlay') === 'true'
    if (!localFlag) return false

    // Lazy dynamic import to avoid circular deps with authStore
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('@/modules/auth/store/authStore')
    const store = useAuthStore()
    return store.user?.is_staff === true
  } catch {
    return false
  }
}
