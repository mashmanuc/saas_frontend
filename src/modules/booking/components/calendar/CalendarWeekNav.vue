<template>
  <div class="week-nav">
    <Button
      variant="ghost"
      iconOnly
      @click="prevWeek"
      :disabled="loading"
    >
      ←
    </Button>
    
    <div class="week-nav__info">
      <span class="week-nav__range">{{ weekRange }}</span>
      <Button
        v-if="!isCurrentWeek"
        variant="outline"
        size="sm"
        @click="goToToday"
        :disabled="loading"
      >
        Сьогодні
      </Button>
    </div>
    
    <Button
      variant="ghost"
      iconOnly
      @click="nextWeek"
      :disabled="loading"
    >
      →
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  weekStart: string
  weekEnd: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'change': [weekStart: string]
}>()

const weekRange = computed(() => {
  if (!props.weekStart) return ''
  const start = dayjs(props.weekStart)
  const end = props.weekEnd ? dayjs(props.weekEnd) : start.add(6, 'day')
  return `${start.format('DD.MM')} - ${end.format('DD.MM.YYYY')}`
})

const todayWeekStart = computed(() => {
  return dayjs().startOf('week').format('YYYY-MM-DD')
})

const isCurrentWeek = computed(() => {
  return props.weekStart === todayWeekStart.value
})

function prevWeek() {
  const newStart = dayjs(props.weekStart).subtract(1, 'week').format('YYYY-MM-DD')
  console.log('[CalendarWeekNav] prevWeek', { from: props.weekStart, to: newStart })
  emit('change', newStart)
}

function nextWeek() {
  const newStart = dayjs(props.weekStart).add(1, 'week').format('YYYY-MM-DD')
  console.log('[CalendarWeekNav] nextWeek', { from: props.weekStart, to: newStart })
  emit('change', newStart)
}

function goToToday() {
  console.log('[CalendarWeekNav] goToToday', { today: todayWeekStart.value })
  emit('change', todayWeekStart.value)
}
</script>

<style scoped>
.week-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 24px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
}

.week-nav__btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--bg-secondary);
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.week-nav__btn:hover:not(:disabled) {
  background: var(--bg-tertiary, #e5e7eb);
  transform: scale(1.05);
}

.week-nav__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.week-nav__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 180px;
}

.week-nav__range {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.week-nav__today {
  padding: 4px 12px;
  border-radius: 20px;
  border: none;
  background: var(--accent-bg, #dbeafe);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.week-nav__today:hover:not(:disabled) {
  background: var(--accent-bg-hover, #bfdbfe);
}

.week-nav__today:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
