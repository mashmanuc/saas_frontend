<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import VerificationBadge from './VerificationBadge.vue'
import { useI18n } from 'vue-i18n'

export interface VerificationStatus {
  level: 'none' | 'basic' | 'advanced' | 'premium'
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  expiryDate?: string
  pendingTasks?: string[]
}

export interface Props {
  status?: VerificationStatus | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  requestVerification: []
}>()

const { t } = useI18n()

const canRequestUpgrade = computed(() => {
  if (!props.status) return true
  return props.status.status === 'approved' && props.status.level !== 'premium'
})

const nextLevel = computed(() => {
  if (!props.status || props.status.level === 'none') return 'basic'
  if (props.status.level === 'basic') return 'advanced'
  if (props.status.level === 'advanced') return 'premium'
  return null
})

function handleRequestClick() {
  emit('requestVerification')
}
</script>

<template>
  <div class="verification-widget" data-test="verification-status-widget">
    <div class="widget-header">
      <h3>{{ t('marketplace.verification.widget.title') }}</h3>
    </div>

    <div v-if="status" class="status-content">
      <div class="current-level">
        <span class="label">{{ t('marketplace.verification.widget.currentLevel') }}</span>
        <VerificationBadge :level="status.level" />
      </div>

      <div v-if="status.expiryDate" class="expiry-info">
        <span class="label">{{ t('marketplace.verification.widget.expiresOn') }}</span>
        <span class="value">{{ new Date(status.expiryDate).toLocaleDateString() }}</span>
      </div>

      <div v-if="status.status === 'pending'" class="pending-notice">
        <span class="notice-icon">⏳</span>
        <span>{{ t('marketplace.verification.widget.pendingReview') }}</span>
      </div>

      <div v-if="status.pendingTasks && status.pendingTasks.length > 0" class="pending-tasks">
        <p class="tasks-title">{{ t('marketplace.verification.widget.pendingTasks') }}</p>
        <ul>
          <li v-for="(task, index) in status.pendingTasks" :key="index">{{ task }}</li>
        </ul>
      </div>
    </div>

    <div v-else class="no-verification">
      <p>{{ t('marketplace.verification.widget.noVerification') }}</p>
    </div>

    <button
      v-if="canRequestUpgrade"
      class="btn btn-primary btn-block"
      data-test="request-verification-btn"
      @click="handleRequestClick"
    >
      {{ nextLevel ? t('marketplace.verification.widget.requestUpgrade', { level: nextLevel }) : t('marketplace.verification.widget.requestVerification') }}
    </button>
  </div>
</template>

<style scoped>
.verification-widget {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.widget-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--text-primary);
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.current-level,
.expiry-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 600;
}

.pending-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--warning-bg) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning-bg) 25%, transparent);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--text-primary);
}

.notice-icon {
  font-size: 1.125rem;
}

.pending-tasks {
  padding: 0.75rem;
  background: color-mix(in srgb, var(--info-bg) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--info-bg) 20%, transparent);
  border-radius: var(--radius-md);
}

.tasks-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.pending-tasks ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pending-tasks li {
  margin-bottom: 0.25rem;
}

.no-verification {
  margin-bottom: 1.5rem;
}

.no-verification p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.btn-block {
  width: 100%;
}
</style>
