<template>
  <Card>
    <h2 class="text-lg font-semibold mb-3">{{ $t('dashboard.quickActions.title') }}</h2>
    <div class="quick-actions-grid">
      <router-link
        v-for="action in actions"
        :key="action.to + action.label"
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
import { Calendar, BookOpen, Users } from 'lucide-vue-next'
import Card from '@/ui/Card.vue'

const actions = [
  {
    label: 'dashboard.quickActions.createLesson',
    to: '/tutor/schedule',
    iconComponent: Calendar,
  },
  {
    label: 'dashboard.quickActions.openKnowledge',
    to: '/tutor/knowledge',
    iconComponent: BookOpen,
  },
  {
    label: 'dashboard.quickActions.myStudents',
    to: '/tutor/students',
    iconComponent: Users,
  },
]
</script>

<style scoped>
.quick-actions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm, 12px);
}

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
