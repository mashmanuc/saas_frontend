/**
 * Phase 30: Audit Overlay — Enable Check
 *
 * DEV → ON, якщо явно не вимкнено
 * PROD → is_staff + localStorage opt-in ('m4_audit_overlay' = 'true')
 *
 * 2026-09-22 (візуальний огляд, Топ-10 №5): панель висіла на КОЖНІЙ сторінці,
 * включно з продом (у власника прапорець стоїть, а він `is_staff`), і
 * перекривала футер, картки й нижні кнопки. Тепер її ✕ пише 'false' —
 * і це вимикає панель усюди, у тому числі в DEV.
 */

export const AUDIT_FLAG_KEY = 'm4_audit_overlay'

export function isAuditEnabled(): boolean {
  let flag: string | null = null
  try {
    flag = localStorage.getItem(AUDIT_FLAG_KEY)
  } catch {
    flag = null
  }

  // Явне «вимкнено» сильніше за режим збірки — інакше ✕ у DEV нічого не робив би.
  if (flag === 'false') return false

  if (import.meta.env.DEV) return true

  try {
    if (flag !== 'true') return false

    // Lazy dynamic import to avoid circular deps with authStore
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('@/modules/auth/store/authStore')
    const store = useAuthStore()
    return store.user?.is_staff === true
  } catch {
    return false
  }
}
