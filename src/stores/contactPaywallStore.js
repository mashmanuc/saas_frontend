import { defineStore } from 'pinia'

/**
 * P0 (2026-06-13): Глобальний стан paywall-модалки контактних токенів.
 *
 * Тригериться коли accept inquiry/invite повертає 400 CONTACTS_BALANCE_TOO_LOW
 * (монетизація enforced + баланс вичерпано). Єдина модалка монтується у
 * PageShell.vue (Modal сам Teleport-иться у body).
 *
 * SSOT: saas_docs/plans/BILLING_P0_AND_PLATA_MIGRATION_PLAN_2026-06-13.md §1.
 */
export const useContactPaywallStore = defineStore('contactPaywall', {
  state: () => ({
    visible: false,
    currentBalance: null,
  }),

  actions: {
    /**
     * Показати paywall. meta — опційний об'єкт з тіла помилки
     * ({ current_balance, tutor_id }).
     */
    open(meta = {}) {
      this.currentBalance = meta?.current_balance ?? null
      this.visible = true
    },

    close() {
      this.visible = false
    },
  },
})
