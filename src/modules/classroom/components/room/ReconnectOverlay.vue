<template>
  <div class="reconnect-overlay">
    <div class="reconnect-content">
      <div class="reconnect-icon">
        <WifiOff class="w-16 h-16 text-yellow-500" />
      </div>

      <h2 class="reconnect-title">З'єднання втрачено</h2>

      <p class="reconnect-message">
        Спроба перепідключення {{ attempt }} з {{ maxAttempts }}...
      </p>

      <div class="reconnect-progress">
        <div class="progress-bar" :style="{ width: `${progress}%` }" />
      </div>

      <div v-if="countdown > 0" class="reconnect-countdown">
        Наступна спроба через {{ countdown }} сек.
      </div>

      <div class="reconnect-actions">
        <Button variant="primary" @click="$emit('retry')">
          <template #iconLeft><RefreshCw class="w-4 h-4" /></template>
          Спробувати зараз
        </Button>
        <Button variant="outline" @click="$emit('leave')">
          <template #iconLeft><LogOut class="w-4 h-4" /></template>
          Вийти
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WifiOff, RefreshCw, LogOut } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

interface Props {
  attempt: number
  maxAttempts?: number
  countdown?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxAttempts: 5,
  countdown: 0,
})

defineEmits<{
  (e: 'retry'): void
  (e: 'leave'): void
}>()

const progress = computed(() => (props.attempt / props.maxAttempts) * 100)
</script>

<script lang="ts">
import { computed } from 'vue'
</script>

<style scoped>
.reconnect-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.reconnect-content {
  text-align: center;
  padding: 48px;
  background: var(--bg-primary, #1f2937);
  border-radius: 16px;
  max-width: 400px;
}

.reconnect-icon {
  margin-bottom: 24px;
}

.reconnect-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
  margin: 0 0 12px;
}

.reconnect-message {
  color: var(--text-secondary);
  margin: 0 0 24px;
}

.reconnect-progress {
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.reconnect-countdown {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.reconnect-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

</style>
