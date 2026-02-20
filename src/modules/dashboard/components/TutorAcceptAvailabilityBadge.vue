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
  padding: var(--space-sm) var(--space-md);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  min-width: 220px;
}

.accept-availability__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.accept-availability__label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.accept-availability__value {
  display: flex;
  align-items: baseline;
  gap: var(--space-2xs);
}

.value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.suffix {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.accept-availability__meta {
  margin-top: var(--space-2xs);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  display: inline-flex;
}

.dot--ok { background: var(--success-bg); }
.dot--warning { background: var(--warning-bg); }
.dot--danger { background: var(--danger-bg); }
.dot--error { background: var(--danger-bg); }

.skeleton {
  width: 2rem;
  height: 1rem;
  border-radius: var(--radius-xs);
  background: linear-gradient(90deg, var(--border-color) 25%, var(--bg-secondary) 50%, var(--border-color) 75%);
  background-size: 400px 100%;
  animation: shimmer 1.2s infinite;
}

@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}

.error-icon {
  color: var(--danger-bg);
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
