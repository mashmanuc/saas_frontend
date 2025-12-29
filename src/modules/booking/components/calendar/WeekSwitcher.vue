<template>
  <div class="week-switcher">
    <button 
      type="button"
      class="week-switcher__btn"
      @click="onPrev"
      :disabled="loading"
    >
      ‹
    </button>
    
    <div class="week-switcher__info">
      <span class="week-switcher__range">{{ displayRange }}</span>
      <button 
        v-if="!isCurrentWeek"
        type="button"
        class="week-switcher__today"
        @click="onToday"
        :disabled="loading"
      >
        Сьогодні
      </button>
    </div>
    
    <button 
      type="button"
      class="week-switcher__btn"
      @click="onNext"
      :disabled="loading"
    >
      ›
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{
  weekStart: string
  weekEnd: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'change': [weekStart: string]
}>()

const displayRange = computed(() => {
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

function onPrev() {
  const newStart = dayjs(props.weekStart).subtract(1, 'week').format('YYYY-MM-DD')
  console.log('[WeekSwitcher] onPrev', { current: props.weekStart, new: newStart })
  emit('change', newStart)
}

function onNext() {
  const newStart = dayjs(props.weekStart).add(1, 'week').format('YYYY-MM-DD')
  console.log('[WeekSwitcher] onNext', { current: props.weekStart, new: newStart })
  emit('change', newStart)
}

function onToday() {
  console.log('[WeekSwitcher] onToday', { todayWeekStart: todayWeekStart.value })
  emit('change', todayWeekStart.value)
}
</script>

<style scoped>
.week-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  margin-bottom: 16px;
}

.week-switcher__btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: #f3f4f6;
  font-size: 24px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.week-switcher__btn:hover:not(:disabled) {
  background: #e5e7eb;
  transform: scale(1.05);
}

.week-switcher__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.week-switcher__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 180px;
}

.week-switcher__range {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.week-switcher__today {
  padding: 6px 16px;
  border-radius: 20px;
  border: none;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.week-switcher__today:hover:not(:disabled) {
  background: #bfdbfe;
}

.week-switcher__today:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
