<template>
  <div class="calendar-week-view-simple">
    <div v-if="isLoading" class="loading">
      <p>Завантаження календаря...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>Помилка: {{ error }}</p>
      <button @click="retry">Спробувати ще раз</button>
    </div>
    
    <div v-else class="calendar-content">
      <div class="calendar-header">
        <h2>Календар v0.55</h2>
        <p>Тиждень: {{ meta?.weekStart }} - {{ meta?.weekEnd }}</p>
      </div>
      
      <div class="calendar-stats">
        <div class="stat">
          <strong>Днів:</strong> {{ days.length }}
        </div>
        <div class="stat">
          <strong>Подій:</strong> {{ events.length }}
        </div>
        <div class="stat">
          <strong>Доступних слотів:</strong> {{ accessible.length }}
        </div>
        <div class="stat">
          <strong>Заблокованих діапазонів:</strong> {{ blockedRanges.length }}
        </div>
      </div>
      
      <div class="days-grid">
        <div v-for="day in daySummaries" :key="day.date" class="day-card">
          <div class="day-header">
            <strong>{{ formatDate(day.date) }}</strong>
            <span class="badge" :class="'badge-' + day.dayStatus">{{ day.dayStatus }}</span>
          </div>
          <div class="day-stats">
            <p>Події: {{ day.eventsCount }}</p>
            <p>Доступно хвилин: {{ day.availableMinutes }}</p>
            <p>{{ day.isPast ? 'Минулий день' : 'Майбутній день' }}</p>
          </div>
        </div>
      </div>
      
      <div v-if="events.length > 0" class="events-list">
        <h3>Події</h3>
        <div v-for="event in events" :key="event.id" class="event-card">
          <div class="event-header">
            <strong>Подія #{{ event.id }}</strong>
            <span class="badge" :class="'badge-' + event.status">{{ event.status }}</span>
          </div>
          <p>Студент: {{ event.student.name }}</p>
          <p>Час: {{ event.start }} - {{ event.end }}</p>
          <p v-if="event.is_first" class="first-lesson">🎉 Перший урок!</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { storeToRefs } from 'pinia'

const store = useCalendarWeekStore()
const authStore = useAuthStore()

const {
  days,
  events,
  accessible,
  blockedRanges,
  meta,
  daySummaries,
  isLoading,
  error
} = storeToRefs(store)

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })
}

async function retry() {
  if (authStore.user?.id) {
    const weekStart = new Date().toISOString().slice(0, 10)
    await store.fetchWeekSnapshot(authStore.user.id, weekStart)
  }
}

onMounted(async () => {
  console.log('[CalendarWeekViewSimple] Mounted')
  if (authStore.user?.id) {
    const weekStart = new Date().toISOString().slice(0, 10)
    console.log('[CalendarWeekViewSimple] Fetching snapshot for user:', authStore.user.id, 'week:', weekStart)
    try {
      await store.fetchWeekSnapshot(authStore.user.id, weekStart)
      console.log('[CalendarWeekViewSimple] Snapshot loaded successfully')
    } catch (err) {
      console.error('[CalendarWeekViewSimple] Failed to load snapshot:', err)
    }
  }
})
</script>

<style scoped>
.calendar-week-view-simple {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.loading, .error {
  padding: 40px;
  text-align: center;
}

.error {
  color: #dc2626;
}

.error button {
  margin-top: 16px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.calendar-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e5e7eb;
}

.calendar-header h2 {
  margin: 0 0 8px 0;
  color: #111827;
}

.calendar-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 8px;
}

.stat {
  flex: 1;
}

.stat strong {
  display: block;
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 4px;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.day-card {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.day-stats p {
  margin: 4px 0;
  font-size: 14px;
  color: #6b7280;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-working {
  background: #dcfce7;
  color: #166534;
}

.badge-partial {
  background: #fef3c7;
  color: #92400e;
}

.badge-day_off {
  background: #fee2e2;
  color: #991b1b;
}

.badge-scheduled {
  background: #dbeafe;
  color: #1e40af;
}

.badge-completed {
  background: #dcfce7;
  color: #166534;
}

.badge-no_show {
  background: #fee2e2;
  color: #991b1b;
}

.badge-cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.events-list {
  margin-top: 24px;
}

.events-list h3 {
  margin-bottom: 16px;
  color: #111827;
}

.event-card {
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-card p {
  margin: 4px 0;
  font-size: 14px;
  color: #6b7280;
}

.first-lesson {
  color: #ea580c !important;
  font-weight: 600;
}
</style>
