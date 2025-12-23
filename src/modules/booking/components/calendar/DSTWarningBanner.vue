<template>
  <div v-if="hasDSTTransition" class="dst-warning">
    <AlertTriangleIcon class="w-5 h-5" />
    <span>
      {{ $t('booking.dst.transitionWarning', { date: transitionDate }) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next'
import { isDSTTransitionDay, formatDateInTimezone } from '@/utils/timezone'

const props = defineProps<{
  weekStart: string
  timezone: string
}>()

const hasDSTTransition = computed(() => {
  const start = new Date(props.weekStart)
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    
    if (isDSTTransitionDay(date, props.timezone)) {
      return true
    }
  }
  
  return false
})

const transitionDate = computed(() => {
  const start = new Date(props.weekStart)
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    
    if (isDSTTransitionDay(date, props.timezone)) {
      return formatDateInTimezone(date.toISOString(), props.timezone)
    }
  }
  
  return ''
})
</script>

<style scoped>
.dst-warning {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  margin-bottom: 16px;
  color: #92400e;
  font-size: 14px;
}
</style>
