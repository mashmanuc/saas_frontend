<template>
  <div class="tutor-calendar-wrapper">
    <CalendarWeekView />
  </div>
</template>

<script setup lang="ts">
import CalendarWeekView from '@/modules/booking/components/calendar/CalendarWeekView.vue'
</script>

<style scoped>
.tutor-calendar-wrapper {
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: var(--surface-calendar, #f5f7fa);
}


.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-retry {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.btn-retry:hover {
  background: #2563eb;
}

.calendar-container {
  max-width: 1400px;
  margin: 0 auto;
}

.calendar-header {
  margin-bottom: 32px;
}

.calendar-header h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 700;
  color: #111827;
}

.week-info {
  display: flex;
  gap: 16px;
  color: #6b7280;
  font-size: 14px;
}

.calendar-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 16px;
}

.day-column {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.day-column:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.day-column.is-today {
  border: 2px solid #3b82f6;
}

.day-column.is-past {
  opacity: 0.6;
}

.day-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  text-align: center;
}

.day-name {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.day-date {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.day-status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255,255,255,0.2);
}

.day-body {
  padding: 16px;
}

.day-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;
}

.stat-icon {
  font-size: 16px;
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-card {
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
  background: #f0f9ff;
  font-size: 13px;
}

.event-card.event-completed {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.event-card.event-no_show {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.event-card.event-cancelled {
  border-left-color: #6b7280;
  background: #f9fafb;
}

.event-time {
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.event-student {
  color: #6b7280;
  margin-bottom: 4px;
}

.first-lesson-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.no-events {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #9ca3af;
  font-size: 13px;
}

.empty-icon {
  font-size: 32px;
}

@media (max-width: 768px) {
  .tutor-calendar-wrapper {
    padding: 16px;
  }
}
</style>
