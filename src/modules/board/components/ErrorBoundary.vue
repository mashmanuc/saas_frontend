<script setup lang="ts">
// TASK FX4: Error Boundary for board module
import { ref, onErrorCaptured } from 'vue'
import { AlertCircle, RefreshCw } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()

const hasError = ref(false)
const errorMessage = ref('')
const errorStack = ref('')
const isDev = import.meta.env.DEV

onErrorCaptured((error: Error, instance, info) => {
  hasError.value = true
  errorMessage.value = error.message || 'An unexpected error occurred'
  errorStack.value = error.stack || ''

  // Log to error tracking service
  console.error('[ErrorBoundary]', {
    error,
    info,
    component: instance?.$options?.name || 'Unknown',
  })

  // Prevent error from propagating
  return false
})

function retry() {
  hasError.value = false
  errorMessage.value = ''
  errorStack.value = ''

  // Force re-render
  window.location.reload()
}

function goBack() {
  router.back()
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <AlertCircle class="error-icon" :size="64" />
      <h3>Something went wrong</h3>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <button class="btn btn-primary" @click="retry">
          <RefreshCw class="icon" :size="18" />
          Try Again
        </button>
        <button class="btn btn-secondary" @click="goBack">Go Back</button>
        <button class="btn btn-ghost" @click="goHome">Go Home</button>
      </div>
      <details v-if="isDev" class="error-details">
        <summary>Technical Details</summary>
        <pre>{{ errorStack }}</pre>
      </details>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background: #f5f5f5;
}

.error-content {
  max-width: 500px;
  text-align: center;
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.error-icon {
  color: #ef4444;
  margin-bottom: 1.5rem;
}

h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: #1f2937;
}

.error-message {
  color: #6b7280;
  margin: 0 0 1.5rem;
  font-size: 0.9375rem;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-ghost {
  background: transparent;
  color: #6b7280;
}

.btn-ghost:hover {
  background: #f3f4f6;
}

.error-details {
  margin-top: 2rem;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.error-details pre {
  background: #1f2937;
  color: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.75rem;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}
</style>
