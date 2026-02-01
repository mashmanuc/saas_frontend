<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface Props {
  level?: 'none' | 'basic' | 'advanced' | 'premium'
  showTooltip?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  level: 'none',
  showTooltip: true
})

const { t } = useI18n()

const badgeConfig = computed(() => {
  switch (props.level) {
    case 'basic':
      return {
        label: t('marketplace.verification.badge.basic'),
        icon: '✓',
        color: '#10b981',
        tooltip: t('marketplace.verification.badge.basicTooltip')
      }
    case 'advanced':
      return {
        label: t('marketplace.verification.badge.advanced'),
        icon: '✓✓',
        color: '#3b82f6',
        tooltip: t('marketplace.verification.badge.advancedTooltip')
      }
    case 'premium':
      return {
        label: t('marketplace.verification.badge.premium'),
        icon: '★',
        color: '#f59e0b',
        tooltip: t('marketplace.verification.badge.premiumTooltip')
      }
    default:
      return null
  }
})
</script>

<template>
  <div
    v-if="badgeConfig"
    class="verification-badge"
    :class="`badge-${level}`"
    :style="{ '--badge-color': badgeConfig.color }"
    :title="showTooltip ? badgeConfig.tooltip : undefined"
    data-test="verification-badge"
  >
    <span class="badge-icon">{{ badgeConfig.icon }}</span>
    <span class="badge-label">{{ badgeConfig.label }}</span>
  </div>
</template>

<style scoped>
.verification-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: color-mix(in srgb, var(--badge-color) 12%, transparent);
  color: var(--badge-color);
  border: 1px solid color-mix(in srgb, var(--badge-color) 25%, transparent);
  cursor: help;
  transition: all 0.2s;
}

.verification-badge:hover {
  background: color-mix(in srgb, var(--badge-color) 18%, transparent);
  border-color: color-mix(in srgb, var(--badge-color) 35%, transparent);
}

.badge-icon {
  font-size: 0.875rem;
  line-height: 1;
}

.badge-label {
  line-height: 1;
}
</style>
