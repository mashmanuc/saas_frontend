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

@media (max-width: 640px) {
  .booking-actions {
    flex-direction: column;
  }

  :deep(.btn) {
    width: 100%;
  }
}
</style>
