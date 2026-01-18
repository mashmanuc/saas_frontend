<template>
  <div class="whiteboard-error-state" :class="`error-state--${errorType}`">
    <div class="error-state__icon">
      <svg v-if="errorType === 'auth'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>
      <svg v-else-if="errorType === 'permission'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
      </svg>
      <svg v-else-if="errorType === 'limit'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <svg v-else width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
      </svg>
    </div>

    <div class="error-state__content">
      <h3 class="error-state__title">{{ errorTitle }}</h3>
      <p class="error-state__message">{{ errorMessage }}</p>
    </div>

    <div class="error-state__actions">
      <button
        v-if="showRetry"
        class="btn btn-primary"
        @click="handleRetry"
      >
        {{ $t('common.retry') }}
      </button>
      <button
        v-if="showReload"
        class="btn btn-secondary"
        @click="handleReload"
      >
        {{ $t('common.reload') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  error: string | null
  onRetry?: () => void
}

const props = defineProps<Props>()
const emit = defineEmits<{
  retry: []
  reload: []
}>()

const errorType = computed(() => {
  if (!props.error) return 'unknown'
  
  if (props.error.includes('401') || props.error.includes('Session expired')) {
    return 'auth'
  }
  if (props.error.includes('403') || props.error.includes('Access denied')) {
    return 'permission'
  }
  if (props.error.includes('409') || props.error.includes('limit')) {
    return 'limit'
  }
  if (props.error.includes('413') || props.error.includes('payload_too_large')) {
    return 'payload'
  }
  if (props.error.includes('version_conflict')) {
    return 'conflict'
  }
  
  return 'network'
})

const errorTitle = computed(() => {
  switch (errorType.value) {
    case 'auth':
      return 'Session Expired'
    case 'permission':
      return 'Access Denied'
    case 'limit':
      return 'Page Limit Reached'
    case 'payload':
      return 'Content Too Large'
    case 'conflict':
      return 'Version Conflict'
    case 'network':
      return 'Connection Error'
    default:
      return 'Error'
  }
})

const errorMessage = computed(() => {
  switch (errorType.value) {
    case 'auth':
      return 'Your session has expired. Please reload the page to continue.'
    case 'permission':
      return 'You do not have permission to access this workspace.'
    case 'limit':
      return 'You have reached the maximum number of pages for your plan.'
    case 'payload':
      return 'The content is too large to save. Please reduce the number of strokes or assets.'
    case 'conflict':
      return 'The page was modified by another user. Your changes have been reloaded.'
    case 'network':
      return 'Unable to connect to the server. Please check your connection and try again.'
    default:
      return props.error || 'An unexpected error occurred.'
  }
})

const showRetry = computed(() => {
  return errorType.value === 'network' || errorType.value === 'unknown'
})

const showReload = computed(() => {
  return errorType.value === 'auth' || errorType.value === 'conflict'
})

function handleRetry() {
  emit('retry')
}

function handleReload() {
  window.location.reload()
}
</script>

<style scoped>
.whiteboard-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: 8px;
  min-height: 300px;
}

.error-state__icon {
  margin-bottom: 1.5rem;
  color: var(--color-error, #ef4444);
}

.error-state--auth .error-state__icon,
.error-state--permission .error-state__icon {
  color: var(--color-warning, #f59e0b);
}

.error-state--limit .error-state__icon {
  color: var(--color-info, #3b82f6);
}

.error-state__content {
  margin-bottom: 2rem;
  max-width: 400px;
}

.error-state__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--color-text-primary, #111827);
}

.error-state__message {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  line-height: 1.5;
}

.error-state__actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: white;
  color: var(--color-text-primary, #111827);
  border: 1px solid var(--color-border, #e5e7eb);
}

.btn-secondary:hover {
  background: var(--color-bg-hover, #f3f4f6);
}
</style>
