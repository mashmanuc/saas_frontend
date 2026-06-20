<template>
  <Card>
    <h2 class="text-lg font-semibold mb-3">{{ $t('dashboard.quickActions.title') }}</h2>
    <div class="quick-actions-grid">
      <router-link
        v-for="action in actions"
        :key="action.to"
        :to="action.to"
        class="quick-action-btn"
      >
        <component :is="action.iconComponent" :size="20" />
        <span>{{ $t(action.label) }}</span>
      </router-link>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Calendar, MessageSquare } from 'lucide-vue-next'
import Card from '@/ui/Card.vue'

// Marketplace Extraction: findTutor→/marketplace прибрано (BYO — учень не шукає тьютора
// в каталозі, тьютор запрошує його). Лишились розклад + повідомлення.
const actions = [
  {
    label: 'dashboard.quickActions.mySchedule',
    to: '/student/schedule',
    iconComponent: Calendar,
  },
  {
    label: 'dashboard.quickActions.messages',
    to: '/student/messages',
    iconComponent: MessageSquare,
  },
]
</script>

<style scoped>
/* Mobile-first: horizontal scroll */
.quick-actions-grid {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  gap: var(--space-sm, 8px);
  padding-bottom: 4px;
}

.quick-actions-grid::-webkit-scrollbar {
  height: 2px;
}

.quick-actions-grid::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

/* Tablet+: grid wrap */
@media (min-width: 768px) {
  .quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    overflow-x: visible;
    padding-bottom: 0;
  }
}

/* Mobile: fixed-width snap items with touch target */
.quick-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 8px);
  padding: var(--space-xs, 8px) var(--space-md, 16px);
  border-radius: var(--radius-xl, 12px);
  border: 1px solid var(--border-color, var(--color-border-default));
  background: var(--card-bg, var(--color-surface));
  color: var(--text-primary, var(--color-text-body));
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.15s, border-color 0.15s;
  flex-shrink: 0;
  scroll-snap-align: start;
  min-width: 120px;
  min-height: 44px;
}

/* Tablet+: auto width in grid */
@media (min-width: 768px) {
  .quick-action-btn {
    min-width: auto;
    flex-shrink: 1;
  }
}

.quick-action-btn:hover {
  background: var(--bg-secondary, var(--color-surface-soft));
  border-color: var(--accent, var(--color-accent));
}

.quick-action-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
