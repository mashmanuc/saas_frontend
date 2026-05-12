<template>
  <span
    class="upgrade-hint"
    :class="[`upgrade-hint--${variant}`]"
    role="note"
  >
    <Sparkles v-if="variant === 'inline'" :size="12" class="upgrade-hint__icon" />
    <span class="upgrade-hint__text">{{ $t(messageKey) }}</span>
    <router-link
      :to="{ name: 'billing-plans' }"
      class="upgrade-hint__cta"
      @click="onCtaClick"
    >
      {{ $t('billing.upgradeCta') }}
    </router-link>
  </span>
</template>

<script setup lang="ts">
/**
 * UpgradeHint (Sprint 2 §4.3 — soft monetization).
 *
 * НЕ-агресивний inline hint що рендериться поруч з заблокованою/обмеженою дією.
 * Sprint 2: жоден production endpoint ще не повертає 403 LIMIT_EXCEEDED/FEATURE_REQUIRED —
 * компонент будується як інфраструктура.
 *
 * Контекст застосування:
 *  - context="feature" — функція доступна на PRO (наприклад advanced search)
 *  - context="limit"   — квота вичерпана (наприклад monthly_lessons)
 *
 * UI правила:
 *  - НЕ popup
 *  - НЕ блокує дію
 *  - текстовий лінк → billing-plans
 *
 * Telemetry: `billing.upgrade_hint_shown` (best-effort, не блокує UI).
 */
import { onMounted } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { trackEvent } from '@/utils/telemetry'

interface Props {
  /** Семантичний контекст показу для telemetry та можливого вибору тексту. */
  context?: 'feature' | 'limit'
  /** Опційний код фічі/ліміту для telemetry (наприклад "monthly_lessons"). */
  code?: string
  /** Стиль: 'inline' (поруч з дією) | 'standalone' (окремий рядок). */
  variant?: 'inline' | 'standalone'
  /** i18n ключ повідомлення; default — `billing.upgradeHint`. */
  messageKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  context: 'feature',
  code: '',
  variant: 'inline',
  messageKey: 'billing.upgradeHint',
})

onMounted(() => {
  try {
    trackEvent('billing.upgrade_hint_shown', {
      context: props.context,
      code: props.code || null,
    })
  } catch {
    // best-effort — не блокує UI
  }
})

function onCtaClick() {
  try {
    trackEvent('billing.upgrade_hint_clicked', {
      context: props.context,
      code: props.code || null,
    })
  } catch {
    // best-effort
  }
}
</script>

<style scoped>
.upgrade-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  line-height: 1.4;
}

.upgrade-hint--standalone {
  padding: 6px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, #f59e0b 8%, transparent);
}

.upgrade-hint__icon {
  color: #d97706;
  flex-shrink: 0;
}

.upgrade-hint__text {
  font-weight: 500;
}

.upgrade-hint__cta {
  color: var(--accent, #0ea5e9);
  text-decoration: none;
  font-weight: 600;
  margin-left: 2px;
}

.upgrade-hint__cta:hover {
  text-decoration: underline;
}
</style>
