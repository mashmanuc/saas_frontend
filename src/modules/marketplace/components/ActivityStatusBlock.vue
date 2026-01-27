<template>
  <Card v-if="status" class="space-y-3" data-test="activity-status-block">
    <!-- CASE D: Staff Exemption -->
    <div
      v-if="status.has_exemption || status.is_exempt"
      class="flex items-start gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-4"
      data-test="activity-exempt"
    >
      <div class="flex-shrink-0 text-2xl">🟣</div>
      <div class="flex-1 space-y-1">
        <p class="font-semibold text-body">
          {{ $t('tutor.activity.exempt.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('tutor.activity.exempt.description') }}
        </p>
      </div>
    </div>

    <!-- CASE A: No Requirement -->
    <div
      v-else-if="!status.activity_required"
      class="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4"
      data-test="activity-not-required"
    >
      <div class="flex-shrink-0 text-2xl">✅</div>
      <div class="flex-1 space-y-1">
        <p class="font-semibold text-body">
          {{ $t('tutor.activity.notRequired.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ getNotRequiredReason() }}
        </p>
      </div>
    </div>

    <!-- CASE C: Requirement Met -->
    <div
      v-else-if="status.meets_requirement"
      class="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4"
      data-test="activity-met"
    >
      <div class="flex-shrink-0 text-2xl">✅</div>
      <div class="flex-1 space-y-1">
        <p class="font-semibold text-body">
          {{ $t('tutor.activity.met.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('tutor.activity.met.count', { current: status.activity_count, required: status.required_count }) }}
        </p>
      </div>
    </div>

    <!-- CASE B: Requirement Not Met -->
    <div
      v-else
      class="flex items-start gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4"
      data-test="activity-not-met"
    >
      <div class="flex-shrink-0 text-2xl">⚠️</div>
      <div class="flex-1 space-y-2">
        <p class="font-semibold text-body">
          {{ $t('tutor.activity.notMet.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('tutor.activity.notMet.description') }}
        </p>
        <p class="text-sm font-medium text-body">
          {{ $t('tutor.activity.notMet.count', { current: status.activity_count, required: status.required_count }) }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('tutor.activity.notMet.hint') }}
        </p>
      </div>
    </div>

    <!-- Month info (always show) -->
    <div class="text-xs text-muted">
      {{ $t('tutor.activity.currentMonth') }}: {{ status.current_month }}
    </div>
  </Card>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Card from '../../../ui/Card.vue'

const props = defineProps({
  status: {
    type: Object,
    required: true,
  },
})

const { t } = useI18n()

function getNotRequiredReason() {
  if (props.status.is_trial) {
    return t('tutor.activity.notRequired.trial')
  }
  if (props.status.plan !== 'FREE') {
    return t('tutor.activity.notRequired.paidPlan')
  }
  return t('tutor.activity.notRequired.notPublished')
}
</script>
