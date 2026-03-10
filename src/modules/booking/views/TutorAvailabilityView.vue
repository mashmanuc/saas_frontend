<template>
  <div class="availability-view">
    <div class="availability-view__header">
      <div>
        <p class="availability-view__eyebrow">{{ t('calendar.weekNavigation.availableHours') }}</p>
        <h1>{{ t('calendar.editor.title') }}</h1>
        <p class="availability-view__subtitle">
          {{ t('calendar.editor.subtitle', 'Налаштуйте базовий розклад та винятки') }}
        </p>
      </div>
    </div>

    <div class="availability-view__card">
      <Suspense>
        <template #default>
          <AvailabilityEditor />
        </template>
        <template #fallback>
          <div class="availability-view__loader">{{ t('loader.loading') }}</div>
        </template>
      </Suspense>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AvailabilityEditor from '@/modules/booking/components/availability/AvailabilityEditor.vue'

const { t } = useI18n()
</script>

<style scoped>
/* Mobile-first: compact padding */
.availability-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  min-height: 100%;
}

/* Tablet+: generous spacing */
@media (min-width: 768px) {
  .availability-view {
    gap: 24px;
    padding: 24px;
  }
}

.availability-view__header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.availability-view__eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 4px;
}

/* Mobile-first: smaller heading */
.availability-view__header h1 {
  font-size: 1.375rem;
  margin: 0;
  color: var(--text-primary);
}

@media (min-width: 768px) {
  .availability-view__header h1 {
    font-size: 1.75rem;
  }
}

.availability-view__subtitle {
  margin: 8px 0 0;
  color: var(--text-secondary);
}

/* Mobile-first: compact card padding */
.availability-view__card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 16px;
}

@media (min-width: 768px) {
  .availability-view__card {
    padding: 24px;
  }
}

.availability-view__loader {
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
}

</style>
