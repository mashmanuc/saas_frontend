<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

interface Props {
  attempt?: number
  maxAttempts?: number
  canCancel?: boolean
}

withDefaults(defineProps<Props>(), {
  attempt: 1,
  maxAttempts: 5,
  canCancel: true,
})

const emit = defineEmits<{
  (e: 'cancel'): void
}>()
</script>

<template>
  <div class="reconnect-overlay">
    <div class="reconnect-content">
      <Loader2 class="spinner" :size="48" />
      <h3>Reconnecting...</h3>
      <p>Attempt {{ attempt }} of {{ maxAttempts }}</p>
      <p class="hint">Please check your internet connection</p>

      <button v-if="canCancel" class="cancel-btn" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.reconnect-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.reconnect-content {
  text-align: center;
  color: white;
}

.spinner {
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

h3 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

p {
  margin: 0.25rem 0;
  color: #9ca3af;
}

.hint {
  font-size: 0.875rem;
  margin-top: 1rem;
}

.cancel-btn {
  margin-top: 1.5rem;
  padding: 0.75rem 2rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
