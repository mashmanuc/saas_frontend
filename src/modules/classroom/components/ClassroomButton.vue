<template>
  <button
    :class="['classroom-btn', size, { disabled: !canJoin }]"
    :disabled="!canJoin"
    @click="handleClick"
  >
    <span v-if="isLoading" class="spinner"></span>
    <span v-else>{{ buttonText }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

interface Props {
  sessionId: string
  canJoin?: boolean
  scheduledAt?: string
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  canJoin: false,
  size: 'medium',
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

const router = useRouter()
const isLoading = ref(false)

// Computed
const buttonText = computed(() => {
  if (!props.canJoin) {
    if (props.scheduledAt) {
      const scheduled = new Date(props.scheduledAt)
      const now = new Date()
      const diffMs = scheduled.getTime() - now.getTime()
      const diffMinutes = Math.floor(diffMs / 60000)

      if (diffMinutes > 60) {
        const hours = Math.floor(diffMinutes / 60)
        const mins = diffMinutes % 60
        return `Через ${hours}г ${mins}хв`
      }
      if (diffMinutes > 0) {
        return `Через ${diffMinutes} хв`
      }
    }
    return 'Очікуємо'
  }
  return 'Увійти в урок'
})

// Methods
async function handleClick() {
  if (!props.canJoin || isLoading.value) return

  isLoading.value = true
  emit('click')

  try {
    await router.push(`/classroom/${props.sessionId}`)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.classroom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--primary-600, #2563eb);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.classroom-btn:hover:not(.disabled) {
  background: var(--primary-700, #1d4ed8);
}

.classroom-btn.disabled {
  background: var(--gray-300, #d1d5db);
  cursor: not-allowed;
}

.classroom-btn.small {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.classroom-btn.large {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
