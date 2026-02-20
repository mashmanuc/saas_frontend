<template>
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
      <Button
        variant="primary"
        size="sm"
        @click="handleMarkFreeTime"
        data-testid="mark-free-time-btn"
      >
        {{ t('calendar.header.mark_free_time') }}
      </Button>
      <Button
        variant="ghost"
        iconOnly
        @click="handleShowGuide"
        :aria-label="t('calendar.weekNavigation.showGuide')"
        title="Допомога"
      >
        <HelpCircleIcon class="w-5 h-5" />
      </Button>
    </div>
  </div>

  <div class="week-navigation">
    <Button
      variant="ghost"
      iconOnly
      @click="handleNavigate(-1)"
      :disabled="isLoading"
      :aria-label="t('calendar.weekNavigation.prevWeek')"
      data-testid="calendar-prev-week"
    >
      <ChevronLeftIcon class="w-5 h-5" />
    </Button>

    <div class="week-info">
      <span class="week-range">{{ weekRangeFormatted }}</span>
      <Button
        v-if="currentPage !== 0"
        variant="outline"
        size="sm"
        @click="handleToday"
      >
        {{ t('calendar.weekNavigation.today') }}
      </Button>
    </div>

    <Button
      variant="ghost"
      iconOnly
      @click="handleNavigate(1)"
      :disabled="isLoading"
      :aria-label="t('calendar.weekNavigation.nextWeek')"
      data-testid="calendar-next-week"
    >
      <ChevronRightIcon class="w-5 h-5" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  HelpCircle as HelpCircleIcon,
} from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

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
  'show-guide': []
  'mark-free-time': []
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

function handleShowGuide() {
  emit('show-guide')
}

function handleMarkFreeTime() {
  emit('mark-free-time')
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

.availability-status {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 10px 16px;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04));
  gap: 12px;
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--success);
}

.status-text--empty {
  color: var(--warning);
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
  background: var(--accent-bg, #e0f2fe);
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.scroll-available-btn:hover:not(:disabled) {
  background: var(--accent-bg-hover, #bae6fd);
}

.scroll-available-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-slot-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, transform 0.2s;
}

.create-slot-btn:hover {
  background: var(--accent-hover, #2563eb);
  transform: translateY(-1px);
}

.mark-free-time-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--success);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.mark-free-time-btn:hover {
  background: var(--success-hover, #45a049);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.edit-availability-btn {
  padding: 8px 16px;
  background: var(--success);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, transform 0.2s;
}

.edit-availability-btn:hover {
  background: var(--success-hover, #059669);
  transform: translateY(-1px);
}

.help-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.help-btn:hover {
  background: var(--bg-tertiary, #e5e7eb);
  color: var(--text-primary);
  transform: scale(1.05);
}
</style>
