<template>
  <div v-if="hasError" class="error-boundary">
    <AlertCircleIcon class="w-12 h-12 text-red-600" />
    <h2 class="error-title">{{ $t('errors.somethingWentWrong') }}</h2>
    <p class="error-message">{{ errorMessage }}</p>
    <button @click="handleRetry" class="btn-primary">
      <RefreshCwIcon class="w-4 h-4" />
      {{ $t('common.retry') }}
    </button>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { AlertCircle as AlertCircleIcon, RefreshCw as RefreshCwIcon } from 'lucide-vue-next'

const hasError = ref(false)
const errorMessage = ref('')

onErrorCaptured((err) => {
  hasError.value = true
  errorMessage.value = err.message || 'Unknown error occurred'
  console.error('Error captured by ErrorBoundary:', err)
  
  // Prevent error from propagating
  return false
})

function handleRetry() {
  hasError.value = false
  errorMessage.value = ''
  window.location.reload()
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
  min-height: 400px;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.error-message {
  font-size: 14px;
  color: #6b7280;
  max-width: 500px;
  margin: 0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #2563eb;
}
</style>
