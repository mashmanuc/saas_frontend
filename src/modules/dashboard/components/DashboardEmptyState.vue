<template>
  <Card class="dashboard-empty-state">
    <component :is="iconComponent" :size="40" class="empty-icon" />
    <h3 class="empty-title">{{ title }}</h3>
    <p class="empty-description">{{ description }}</p>
    <router-link
      v-if="ctaTo && ctaLabel"
      :to="ctaTo"
      class="empty-cta"
    >
      {{ ctaLabel }}
      <ArrowRight :size="16" />
    </router-link>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRight,
  Search,
  Calendar,
  Users,
  BookOpen,
  Inbox,
} from 'lucide-vue-next'
import Card from '@/ui/Card.vue'

const props = defineProps<{
  title: string
  description: string
  ctaLabel?: string
  ctaTo?: string
  icon?: string
}>()

const ICON_MAP: Record<string, any> = {
  search: Search,
  calendar: Calendar,
  users: Users,
  'book-open': BookOpen,
  inbox: Inbox,
}

const iconComponent = computed(() => ICON_MAP[props.icon || ''] || Search)
</script>

<style scoped>
.dashboard-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-2xl, 32px) var(--space-lg, 24px);
  gap: var(--space-sm, 12px);
}

.empty-icon {
  color: var(--text-secondary, var(--color-text-muted));
  opacity: 0.4;
}

.empty-title {
  font-size: var(--text-lg, 1.125rem);
  font-weight: 600;
  color: var(--text-primary, var(--color-text-body));
}

.empty-description {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, var(--color-text-muted));
  max-width: 28rem;
}

.empty-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs, 8px);
  padding: var(--space-xs, 8px) var(--space-md, 16px);
  border-radius: var(--radius-xl, 12px);
  background: var(--accent, var(--color-accent));
  color: var(--accent-contrast, #fff);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.15s;
}

.empty-cta:hover {
  opacity: 0.85;
}

.empty-cta:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
