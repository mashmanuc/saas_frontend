<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock } from 'lucide-vue-next'
import type { BadgeHistoryItem } from '../../api/marketplace'

interface Props {
  history?: BadgeHistoryItem[]
}

const props = withDefaults(defineProps<Props>(), {
  history: () => []
})

const { t } = useI18n()

const items = computed(() => props.history || [])

function formatDateTime(value: string): string {
  if (!value) return '-'
  try {
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return value
    return dt.toLocaleString()
  } catch {
    return value
  }
}
</script>

<template>
  <section class="badge-history">
    <h3>
      <Clock :size="18" />
      {{ t('marketplace.profile.badgesHistory.title') }}
    </h3>

    <p v-if="items.length === 0" class="text-sm text-muted-foreground">
      {{ t('marketplace.profile.badgesHistory.empty') }}
    </p>

    <div v-else class="space-y-3">
      <div v-for="(it, idx) in items" :key="idx" class="rounded-lg border p-3">
        <p class="text-sm font-medium text-foreground">
          {{ it.badge?.name || it.badge?.type || it.badge || t('marketplace.profile.badgesHistory.unknownBadge') }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ formatDateTime(it.created_at) }}
        </p>
        <p v-if="it.reason" class="mt-2 text-sm text-muted-foreground">
          {{ it.reason }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.badge-history {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font: var(--font-subtitle);
  margin: 0 0 1rem;
  color: var(--text-primary);
}
</style>
