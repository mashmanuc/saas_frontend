<template>
  <div class="empty-availability-state">
    <div class="empty-icon">
      <CalendarIcon :size="64" />
    </div>
    
    <h3 class="empty-title">
      {{ t('calendar.emptyState.noAvailability.title') }}
    </h3>
    
    <p class="empty-description">
      {{ t('calendar.emptyState.noAvailability.description') }}
    </p>
    
    <div class="empty-actions">
      <router-link
        v-if="false"
        to="/booking/availability"
        class="btn-primary"
      >
        {{ t('calendar.emptyState.noAvailability.action') }}
      </router-link>
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  min-height: 400px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 1.5rem;
  color: var(--color-text-tertiary, #9ca3af);
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--color-text-primary, #111827);
}

.empty-description {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  max-width: 400px;
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
  gap: 1rem;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #0ea5e9, #14b8a6);
  color: white;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  transition: opacity 0.2s, transform 0.2s;
  display: inline-block;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

/* Responsive */
@media (max-width: 768px) {
  .empty-availability-state {
    padding: 3rem 1.5rem;
  }
  
  .empty-title {
    font-size: 1.125rem;
  }
  
  .empty-description {
    font-size: 0.8125rem;
  }
}
</style>
