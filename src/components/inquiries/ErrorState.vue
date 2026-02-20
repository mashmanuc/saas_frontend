<template>
  <div class="error-state" :class="variant">
    <div class="error-icon">
      <svg v-if="variant === 'error'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <svg v-else-if="variant === 'rate-limit'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <svg v-else-if="variant === 'forbidden'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    </div>
    
    <h3 class="error-title">{{ title }}</h3>
    <p class="error-message">{{ message }}</p>
    
    <div v-if="retryAfter" class="retry-info">
      {{ $t('inquiries.errors.retryAfter', { seconds: retryAfter }) }}
    </div>
    
    <div class="error-actions">
      <slot name="actions">
        <Button v-if="showRetry" variant="primary" @click="$emit('retry')">
          {{ $t('common.retry') }}
        </Button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ErrorState Component (Phase 1 v0.86)
 * 
 * Універсальний компонент для відображення помилок:
 * - error: загальна помилка
 * - rate-limit: 429 Too Many Requests
 * - forbidden: 401/403 Unauthorized/Forbidden
 */

defineProps<{
  variant?: 'error' | 'rate-limit' | 'forbidden' | 'unauthorized'
  title: string
  message: string
  retryAfter?: number
  showRetry?: boolean
}>()

defineEmits<{
  retry: []
}>()

import Button from '@/ui/Button.vue'
</script>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.error-icon {
  margin-bottom: 16px;
}

.error-state.error .error-icon {
  color: #EF4444;
}

.error-state.rate-limit .error-icon {
  color: #F59E0B;
}

.error-state.forbidden .error-icon {
  color: #DC2626;
}

.error-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.error-message {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #6B7280;
  max-width: 500px;
}

.retry-info {
  margin-bottom: 16px;
  padding: 8px 16px;
  background: #FEF3C7;
  border-radius: 6px;
  font-size: 13px;
  color: #92400E;
}

.error-actions {
  display: flex;
  gap: 12px;
}

</style>
