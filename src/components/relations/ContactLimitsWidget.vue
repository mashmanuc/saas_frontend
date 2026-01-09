<template>
  <Card v-if="limit" class="p-4">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold">{{ getLimitTitle(limitType) }}</h3>
      <Badge :variant="getBadgeVariant(limit)">
        {{ limit.remaining }} {{ t('limits.remaining') }}
      </Badge>
    </div>
    
    <!-- Progress Bar -->
    <div class="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
      <div
        class="absolute top-0 left-0 h-full transition-all duration-300"
        :class="getProgressBarColor(limit)"
        :style="{ width: `${getProgressPercentage(limit)}%` }"
      />
    </div>
    
    <div class="flex items-center justify-between text-xs text-muted">
      <span>{{ limit.current_count }} / {{ limit.max_count }}</span>
      <span>{{ t('limits.resetsAt') }}: {{ formatResetDate(limit.reset_at) }}</span>
    </div>
    
    <!-- Warning Alert -->
    <Alert v-if="limit.remaining <= 2 && limit.remaining > 0" variant="warning" class="mt-3">
      {{ t('limits.nearLimit', { remaining: limit.remaining }) }}
    </Alert>
    
    <Alert v-else-if="limit.remaining === 0" variant="error" class="mt-3">
      {{ t('limits.limitReached', { resetDate: formatResetDate(limit.reset_at) }) }}
    </Alert>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLimitsStore } from '@/stores/limitsStore'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Alert from '@/components/ui/Alert.vue'
import type { ContactLimit } from '@/types/relations'

interface Props {
  limitType: 'student_request' | 'tutor_accept'
}

const props = defineProps<Props>()
const { t } = useI18n()
const limitsStore = useLimitsStore()

const limit = computed(() => limitsStore.getLimitByType(props.limitType))

function getLimitTitle(type: string): string {
  return type === 'student_request'
    ? t('limits.studentRequests')
    : t('limits.tutorAccepts')
}

function getProgressPercentage(limit: ContactLimit): number {
  return (limit.current_count / limit.max_count) * 100
}

function getProgressBarColor(limit: ContactLimit): string {
  const percentage = getProgressPercentage(limit)
  if (percentage >= 90) return 'bg-red-500'
  if (percentage >= 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getBadgeVariant(limit: ContactLimit): 'success' | 'warning' | 'error' {
  if (limit.remaining === 0) return 'error'
  if (limit.remaining <= 2) return 'warning'
  return 'success'
}

function formatResetDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short'
  })
}
</script>
