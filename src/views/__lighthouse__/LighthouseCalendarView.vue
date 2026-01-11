<template>
  <div class="lighthouse-calendar-view">
    <div class="calendar-header">
      <h1>Calendar Preview</h1>
      <p>Lighthouse audit route - no authentication required</p>
    </div>
    
    <div class="calendar-grid">
      <div class="time-column">
        <div v-for="hour in hours" :key="hour" class="time-slot">
          {{ hour }}:00
        </div>
      </div>
      
      <div class="days-grid">
        <div v-for="day in days" :key="day.date" class="day-column">
          <div class="day-header">
            {{ day.label }}
          </div>
          <div class="day-slots">
            <div
              v-for="slot in 48"
              :key="slot"
              class="slot"
              :class="getSlotClass(day, slot)"
            />
          </div>
        </div>
      </div>
    </div>
    
    <div class="calendar-footer">
      <p>This is a static preview for Lighthouse performance testing</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const hours = Array.from({ length: 16 }, (_, i) => i + 6) // 6:00 - 22:00

const days = [
  { date: '2026-01-13', label: 'Mon', dow: 1 },
  { date: '2026-01-14', label: 'Tue', dow: 2 },
  { date: '2026-01-15', label: 'Wed', dow: 3 },
  { date: '2026-01-16', label: 'Thu', dow: 4 },
  { date: '2026-01-17', label: 'Fri', dow: 5 },
  { date: '2026-01-18', label: 'Sat', dow: 6 },
  { date: '2026-01-19', label: 'Sun', dow: 0 },
]

const getSlotClass = (day: any, slot: number) => {
  // Simulate some available slots
  if (day.dow >= 1 && day.dow <= 5 && slot >= 20 && slot <= 40) {
    return 'available'
  }
  return 'empty'
}
</script>

<style scoped>
.lighthouse-calendar-view {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.calendar-header {
  text-align: center;
  margin-bottom: 2rem;
}

.calendar-header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.calendar-header p {
  color: #666;
}

.calendar-grid {
  display: flex;
  gap: 1rem;
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.time-column {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 3rem;
}

.time-slot {
  height: 60px;
  font-size: 0.875rem;
  color: #666;
  padding: 0.5rem;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  flex: 1;
  background: #e5e7eb;
}

.day-column {
  background: white;
  display: flex;
  flex-direction: column;
}

.day-header {
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-bottom: 2px solid #e5e7eb;
}

.day-slots {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.slot {
  height: 30px;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}

.slot.empty {
  background: white;
}

.slot.available {
  background: #dbeafe;
}

.slot:hover {
  background: #f3f4f6;
}

.calendar-footer {
  text-align: center;
  margin-top: 2rem;
  color: #666;
  font-size: 0.875rem;
}
</style>
