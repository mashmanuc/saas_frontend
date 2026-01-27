<template>
  <div v-if="shouldShow" class="rounded-lg border p-4 mb-6" :class="bannerClass" data-test="activity-status-banner">
    <div class="flex items-start gap-3">
      <div class="text-2xl">{{ statusIcon }}</div>
      <div class="flex-1">
        <h3 class="font-semibold text-sm mb-1">{{ statusTitle }}</h3>
        <p class="text-sm text-muted">{{ statusMessage }}</p>
        <div v-if="exemptionInfo" class="mt-2 text-xs text-muted">
          <span class="font-medium">{{ $t('tutor.activity.exemption.active') }}:</span>
          {{ exemptionInfo }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  activityStatus?: 'ACTIVE' | 'INACTIVE_SOFT'
  activityReason?: string
  reactionsCount?: number
  exemptionUntil?: string | null
  exemptionReason?: string | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const shouldShow = computed(() => {
  // Show banner only if tutor is subject to activity rules
  return props.activityReason !== 'NOT_APPLICABLE' && props.activityReason !== 'TRIAL_ACTIVE'
})

const userFriendlyStatus = computed(() => {
  if (props.activityReason === 'EXEMPTED') return 'EXEMPTED'
  if (props.activityReason === 'NO_REACTIONS_THIS_MONTH') return 'AT_RISK'
  if (props.activityStatus === 'INACTIVE_SOFT') return 'INACTIVE'
  if (props.activityStatus === 'ACTIVE') return 'ACTIVE'
  return 'ACTIVE'
})

const statusIcon = computed(() => {
  switch (userFriendlyStatus.value) {
    case 'ACTIVE': return '✅'
    case 'INACTIVE': return '⚠️'
    case 'EXEMPTED': return '🛡️'
    case 'AT_RISK': return '⏰'
    default: return 'ℹ️'
  }
})

const bannerClass = computed(() => {
  switch (userFriendlyStatus.value) {
    case 'ACTIVE': return 'bg-green-50 border-green-200'
    case 'INACTIVE': return 'bg-yellow-50 border-yellow-200'
    case 'EXEMPTED': return 'bg-purple-50 border-purple-200'
    case 'AT_RISK': return 'bg-orange-50 border-orange-200'
    default: return 'bg-gray-50 border-gray-200'
  }
})

const statusTitle = computed(() => {
  switch (userFriendlyStatus.value) {
    case 'ACTIVE': return t('tutor.activity.banner.active.title')
    case 'INACTIVE': return t('tutor.activity.banner.inactive.title')
    case 'EXEMPTED': return t('tutor.activity.banner.exempted.title')
    case 'AT_RISK': return t('tutor.activity.banner.atRisk.title')
    default: return ''
  }
})

const statusMessage = computed(() => {
  switch (userFriendlyStatus.value) {
    case 'ACTIVE':
      return t('tutor.activity.banner.active.message', { count: props.reactionsCount || 0 })
    case 'INACTIVE':
      return t('tutor.activity.banner.inactive.message')
    case 'EXEMPTED':
      return t('tutor.activity.banner.exempted.message')
    case 'AT_RISK':
      return t('tutor.activity.banner.atRisk.message')
    default:
      return ''
  }
})

const exemptionInfo = computed(() => {
  if (userFriendlyStatus.value !== 'EXEMPTED' || !props.exemptionUntil) return null
  
  const until = new Date(props.exemptionUntil).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const reason = props.exemptionReason || t('tutor.activity.exemption.noReason')
  
  return t('tutor.activity.exemption.info', { until, reason })
})
</script>
