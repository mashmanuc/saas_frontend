<template>
  <Card v-if="shouldShow" class="space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h3 class="font-semibold text-foreground">
          {{ $t('users.profile.completeness.title') }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ $t('users.profile.completeness.description') }}
        </p>
      </div>
      <div class="text-2xl font-bold text-primary">
        {{ completeness.percentage }}%
      </div>
    </div>

    <div class="space-y-2">
      <div class="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="progressBarClass"
          :style="{ width: `${completeness.percentage}%` }"
        />
      </div>
      <p class="text-xs text-muted-foreground">
        {{ $t('users.profile.completeness.progress', { 
          filled: completeness.filledFields.length, 
          total: completeness.totalFields 
        }) }}
      </p>
    </div>

    <div v-if="completeness.missingFields.length > 0" class="space-y-2">
      <p class="text-sm font-medium text-foreground">
        {{ $t('users.profile.completeness.missingFields') }}
      </p>
      <ul class="space-y-1">
        <li
          v-for="field in completeness.missingFields"
          :key="field"
          class="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span>{{ field }}</span>
        </li>
      </ul>
      <Button
        variant="outline"
        size="sm"
        class="mt-3"
        @click="$emit('complete')"
      >
        {{ $t('users.profile.completeness.completeNow') }}
      </Button>
    </div>

    <div v-else class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
      <span class="text-lg">✓</span>
      <span>{{ $t('users.profile.completeness.complete') }}</span>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import type { ProfileCompletenessResult } from '@/composables/useProfileCompleteness'

const props = defineProps<{
  completeness: ProfileCompletenessResult
  isTutor?: boolean
}>()

defineEmits<{
  'complete': []
}>()

const shouldShow = computed(() => {
  return props.isTutor && props.completeness.percentage < 100
})

const progressBarClass = computed(() => {
  const percentage = props.completeness.percentage
  if (percentage >= 80) return 'bg-green-500'
  if (percentage >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
})
</script>
