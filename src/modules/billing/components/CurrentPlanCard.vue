<template>
  <Card class="space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-lg font-semibold text-foreground">
          {{ $t('billing.currentPlanCard.title') }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ $t('billing.currentPlanCard.subtitle') }}
        </p>
      </div>
      <div
        v-if="subscription"
        class="rounded-full px-3 py-1 text-xs font-medium"
        :class="getStatusClass(subscription.status)"
      >
        {{ $t(`billing.status.${subscription.status}`) }}
      </div>
    </div>

    <div v-if="!subscription || subscription.status === 'none'" class="py-8 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <svg class="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
      <h3 class="mb-2 text-lg font-semibold text-foreground">
        {{ $t('billing.noPlanState.title') }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ $t('billing.noPlanState.subtitle') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <div class="rounded-lg border border-border bg-muted/30 p-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium text-muted-foreground">
            {{ $t('billing.currentPlanCard.planName') }}
          </span>
          <span class="text-lg font-bold text-foreground">
            {{ planCode }}
          </span>
        </div>
        
        <div v-if="subscription.current_period_end" class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            {{ subscription.cancel_at_period_end ? $t('billing.currentPlanCard.expiresAtLabel') : $t('billing.currentPlanCard.renewsAt') }}
          </span>
          <span class="font-medium text-foreground">
            {{ formatDate(subscription.current_period_end) }}
          </span>
        </div>

        <div v-if="subscription.provider" class="mt-2 flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            {{ $t('billing.currentPlanCard.providerLabel') }}
          </span>
          <span class="font-medium capitalize text-foreground">
            {{ subscription.provider }}
          </span>
        </div>
      </div>

      <div v-if="entitlement && entitlement.features && entitlement.features.length > 0" class="space-y-2">
        <h3 class="text-sm font-semibold text-foreground">
          {{ $t('billing.currentPlanCard.featuresTitle') }}
        </h3>
        <ul class="space-y-2">
          <li
            v-for="feature in entitlement.features"
            :key="feature"
            class="flex items-center gap-2 text-sm text-foreground"
          >
            <svg class="h-4 w-4 flex-shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ $t(`billing.features.${feature}`) }}</span>
          </li>
        </ul>
      </div>

      <div v-if="subscription.cancel_at_period_end" class="rounded-lg border border-warning bg-warning/10 p-3">
        <p class="text-sm text-warning-dark">
          {{ $t('billing.currentPlanCard.cancelScheduledWarning') }}
        </p>
      </div>

      <div v-if="subscription.status === 'active' && !subscription.cancel_at_period_end" class="pt-2">
        <Button
          variant="outline"
          size="sm"
          :loading="loading"
          :disabled="loading"
          @click="$emit('cancel')"
        >
          {{ $t('billing.currentPlanCard.cancelButton') }}
        </Button>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'

const props = defineProps({
  planCode: {
    type: String,
    required: true
  },
  subscription: {
    type: Object,
    default: null
  },
  entitlement: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['cancel'])

const { d } = useI18n()

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return d(date, 'short')
}

function getStatusClass(status) {
  const classes = {
    none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    active: 'bg-success-light text-success-dark',
    past_due: 'bg-danger-light text-danger',
    canceled: 'bg-warning-light text-warning-dark',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    incomplete: 'bg-warning-light text-warning-dark',
    trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    unpaid: 'bg-danger-light text-danger'
  }
  return classes[status] || classes.none
}
</script>
