<template>
  <div class="week-navigation-simple">
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
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from 'lucide-vue-next'

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
  console.log('[WeekNavigationSimple] handleNavigate called', { direction, weekStart: props.weekStart })
  emit('navigate', direction)
  console.log('[WeekNavigationSimple] navigate event emitted')
}

function handleToday() {
  console.log('[WeekNavigationSimple] handleToday called')
  emit('today')
  console.log('[WeekNavigationSimple] today event emitted')
}
</script>

<style scoped>
.week-navigation-simple {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm, 0 4px 12px rgba(0, 0, 0, 0.05));
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: none;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--bg-tertiary, #e5e7eb);
  transform: translateY(-1px);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.week-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.week-range {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.today-btn {
  padding: 4px 12px;
  border-radius: 9999px;
  background: var(--accent-bg, #e0f2fe);
  color: var(--accent);
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.today-btn:hover {
  background: var(--accent-bg-hover, #bae6fd);
}
</style>
