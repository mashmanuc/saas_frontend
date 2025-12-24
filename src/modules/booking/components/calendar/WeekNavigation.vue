<template>
  <div class="week-navigation">
    <button
      @click="handleNavigate(-1)"
      :disabled="isLoading"
      class="nav-btn"
      :aria-label="t('calendar.weekNavigation.prevWeek')"
    >
      <ChevronLeftIcon class="w-5 h-5" />
    </button>

    <div class="week-info">
      <span class="week-range">{{ weekRangeFormatted }}</span>
      <button
        v-if="currentPage !== 0"
        @click="handleToday"
        class="today-btn"
      >
        {{ t('calendar.weekNavigation.today') }}
      </button>
    </div>

    <button
      @click="handleNavigate(1)"
      :disabled="isLoading"
      class="nav-btn"
      :aria-label="t('calendar.weekNavigation.nextWeek')"
    >
      <ChevronRightIcon class="w-5 h-5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{
  weekStart?: string
  weekEnd?: string
  currentPage: number
  isLoading: boolean
}>()

const emit = defineEmits<{
  navigate: [direction: -1 | 1]
  today: []
}>()

const weekRangeFormatted = computed(() => {
  if (!props.weekStart || !props.weekEnd) return ''
  
  const start = new Date(props.weekStart)
  const end = new Date(props.weekEnd)
  
  return `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`
})

function handleNavigate(direction: -1 | 1) {
  emit('navigate', direction)
}

function handleToday() {
  emit('today')
}
</script>

<style scoped>
.week-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.nav-btn {
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover:not(:disabled) {
  background-color: #f3f4f6;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.week-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.week-range {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.today-btn {
  padding: 6px 12px;
  background: #3b82f6;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  border: none;
  cursor: pointer;
}

.today-btn:hover {
  background: #2563eb;
}
</style>
