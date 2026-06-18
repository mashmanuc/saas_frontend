<template>
  <div class="tutor-calendar-wrapper">
    <!-- FTUE: First visit hint when no availability -->
    <OnboardingHint
      :hint-id="TutorHintId.CALENDAR_FIRST_VISIT"
      :condition="!hasAvailability"
      icon="💡"
    >
      {{ $t('onboarding.hints.calendar.firstVisit.text') }}
    </OnboardingHint>

    <CalendarWeekView />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CalendarWeekView from '@/modules/booking/components/calendar/CalendarWeekView.vue'
import OnboardingHint from '@/components/OnboardingHint.vue'
import { TutorHintId } from '@/composables/useOnboardingHints'
import { useScheduleDeepLink } from '@/modules/booking/composables/useScheduleDeepLink'

// Phase 1.5: deep-link ?booking={id} → scroll + highlight картки
useScheduleDeepLink()

// Default false = show hint immediately; hide only after API confirms has_availability=true
const hasAvailability = ref(false)

onMounted(async () => {
  // Marketplace Extraction 2026-06-18: `/v1/marketplace/me/` вимкнено (BYO) → раніше
  // 404 на кожен calendar-load. Hint некритичний — лишаємо дефолт (hasAvailability=false).
})
</script>

<style scoped>
/* Mobile-first: compact padding */
.tutor-calendar-wrapper {
  padding: 16px;
  min-height: calc(100vh - 64px);
  background: var(--bg-secondary);
}

/* Tablet+: generous padding */
@media (min-width: 768px) {
  .tutor-calendar-wrapper {
    padding: 24px;
  }
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
  border: 4px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}


.calendar-container {
  max-width: 1400px;
  margin: 0 auto;
}

.calendar-header {
  margin-bottom: 32px;
}

/* Mobile-first: smaller heading */
.calendar-header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

@media (min-width: 768px) {
  .calendar-header h1 {
    font-size: 32px;
  }
}

.week-info {
  display: flex;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 14px;
}

.calendar-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--card-bg);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Mobile-first: single column day cards */
.week-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Tablet: 3 columns */
@media (min-width: 768px) {
  .week-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
}

/* Desktop: full 7-day grid */
@media (min-width: 1024px) {
  .week-grid {
    grid-template-columns: repeat(7, 1fr);
  }
}

.day-column {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.day-column:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.day-column.is-today {
  border: 2px solid var(--accent);
}

.day-column.is-past {
  opacity: 0.6;
}

.day-header {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover, #764ba2) 100%);
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
  border-bottom: 1px solid var(--border-color);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
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
  border-left: 4px solid var(--accent);
  background: var(--bg-secondary);
  font-size: 13px;
}

.event-card.event-completed {
  border-left-color: var(--success);
  background: var(--success-bg, #f0fdf4);
}

.event-card.event-no_show {
  border-left-color: var(--danger);
  background: var(--danger-bg, #fef2f2);
}

.event-card.event-cancelled {
  border-left-color: var(--text-secondary);
  background: var(--bg-secondary);
}

.event-time {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.event-student {
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.first-lesson-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning-text, #92400e);
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
  color: var(--text-secondary);
  font-size: 13px;
}

.empty-icon {
  font-size: 32px;
}

</style>
