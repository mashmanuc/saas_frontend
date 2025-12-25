<template>
  <div class="availability-view">
    <div class="availability-view__header">
      <div>
        <p class="availability-view__eyebrow">{{ t('calendar.weekNavigation.availableHours') }}</p>
        <h1>{{ t('availability.editor.title') }}</h1>
        <p class="availability-view__subtitle">
          {{ t('availability.editor.subtitle', 'Налаштуйте базовий розклад та винятки') }}
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
.availability-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  min-height: 100%;
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
  color: #0ea5e9;
  margin-bottom: 4px;
}

.availability-view__header h1 {
  font-size: 1.75rem;
  margin: 0;
  color: #0f172a;
}

.availability-view__subtitle {
  margin: 8px 0 0;
  color: #475569;
}

.availability-view__card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  padding: 24px;
}

.availability-view__loader {
  padding: 32px;
  text-align: center;
  color: #475569;
}

@media (max-width: 768px) {
  .availability-view {
    padding: 16px;
  }

  .availability-view__card {
    padding: 16px;
  }
}
</style>
