<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="error-actions">
        <button @click="retry" class="btn btn-primary">
          Retry
        </button>
        <button v-if="showReset" @click="reset" class="btn btn-secondary">
          Reset
        </button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

interface Props {
  title?: string
  message?: string
  showReset?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again.',
  showReset: false,
})

const emit = defineEmits<{
  retry: []
  reset: []
}>()

const hasError = ref(false)
const errorDetails = ref<Error | null>(null)

onErrorCaptured((err: Error) => {
  hasError.value = true
  errorDetails.value = err
  console.error('[ErrorBoundary]', err)
  return false
})

function retry() {
  hasError.value = false
  errorDetails.value = null
  emit('retry')
}

function reset() {
  hasError.value = false
  errorDetails.value = null
  emit('reset')
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 24px;
}

.error-content {
  text-align: center;
  max-width: 400px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-content h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text-primary, #111827);
}

.error-content p {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  margin-bottom: 24px;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}
</style>
