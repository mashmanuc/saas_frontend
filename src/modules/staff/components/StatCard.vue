<template>
  <component
    :is="to ? 'router-link' : 'div'"
    :to="to"
    class="stat-card"
    :class="{ clickable: !!to, [colorClass]: true }"
    data-testid="stat-card"
  >
    <div class="stat-icon" v-if="icon">{{ icon }}</div>
    <div class="stat-body">
      <div v-if="loading" class="stat-skeleton" />
      <div v-else class="stat-value">{{ formattedValue }}</div>
      <div class="stat-label">{{ label }}</div>
      <div v-if="trend != null && !loading" class="stat-trend" :class="trendClass">
        {{ trendPrefix }}{{ trend }}
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  icon?: string
  value?: number | string
  label: string
  trend?: number | string
  color?: 'default' | 'accent' | 'danger' | 'warning' | 'success'
  to?: string
  loading?: boolean
}>()

const colorClass = computed(() => `color-${props.color || 'default'}`)

const formattedValue = computed(() => {
  if (props.value == null) return '—'
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})

const trendClass = computed(() => {
  if (props.trend == null) return ''
  const n = typeof props.trend === 'number' ? props.trend : parseFloat(String(props.trend))
  if (isNaN(n)) return ''
  return n > 0 ? 'trend-up' : n < 0 ? 'trend-down' : ''
})

const trendPrefix = computed(() => {
  if (props.trend == null) return ''
  const n = typeof props.trend === 'number' ? props.trend : parseFloat(String(props.trend))
  return n > 0 ? '+' : ''
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: inherit;
  transition: all var(--transition-base);
}

.stat-card.clickable:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.stat-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
}

.color-accent .stat-icon { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.color-danger .stat-icon { background: color-mix(in srgb, var(--danger-bg, #ef4444) 12%, transparent); }
.color-warning .stat-icon { background: color-mix(in srgb, #eab308 12%, transparent); }
.color-success .stat-icon { background: color-mix(in srgb, #22c55e 12%, transparent); }

.stat-body {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.color-accent .stat-value { color: var(--accent); }
.color-danger .stat-value { color: var(--danger-bg, #ef4444); }

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: 2px;
}

.stat-trend {
  font-size: var(--text-xs);
  margin-top: var(--space-xs);
  font-weight: 600;
}

.trend-up { color: #22c55e; }
.trend-down { color: #ef4444; }

.stat-skeleton {
  height: 28px;
  width: 60px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
