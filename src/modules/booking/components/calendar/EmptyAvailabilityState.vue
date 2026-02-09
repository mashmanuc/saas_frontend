<template>
  <div class="empty-availability-state">
    <div class="empty-content">
      <CalendarIcon :size="24" class="empty-icon" />
      <span class="empty-text">
        {{ t('calendar.emptyState.noAvailability.title') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Calendar as CalendarIcon } from 'lucide-vue-next'

const { t } = useI18n()
</script>

<style scoped>
.empty-availability-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  background: var(--color-surface-secondary, #f3f4f6);
  border-radius: 8px;
  border: 1px dashed var(--color-border, #d1d5db);
}

.empty-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.empty-icon {
  color: var(--color-text-tertiary, #9ca3af);
  flex-shrink: 0;
}

.empty-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

/* Responsive */
@media (max-width: 768px) {
  .empty-availability-state {
    padding: 0.625rem 0.875rem;
  }
  
  .empty-text {
    font-size: 0.8125rem;
  }
}
</style>
