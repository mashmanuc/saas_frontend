<template>
  <div class="tutor-availability-widget" :class="{ compact }">
    <div v-if="loading" class="loading-state">
      <Loader2 :size="20" class="animate-spin" />
      <span>{{ t('common.loading') }}</span>
    </div>

    <div v-else-if="error" class="error-state">
      <AlertCircle :size="20" />
      <span>{{ error }}</span>
    </div>

    <div v-else-if="summary" class="widget-content">
      <div v-if="compact" class="compact-view">
        <div class="next-available">
          <Calendar :size="16" />
          <div class="info">
            <span class="label">{{ t('marketplace.profile.nextAvailable') }}:</span>
            <span class="value">{{ formatNextAvailable(summary.next_available_slot) }}</span>
          </div>
        </div>
        <button @click="openDrawer" class="btn btn-sm btn-outline">
          {{ t('marketplace.profile.viewCalendar') }} →
        </button>
      </div>

      <div v-else class="full-view">
        <h4>{{ t('marketplace.profile.availabilityThisWeek') }}</h4>
        
        <div class="stats-row">
          <div class="stat-item">
            <Clock :size="16" />
            <span class="stat-value">{{ summary.weekly_hours }}h</span>
            <span class="stat-label">{{ t('marketplace.profile.weeklyHours') }}</span>
          </div>
          <div class="stat-item">
            <Calendar :size="16" />
            <span class="stat-value">{{ nextSlots.length }}</span>
            <span class="stat-label">{{ t('marketplace.profile.nextSlots') }}</span>
          </div>
        </div>

        <div class="next-slots-list">
          <div class="list-header">{{ t('marketplace.profile.upcomingSlots') }}</div>
          <div v-for="(slot, idx) in nextSlots" :key="idx" class="slot-item">
            <Calendar :size="14" />
            <span>{{ formatSlotTime(slot.start) }}</span>
          </div>
          <div v-if="nextSlots.length === 0" class="no-slots">
            {{ t('marketplace.profile.noUpcomingSlots') }}
          </div>
        </div>

        <button @click="openDrawer" class="btn btn-primary btn-block">
          {{ t('marketplace.profile.viewFullCalendar') }}
        </button>
      </div>
    </div>

    <div v-else class="empty-state">
      <CalendarX :size="32" />
      <p>{{ t('marketplace.profile.noAvailability') }}</p>
    </div>

    <!-- Calendar Drawer -->
    <Teleport to="body">
      <div v-if="showDrawer" class="drawer-overlay" @click="closeDrawer">
        <div class="drawer-container" @click.stop>
          <div class="drawer-header">
            <h3>{{ t('marketplace.profile.fullCalendar') }}</h3>
            <button @click="closeDrawer" class="close-button">
              <X :size="20" />
            </button>
          </div>
          <div class="drawer-body">
            <slot name="calendar" :close="closeDrawer">
              <p>{{ t('marketplace.profile.calendarPlaceholder') }}</p>
            </slot>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar, CalendarX, Loader2, AlertCircle, X, Clock } from 'lucide-vue-next'
import { availabilityApi } from '../../booking/api/availabilityApi'
import type { AvailabilitySummary, TutorAvailabilityFull } from '../../booking/api/availabilityApi'

interface Props {
  tutorSlug: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const emit = defineEmits<{
  'view-calendar': []
  'book-lesson': []
}>()

const { t } = useI18n()

const summary = ref<AvailabilitySummary | null>(null)
const fullData = ref<TutorAvailabilityFull | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const showDrawer = ref(false)
const nextSlots = ref<Array<{ start: string; end: string }>>([])

const weekDays = ref([
  { name: t('common.weekdays.monday'), slots: 0 },
  { name: t('common.weekdays.tuesday'), slots: 0 },
  { name: t('common.weekdays.wednesday'), slots: 0 },
  { name: t('common.weekdays.thursday'), slots: 0 },
  { name: t('common.weekdays.friday'), slots: 0 },
  { name: t('common.weekdays.saturday'), slots: 0 },
  { name: t('common.weekdays.sunday'), slots: 0 }
])

function formatNextAvailable(datetime: string | null): string {
  if (!datetime) return t('marketplace.profile.noSlotsAvailable')
  
  return formatRelativeTime(datetime)
}

function formatRelativeTime(datetime: string): string {
  const date = new Date(datetime)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMinutes < 60) {
    return t('marketplace.profile.inMinutes', { count: diffMinutes })
  }
  
  if (diffHours < 24) {
    return t('marketplace.profile.inHours', { count: diffHours })
  }
  
  if (diffDays === 0) {
    return t('marketplace.profile.today') + ', ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  if (diffDays === 1) {
    return t('marketplace.profile.tomorrow') + ', ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  if (diffDays < 7) {
    return t('marketplace.profile.inDays', { count: diffDays })
  }
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatSlotTime(datetime: string): string {
  const date = new Date(datetime)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function openDrawer(): void {
  showDrawer.value = true
}

function closeDrawer(): void {
  showDrawer.value = false
}

async function loadSummary(): Promise<void> {
  loading.value = true
  error.value = null
  
  try {
    summary.value = await availabilityApi.getTutorAvailabilitySummary(props.tutorSlug)
    
    const full = await availabilityApi.getTutorAvailabilityFull(props.tutorSlug)
    fullData.value = full
    
    nextSlots.value = full.slots
      .filter(s => s.status === 'available')
      .slice(0, 3)
      .map(s => ({ start: s.start_datetime, end: s.end_datetime }))
  } catch (err: any) {
    error.value = err.message || t('marketplace.profile.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSummary()
})
</script>

<style scoped>
.tutor-availability-widget {
  padding: 1.5rem;
  background-color: var(--surface);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
}

.tutor-availability-widget.compact {
  padding: 1rem;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-secondary);
}

.error-state {
  color: var(--error-text);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.compact-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.next-available {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: var(--surface-muted);
  border-radius: 0.5rem;
}

.next-available .info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.next-available .label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.next-available .value {
  font-weight: 600;
  font-size: 0.875rem;
}

.full-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.full-view h4 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.week-summary {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.day-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  background-color: var(--surface-muted);
  border-radius: 0.5rem;
  text-align: center;
}

.day-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.slots-count {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary);
}

.slots-label {
  font-size: 0.625rem;
  color: var(--text-muted);
}

.next-slot-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background-color: var(--primary-bg);
  border-radius: 0.5rem;
  border: 1px solid var(--primary);
  font-weight: 500;
}

.btn-block {
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

.empty-state p {
  margin: 0;
}

@media (max-width: 768px) {
  .week-summary {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 480px) {
  .week-summary {
    grid-template-columns: repeat(3, 1fr);
  }
}

.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 1000;
}

.drawer-container {
  background-color: var(--surface);
  width: 90%;
  max-width: 600px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.drawer-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: var(--text-secondary);
  border-radius: 0.375rem;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: var(--surface-muted);
}

.stats-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--surface-muted);
  border-radius: 0.5rem;
  gap: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

.next-slots-list {
  margin-bottom: 1.5rem;
}

.list-header {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.slot-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--surface-muted);
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.no-slots {
  padding: 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
