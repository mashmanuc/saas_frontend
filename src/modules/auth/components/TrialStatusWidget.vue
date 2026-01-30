<template>
  <Card class="space-y-4">
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">{{ $t('auth.trial.status.title') }}</p>
      <p class="text-sm text-muted-foreground">{{ $t('auth.trial.status.subtitle') }}</p>
    </div>

    <div v-if="trialActive" class="space-y-4">
      <div class="rounded-lg border p-4" :class="statusClass">
        <div class="flex items-center gap-2 mb-2">
          <Clock :size="18" />
          <p class="text-sm font-medium">{{ statusTitle }}</p>
        </div>
        <p class="text-sm">{{ statusDescription }}</p>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-muted-foreground">{{ $t('auth.trial.status.daysRemaining') }}</span>
          <span class="font-medium">{{ daysLeft }}</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all"
            :class="progressClass"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>

      <Button variant="primary" class="w-full" @click="handleUpgrade">
        {{ $t('auth.trial.status.upgradeButton') }}
      </Button>
    </div>

    <div v-else class="space-y-4">
      <div class="rounded-lg border border-gray-300 bg-gray-50 p-4">
        <p class="text-sm font-medium text-gray-800">{{ $t('auth.trial.status.notActive') }}</p>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Clock } from 'lucide-vue-next'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  trialActive: boolean
  daysLeft: number
  totalDays: number
}>()

const { t } = useI18n()
const router = useRouter()

const progressPercent = computed(() => {
  if (props.totalDays === 0) return 0
  return Math.max(0, Math.min(100, (props.daysLeft / props.totalDays) * 100))
})

const isExpiringSoon = computed(() => props.daysLeft <= 3)

const statusClass = computed(() => {
  if (isExpiringSoon.value) {
    return 'border-warning-border bg-warning-bg text-warning'
  }
  return 'border-info-border bg-info-bg text-info'
})

const progressClass = computed(() => {
  if (isExpiringSoon.value) {
    return 'bg-warning'
  }
  return 'bg-info'
})

const statusTitle = computed(() => {
  if (props.daysLeft === 0) {
    return t('auth.trial.status.lastDay')
  }
  if (isExpiringSoon.value) {
    return t('auth.trial.status.expiringSoon')
  }
  return t('auth.trial.status.active')
})

const statusDescription = computed(() => {
  if (props.daysLeft === 0) {
    return t('auth.trial.status.lastDayDescription')
  }
  if (isExpiringSoon.value) {
    return t('auth.trial.status.expiringSoonDescription', { days: props.daysLeft })
  }
  return t('auth.trial.status.activeDescription', { days: props.daysLeft })
})

function handleUpgrade() {
  router.push('/billing/plans')
}
</script>
