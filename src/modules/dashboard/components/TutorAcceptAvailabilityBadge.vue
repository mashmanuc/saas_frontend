<template>
  <div v-if="shouldShow" class="accept-availability">
    <div class="accept-availability__content">
      <div class="accept-availability__label">
        <span class="dot" :class="statusClass" aria-hidden="true"></span>
        <span>{{ $t('dashboard.tutor.accepts.title') }}</span>
      </div>
      <div class="accept-availability__value">
        <template v-if="isLoading">
          <span class="skeleton" aria-hidden="true"></span>
          <span class="sr-only">{{ $t('dashboard.tutor.accepts.loading') }}</span>
        </template>
        <template v-else-if="errorMessage">
          <span class="error-icon" aria-hidden="true">⚠</span>
          <span class="sr-only">{{ errorMessage }}</span>
        </template>
        <template v-else>
          <span class="value">{{ remainingAccepts }}</span>
          <span class="suffix">{{ suffixText }}</span>
        </template>
      </div>
    </div>
    <p v-if="expiresText" class="accept-availability__meta">
      {{ expiresText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useAcceptanceStore } from '@/stores/acceptanceStore'
import { useAuthStore } from '@/modules/auth/store/authStore'

dayjs.extend(relativeTime)

const authStore = useAuthStore()
const acceptanceStore = useAcceptanceStore()

const shouldShow = computed(() => authStore.user?.role === 'tutor')
const isLoading = computed(() => acceptanceStore.isLoading && acceptanceStore.status !== 'error')
const remainingAccepts = computed(() => acceptanceStore.remainingAccepts)
const errorMessage = computed(() => acceptanceStore.error)
const suffixText = computed(() => {
  return acceptanceStore.remainingAccepts === 1
    ? $t('dashboard.tutor.accepts.suffixOne')
    : $t('dashboard.tutor.accepts.suffix')
})

const statusClass = computed(() => {
  if (errorMessage.value) return 'dot--error'
  if (remainingAccepts.value === 0) return 'dot--danger'
  if (remainingAccepts.value <= 3) return 'dot--warning'
  return 'dot--ok'
})

const expiresText = computed(() => {
  if (!acceptanceStore.graceTokenExpiresAt) return ''
  return $t('dashboard.tutor.accepts.expires', {
    time: dayjs(acceptanceStore.graceTokenExpiresAt).fromNow()
  })
})

onMounted(async () => {
  if (!shouldShow.value) return
  try {
    await acceptanceStore.fetchAvailability()
  } catch (error) {
    // handled in store
  }
})
</script>

<style scoped>
.accept-availability {
  padding: 0.75rem 1rem;
  border: 1px dashed var(--border-subtle, #e5e7eb);
  border-radius: 999px;
  background: var(--surface-soft, #f9fafb);
  min-width: 220px;
}

.accept-availability__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.accept-availability__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted, #6b7280);
}

.accept-availability__value {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-body, #111827);
}

.suffix {
  font-size: 0.875rem;
  color: var(--text-muted, #6b7280);
}

.accept-availability__meta {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-muted, #6b7280);
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  display: inline-flex;
}

.dot--ok { background: #10b981; }
.dot--warning { background: #f59e0b; }
.dot--danger { background: #ef4444; }
.dot--error { background: #dc2626; }

.skeleton {
  width: 2rem;
  height: 1rem;
  border-radius: 0.25rem;
  background: linear-gradient(90deg, rgba(229,231,235,1) 25%, rgba(243,244,246,1) 50%, rgba(229,231,235,1) 75%);
  animation: shimmer 1.2s infinite;
}

@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}

.error-icon {
  color: #dc2626;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
