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

  <div class="availability-status">
    <div class="status-text" :class="{ 'status-text--empty': !hasAvailability }">
      <span v-if="hasAvailability">
        {{ t('calendar.weekNavigation.availableHours', { hours: formattedHours }) }}
      </span>
      <span v-else>
        {{ t('calendar.weekNavigation.noAvailability') }}
      </span>
    </div>
    <div class="actions">
      <button
        class="scroll-available-btn"
        :disabled="!hasAvailability || isLoading"
        @click="handleScrollToAvailable"
      >
        <NavigationIcon class="w-4 h-4" />
        <span>{{ t('calendar.weekNavigation.goToFirstAvailable') }}</span>
      </button>
      <button
        class="edit-availability-btn"
        @click="handleOpenAvailability"
      >
        {{ t('calendar.weekNavigation.setupAvailability') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Navigation as NavigationIcon,
} from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{
  weekStart?: string
  weekEnd?: string
  currentPage: number
  isLoading: boolean
  totalAvailableHours?: number | null
  hasAvailability?: boolean
}>()

const emit = defineEmits<{
  navigate: [direction: -1 | 1]
  today: []
  scrollFirstAvailable: []
  openAvailability: []
}>()

const weekRangeFormatted = computed(() => {
  if (!props.weekStart || !props.weekEnd) return ''

  const start = new Date(props.weekStart)
  const end = new Date(props.weekEnd)

  return `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`
})

const formattedHours = computed(() => {
  if (typeof props.totalAvailableHours !== 'number') return '0'
  const rounded = Math.round(props.totalAvailableHours * 10) / 10
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
})

function handleNavigate(direction: -1 | 1) {
  emit('navigate', direction)
}

function handleToday() {
  emit('today')
}

function handleScrollToAvailable() {
  if (!props.hasAvailability) return
  emit('scrollFirstAvailable')
}

function handleOpenAvailability() {
  emit('openAvailability')
}

const hasAvailability = computed(() => Boolean(props.hasAvailability))
</script>

<style scoped>
.week-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f3f4f6;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: #e5e7eb;
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
  color: #111827;
}

.today-btn {
  padding: 4px 12px;
  border-radius: 9999px;
  background: #e0f2fe;
  color: #0369a1;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.today-btn:hover {
  background: #bae6fd;
}

.availability-status {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border-radius: 12px;
  padding: 10px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  gap: 12px;
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: #065f46;
}

.status-text--empty {
  color: #b45309;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.scroll-available-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: #e0f2fe;
  color: #0369a1;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.scroll-available-btn:hover:not(:disabled) {
  background: #bae6fd;
}

.scroll-available-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-availability-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #10b981;
  background: #ecfdf5;
  color: #047857;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.edit-availability-btn:hover {
  background: #d1fae5;
  border-color: #059669;
}
</style>
