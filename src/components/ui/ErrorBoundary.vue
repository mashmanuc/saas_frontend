<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="error-actions">
        <Button variant="primary" @click="retry">
          Retry
        </Button>
        <Button v-if="showReset" variant="secondary" @click="reset">
          Reset
        </Button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import Button from '@/ui/Button.vue'

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

</style>
