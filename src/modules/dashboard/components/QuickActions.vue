<template>
  <Card>
    <h2 class="text-lg font-semibold mb-3">{{ $t('dashboard.quickActions.title') }}</h2>
    <div class="quick-actions-grid">
      <router-link
        v-for="action in visibleActions"
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
import { computed } from 'vue'
import { Calendar, BookOpen, Users, Search, BarChart3, PenTool } from 'lucide-vue-next'
import Card from '@/ui/Card.vue'

const props = defineProps<{
  lessonsCount?: number
}>()

const actions = [
  // P0-7: Primary CTA — create lesson on whiteboard
  {
    key: 'createBoardLesson',
    label: 'dashboard.quickActions.createBoardLesson',
    to: '/winterboard/boards',
    iconComponent: PenTool,
  },
  {
    key: 'createLesson',
    label: 'dashboard.quickActions.createLesson',
    to: '/tutor/schedule',
    iconComponent: Calendar,
  },
  {
    key: 'openKnowledge',
    label: 'dashboard.quickActions.openKnowledge',
    to: '/knowledge',
    iconComponent: BookOpen,
  },
  {
    key: 'myStudents',
    label: 'dashboard.quickActions.myStudents',
    to: '/tutor/students',
    iconComponent: Users,
  },
  {
    key: 'lessonCatalog',
    label: 'dashboard.quickActions.lessonCatalog',
    to: '/knowledge/catalog',
    iconComponent: Search,
  },
  {
    key: 'knowledgeAnalytics',
    label: 'dashboard.quickActions.knowledgeAnalytics',
    to: '/knowledge/analytics',
    iconComponent: BarChart3,
  },
]

// P0-7: Progressive QuickActions — 0→board only, <5→board+calendar, 5+→all
const visibleActions = computed(() => {
  const count = props.lessonsCount ?? Infinity
  if (count === 0) {
    return actions.filter(a => a.key === 'createBoardLesson')
  }
  if (count < 5) {
    return actions.filter(a => ['createBoardLesson', 'createLesson', 'lessonCatalog'].includes(a.key))
  }
  return actions
})
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
