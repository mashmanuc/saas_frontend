<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAvailabilityStore } from '../store/availabilityStore'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-vue-next'

const props = defineProps<{
  tutorSlug: string
}>()

const { t } = useI18n()
const availabilityStore = useAvailabilityStore()

const currentWeekStart = ref(getMonday(new Date()))
const selectedSlot = ref<{ start: string; end: string } | null>(null)
const timezone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone)

const availability = computed(() => availabilityStore.tutorAvailability[props.tutorSlug])
const slots = computed(() => availability.value?.slots || [])

const weekDays = computed(() => {
  const days = []
  const start = new Date(currentWeekStart.value)
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    days.push(date)
  }
  return days
})

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function previousWeek() {
  const date = new Date(currentWeekStart.value)
  date.setDate(date.getDate() - 7)
  currentWeekStart.value = getMonday(date)
  loadAvailability()
}

function nextWeek() {
  const date = new Date(currentWeekStart.value)
  date.setDate(date.getDate() + 7)
  currentWeekStart.value = getMonday(date)
  loadAvailability()
}

function getSlotsForDay(date: Date) {
  const dateStr = date.toISOString().split('T')[0]
  return slots.value.filter((slot: any) => slot.start.startsWith(dateStr))
}

function selectSlot(slot: any) {
  selectedSlot.value = slot
}

async function loadAvailability() {
  await availabilityStore.fetchTutorAvailability(props.tutorSlug, {
    week_start: currentWeekStart.value,
    timezone: timezone.value
  })
}

onMounted(() => {
  loadAvailability()
})
</script>

<template>
  <div class="availability-calendar">
    <div class="header">
      <button class="nav-btn" @click="previousWeek">
        <ChevronLeft :size="20" />
      </button>
      <h3>{{ t('calendar.weekOf', { date: currentWeekStart }) }}</h3>
      <button class="nav-btn" @click="nextWeek">
        <ChevronRight :size="20" />
      </button>
    </div>

    <div class="calendar-grid">
      <div v-for="day in weekDays" :key="day.toISOString()" class="day-column">
        <div class="day-header">
          <span class="day-name">{{ t(`common.weekdays.${day.toLocaleDateString('en', { weekday: 'long' }).toLowerCase()}`) }}</span>
          <span class="day-date">{{ day.getDate() }}</span>
        </div>

        <div class="slots">
          <div
            v-for="(slot, idx) in getSlotsForDay(day)"
            :key="idx"
            :class="['slot', { selected: selectedSlot === slot, available: slot.status === 'available' }]"
            @click="selectSlot(slot)"
          >
            {{ new Date(slot.start).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) }}
            -
            {{ new Date(slot.end).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) }}
          </div>

          <div v-if="getSlotsForDay(day).length === 0" class="no-slots">
            {{ t('calendar.noSlots') }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedSlot" class="selected-info">
      <Calendar :size="18" />
      <span>{{ t('calendar.selected') }}: {{ selectedSlot.start }} - {{ selectedSlot.end }}</span>
    </div>
  </div>
</template>

<style scoped>
.availability-calendar {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--surface-secondary);
  border: none;
  border-radius: var(--radius-sm, 6px);
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s;
}

.nav-btn:hover {
  background: var(--surface-hover);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.day-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-sm, 6px);
}

.day-name {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.day-date {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.slots {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.slot {
  padding: 0.5rem;
  background: var(--surface-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  font-size: 0.8125rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.slot.available {
  background: var(--success-bg, #d1fae5);
  border-color: var(--success, #10b981);
  color: var(--success, #10b981);
}

.slot.selected {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.slot:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-slots {
  padding: 1rem 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  text-align: center;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: var(--info-bg, #dbeafe);
  color: var(--info, #3b82f6);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
}
</style>
