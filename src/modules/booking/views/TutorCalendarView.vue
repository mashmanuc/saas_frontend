<template>
  <div class="tutor-calendar-wrapper">
    <CalendarWeekView />
  </div>
</template>

<script setup lang="ts">
import CalendarWeekView from '@/modules/booking/components/calendar/CalendarWeekView.vue'
</script>

<style scoped>
.tutor-calendar-wrapper {
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: var(--surface-calendar, #f5f7fa);
}

@media (max-width: 768px) {
  .tutor-calendar-wrapper {
    padding: 16px;
  }
}
</style>
