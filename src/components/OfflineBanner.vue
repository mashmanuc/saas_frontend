<template>
  <Transition name="banner">
    <div v-if="show" class="offline-banner">
      <div class="banner-content">
        <div class="banner-icon">
          <WifiOff :size="20" />
        </div>
        <div class="banner-text">
          <p class="banner-title">{{ $t('common.offline.title') }}</p>
          <p class="banner-message">{{ $t('common.offline.message') }}</p>
          <p v-if="lastSyncTime" class="last-sync">
            {{ $t('common.offline.lastSync') }}: {{ formatTime(lastSyncTime) }}
          </p>
        </div>
        <button 
          v-if="canRetry" 
          type="button" 
          class="retry-btn" 
          :disabled="retrying"
          @click="handleRetry"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': retrying }" />
          {{ retrying ? $t('common.offline.retrying') : $t('common.offline.retry') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { WifiOff, RefreshCw } from 'lucide-vue-next'
import { trackEvent } from '@/utils/telemetryAgent'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  lastSyncTime: {
    type: Number,
    default: null,
  },
  onRetry: {
    type: Function,
    default: () => {},
  },
})

const { t } = useI18n()

const retrying = ref(false)
const canRetry = ref(true)
const isOnline = ref(navigator.onLine)

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return t('common.justNow')
  if (diff < 3600000) return t('common.minutesAgo', { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('common.hoursAgo', { count: Math.floor(diff / 3600000) })
  return t('common.daysAgo', { count: Math.floor(diff / 86400000) })
}

async function handleRetry() {
  if (retrying.value || !canRetry.value) return
  
  retrying.value = true
  
  try {
    await props.onRetry()
    trackEvent('offline.retry_success', {
      last_sync_time: props.lastSyncTime,
    })
  } catch (err) {
    console.error('Retry failed:', err)
    trackEvent('offline.retry_failed', {
      error: err?.message,
    })
  } finally {
    retrying.value = false
  }
}

function handleOnline() {
  isOnline.value = true
  if (props.show) {
    handleRetry()
  }
}

function handleOffline() {
  isOnline.value = false
  trackEvent('offline.detected', {
    last_sync_time: props.lastSyncTime,
  })
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    trackEvent('offline.banner_shown', {
      last_sync_time: props.lastSyncTime,
    })
  }
})

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<style scoped>
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9998;
  background: var(--warning-bg, #fef3c7);
  border-bottom: 2px solid var(--warning-border, #fcd34d);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.banner-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--warning, #f59e0b);
  color: white;
  border-radius: 50%;
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--warning-dark, #d97706);
  margin: 0 0 0.25rem 0;
}

.banner-message {
  font-size: 0.8125rem;
  color: var(--warning-dark, #d97706);
  margin: 0;
  opacity: 0.9;
}

.last-sync {
  font-size: 0.75rem;
  color: var(--warning-dark, #d97706);
  margin: 0.25rem 0 0 0;
  opacity: 0.8;
  font-style: italic;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--warning, #f59e0b);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.retry-btn:hover:not(:disabled) {
  background: var(--warning-dark, #d97706);
}

.retry-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.banner-enter-active,
.banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.banner-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
