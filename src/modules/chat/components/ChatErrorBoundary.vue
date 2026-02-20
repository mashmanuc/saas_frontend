<template>
  <div v-if="hasError" class="chat-error-boundary">
    <div class="error-content">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h3 class="error-title">{{ $t('chat.error.title') }}</h3>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <Button variant="primary" :disabled="isRetrying" :loading="isRetrying" @click="handleRetry">
          {{ $t('chat.error.retry') }}
        </Button>
        <Button variant="outline" @click="handleFallback">
          {{ $t('chat.error.usePolling') }}
        </Button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup>
import { ref, onErrorCaptured, provide, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'

const { t } = useI18n()

const hasError = ref(false)
const errorMessage = ref('')
const isRetrying = ref(false)
const errorCount = ref(0)
const MAX_RETRIES = 3

// Provide error boundary context for child components
provide('chatErrorBoundary', {
  reset: () => {
    hasError.value = false
    errorMessage.value = ''
    errorCount.value = 0
  }
})

onErrorCaptured((err, instance, info) => {
  errorCount.value++
  hasError.value = true
  
  // Categorize errors for better UX
  if (err.message?.includes('WebSocket') || err.message?.includes('websocket')) {
    errorMessage.value = t('chat.error.websocketFailed')
  } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
    errorMessage.value = t('chat.error.networkFailed')
  } else if (err.message?.includes('timeout')) {
    errorMessage.value = t('chat.error.timeout')
  } else {
    errorMessage.value = t('chat.error.generic')
  }
  
  // Log for debugging but don't crash
  console.error('[ChatErrorBoundary] Error captured:', {
    error: err.message,
    component: instance?.$options?.name || 'unknown',
    info,
    count: errorCount.value
  })
  
  // Track error metrics if telemetry available
  if (typeof window !== 'undefined' && window.telemetry) {
    window.telemetry.track('chat.error', {
      type: err.name,
      message: err.message,
      count: errorCount.value
    })
  }
  
  // Prevent error from propagating to parent
  return false
})

async function handleRetry() {
  if (errorCount.value >= MAX_RETRIES) {
    errorMessage.value = t('chat.error.maxRetries')
    return
  }
  
  isRetrying.value = true
  
  // Wait a bit before retry to allow network to recover
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  hasError.value = false
  errorMessage.value = ''
  isRetrying.value = false
}

function handleFallback() {
  // Emit event to parent to switch to polling mode
  emit('fallback')
}

const emit = defineEmits(['fallback'])
</script>

<style scoped>
.chat-error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: var(--space-lg);
  background: var(--danger-bg, rgba(254, 242, 242, 0.5));
  border-radius: var(--radius-lg);
  border: 1px solid var(--danger, rgba(252, 165, 165, 0.3));
}

.error-content {
  text-align: center;
  max-width: 400px;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: var(--danger, #ef4444);
  margin-bottom: var(--space-md);
}

.error-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-xs) 0;
}

.error-message {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-lg) 0;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
  flex-wrap: wrap;
}
</style>
