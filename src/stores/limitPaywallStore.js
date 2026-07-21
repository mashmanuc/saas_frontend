import { defineStore } from 'pinia'

/**
 * Ф3 (2026-07-19): Глобальний стан paywall для SaaS-лімітів.
 *
 * Тригериться коли BE повертає 403 LIMIT_EXCEEDED з `key` — це власні дії
 * тьютора понад ліміт тарифу (AI-запити / експорти / імпорти). Одна модалка
 * монтується у PageShell (Modal сам Teleport-иться у body).
 *
 * НЕ для точки №3 (max_active_students): там 409 блокує УЧНЯ через ліміт
 * ТЬЮТОРА — інший UX, обробляється у invite-флоу.
 *
 * SSOT: backend/apps/payments/LIMITS_OPS_RUNBOOK.md §5.
 */
export const useLimitPaywallStore = defineStore('limitPaywall', {
  state: () => ({
    visible: false,
    limitKey: null, // 'monthly_ai_requests' | 'monthly_exports' | 'monthly_imports' | null
  }),

  actions: {
    open(limitKey = null) {
      this.limitKey = limitKey
      this.visible = true
    },

    close() {
      this.visible = false
    },
  },
})
