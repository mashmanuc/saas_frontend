<script setup lang="ts">
import { Award, Shield, Star, Zap, CheckCircle } from 'lucide-vue-next'
import type { Badge } from '../../api/marketplace'

interface Props {
  badge: Badge
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  showTooltip: false,
})

const iconMap: Record<string, typeof Award> = {
  verified: Shield,
  top_rated: Star,
  fast_response: Zap,
  experienced: Award,
  default: CheckCircle,
}

function getIcon() {
  return iconMap[props.badge.type] || iconMap.default
}

function getIconSize(): number {
  switch (props.size) {
    case 'sm':
      return 14
    case 'lg':
      return 20
    default:
      return 16
  }
}
</script>

<template>
  <div
    class="badge"
    :class="[`badge--${size}`, `badge--${badge.type}`]"
    :title="showTooltip ? badge.description : undefined"
  >
    <component :is="getIcon()" :size="getIconSize()" />
    <span v-if="size !== 'sm'" class="badge-name">{{ badge.name }}</span>
  </div>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--surface-card-muted);
  color: var(--text-secondary);
}

.badge--sm {
  padding: 0.25rem;
}

.badge--lg {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

.badge--verified {
  background: color-mix(in srgb, var(--info-bg) 16%, transparent);
  color: color-mix(in srgb, var(--info-bg) 72%, var(--text-primary));
}

.badge--top_rated {
  background: color-mix(in srgb, var(--warning-bg) 16%, transparent);
  color: color-mix(in srgb, var(--warning-bg) 72%, var(--text-primary));
}

.badge--fast_response {
  background: color-mix(in srgb, var(--success-bg) 16%, transparent);
  color: color-mix(in srgb, var(--success-bg) 72%, var(--text-primary));
}

.badge--experienced {
  background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
  color: var(--accent-primary);
}

.badge-name {
  white-space: nowrap;
}
</style>
