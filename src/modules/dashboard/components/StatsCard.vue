<template>
  <component
    :is="to ? 'router-link' : 'div'"
    :to="to || undefined"
    class="stat-card"
    :class="{ 'stat-card--clickable': !!to }"
    role="article"
    :aria-label="`${label}: ${displayValue}`"
  >
    <div class="stat-icon">
      <component :is="iconComponent" :size="20" />
    </div>
    <div class="stat-content">
      <span class="stat-value">{{ displayValue }}</span>
      <span class="stat-label">{{ label }}</span>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Calendar,
  Users,
  Inbox,
  Wallet,
  BarChart3,
  BookOpen,
  Clock,
  Star,
} from 'lucide-vue-next'

const iconMap: Record<string, any> = {
  calendar: Calendar,
  users: Users,
  inbox: Inbox,
  wallet: Wallet,
  'bar-chart': BarChart3,
  'book-open': BookOpen,
  clock: Clock,
  star: Star,
}

interface Props {
  icon: string
  label: string
  value: number | string
  trend?: string
  to?: string
}

const props = withDefaults(defineProps<Props>(), {
  trend: undefined,
  to: undefined,
})

const iconComponent = computed(() => iconMap[props.icon] || BarChart3)

const displayValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-md, 12px);
  padding: var(--space-sm, 12px);
  background: var(--card-bg, var(--color-surface));
  border: 1px solid var(--border-color, var(--color-border-default));
  border-radius: var(--radius-xl, 16px);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s, border-color 0.15s;
}

/* Tablet+: larger padding */
@media (min-width: 768px) {
  .stat-card {
    padding: var(--space-md, 16px);
  }
}

.stat-card--clickable:hover {
  border-color: var(--accent, var(--color-accent));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent, #6366f1) 12%, transparent);
}

.stat-card--clickable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md, 12px);
  background: color-mix(in srgb, var(--accent, #6366f1) 10%, transparent);
  color: var(--accent, var(--color-accent));
  flex-shrink: 0;
}

.stat-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Mobile-first: smaller value text */
.stat-value {
  font-size: var(--text-xl, 1.25rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary, var(--color-text-body));
}

/* Tablet+: larger value text */
@media (min-width: 768px) {
  .stat-value {
    font-size: var(--text-2xl, 1.5rem);
  }
}

.stat-label {
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-secondary, var(--color-text-muted));
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>