<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" :class="['toast', `toast-${type}`]">
        <CheckCircleIcon v-if="type === 'success'" class="w-5 h-5" />
        <AlertCircleIcon v-else-if="type === 'error'" class="w-5 h-5" />
        <InfoIcon v-else-if="type === 'info'" class="w-5 h-5" />
        <AlertTriangleIcon v-else-if="type === 'warning'" class="w-5 h-5" />
        
        <span class="toast-message">{{ message }}</span>
        
        <button @click="close" class="toast-close">
          <XIcon class="w-4 h-4" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { CheckCircle as CheckCircleIcon, AlertCircle as AlertCircleIcon, Info as InfoIcon, AlertTriangle as AlertTriangleIcon, X as XIcon } from 'lucide-vue-next'

const props = defineProps<{
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

let timeoutId: number | null = null

watch(() => props.visible, (newVisible) => {
  if (newVisible && props.duration) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = window.setTimeout(() => {
      close()
    }, props.duration)
  }
})

function close() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  emit('close')
}
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  max-width: 400px;
  min-width: 300px;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
}

.toast-close {
  flex-shrink: 0;
  padding: 4px;
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.toast-close:hover {
  opacity: 1;
}

.toast-success {
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #10b981;
}

.toast-error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
}

.toast-info {
  background-color: #dbeafe;
  color: #1e40af;
  border: 1px solid #3b82f6;
}

.toast-warning {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #f59e0b;
}

.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.2s ease-in;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}
</style>
