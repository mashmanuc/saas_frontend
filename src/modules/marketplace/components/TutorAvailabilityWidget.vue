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
        
        <div class="week-summary">
          <div v-for="(day, index) in weekDays" :key="index" class="day-summary">
            <span class="day-name">{{ day.name }}</span>
            <span class="slots-count">{{ day.slots }}</span>
            <span class="slots-label">{{ t('calendar.slots') }}</span>
          </div>
        </div>

        <div class="next-slot-info">
          <Calendar :size="16" />
          <span>{{ t('marketplace.profile.nextAvailable') }}: {{ formatNextAvailable(summary.next_available_slot) }}</span>
        </div>

        <button @click="$emit('book-lesson')" class="btn btn-primary btn-block">
          {{ t('booking.bookLesson') }}
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
import { Calendar, CalendarX, Loader2, AlertCircle, X } from 'lucide-vue-next'
import { availabilityApi } from '../../booking/api/availabilityApi'
import type { AvailabilitySummary } from '../../booking/api/availabilityApi'

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
const loading = ref(false)
const error = ref<string | null>(null)
const showDrawer = ref(false)

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
  
  // Less than 1 hour
  if (diffMinutes < 60) {
    return t('marketplace.profile.inMinutes', { count: diffMinutes })
  }
  
  // Less than 24 hours
  if (diffHours < 24) {
    return t('marketplace.profile.inHours', { count: diffHours })
  }
  
  // Today
  if (diffDays === 0) {
    return t('marketplace.profile.today') + ', ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Tomorrow
  if (diffDays === 1) {
    return t('marketplace.profile.tomorrow') + ', ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // This week (next 7 days)
  if (diffDays < 7) {
    return t('marketplace.profile.inDays', { count: diffDays })
  }
  
  // Default format
  return date.toLocaleDateString(undefined, {
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
</style>
