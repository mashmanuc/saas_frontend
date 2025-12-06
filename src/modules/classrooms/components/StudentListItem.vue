<template>
  <li
    class="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-muted/40 px-4 py-3"
  >
    <div class="flex items-center gap-3">
      <Avatar :text="displayName || email" size="sm" />
      <div class="flex flex-col">
        <span class="text-sm font-medium text-foreground">{{ displayName }}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ email }}</span>
      </div>
    </div>

    <Badge :variant="statusVariant">
      {{ statusLabel }}
    </Badge>
  </li>
</template>

<script setup>
import { computed } from 'vue'
import Avatar from '../../../ui/Avatar.vue'
import Badge from '../../../ui/Badge.vue'

const props = defineProps({
  student: {
    type: Object,
    required: true,
  },
})

const displayName = computed(() => {
  const s = props.student || {}
  const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
  return fullName || s.email || '—'
})

const email = computed(() => props.student?.email || '—')

const statusLabel = computed(() => props.student?.status || '—')

const statusVariant = computed(() => {
  const status = (props.student?.status || '').toLowerCase()
  if (status === 'active') return 'success'
  if (status === 'pending' || status === 'invited') return 'warning'
  return 'muted'
})
</script>
