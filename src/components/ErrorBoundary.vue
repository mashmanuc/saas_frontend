<template>
  <div v-if="hasError" class="error-boundary">
    <AlertCircleIcon class="w-12 h-12 text-red-600" />
    <h2 class="error-title">{{ $t('errors.somethingWentWrong') }}</h2>
    <p class="error-message">{{ errorMessage }}</p>
    <Button variant="primary" @click="handleRetry">
      <template #iconLeft><RefreshCwIcon class="w-4 h-4" /></template>
      {{ $t('common.retry') }}
    </Button>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { AlertCircle as AlertCircleIcon, RefreshCw as RefreshCwIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

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
  color: var(--text-primary);
  margin: 0;
}

.error-message {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 500px;
  margin: 0;
}

</style>
