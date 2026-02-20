<script setup lang="ts">
// F17: Booking Actions Component
import { X, RefreshCw, Video } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

defineProps<{
  canCancel: boolean
  canReschedule: boolean
  canJoin: boolean
}>()

defineEmits<{
  cancel: []
  reschedule: []
  join: []
}>()
</script>

<template>
  <div class="booking-actions">
    <!-- Join Lesson -->
    <Button
      v-if="canJoin"
      variant="primary"
      @click="$emit('join')"
    >
      <template #iconLeft>
        <Video :size="20" />
      </template>
      Join Lesson
    </Button>

    <!-- Reschedule -->
    <Button
      v-if="canReschedule"
      variant="outline"
      @click="$emit('reschedule')"
    >
      <template #iconLeft>
        <RefreshCw :size="18" />
      </template>
      Reschedule
    </Button>

    <!-- Cancel -->
    <Button
      v-if="canCancel"
      variant="danger"
      @click="$emit('cancel')"
    >
      <template #iconLeft>
        <X :size="18" />
      </template>
      Cancel Booking
    </Button>
  </div>
</template>

<style scoped>
.booking-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-large {
  padding: 14px 28px;
  font-size: 16px;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-danger-outline {
  background: none;
  border: 1px solid var(--color-danger, #ef4444);
  color: var(--color-danger, #ef4444);
}

.btn-danger-outline:hover {
  background: var(--color-danger, #ef4444);
  color: white;
}

@media (max-width: 640px) {
  .booking-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
