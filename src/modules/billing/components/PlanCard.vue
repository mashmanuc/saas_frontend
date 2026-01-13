<template>
  <Card
    class="relative flex h-full flex-col transition-all hover:shadow-md"
    :class="{ 'border-primary ring-2 ring-primary/20': isCurrentPlan }"
  >
    <div v-if="isCurrentPlan" class="absolute right-4 top-4">
      <div class="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
        {{ $t('billing.plan.current') }}
      </div>
    </div>
    
    <div v-else-if="isPro" class="absolute right-4 top-4">
      <div class="rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
        {{ $t('billing.plan.recommended') }}
      </div>
    </div>
    
    <div v-else-if="isBusiness" class="absolute right-4 top-4">
      <div class="rounded-full bg-purple-500 px-3 py-1 text-xs font-medium text-white">
        {{ $t('billing.plan.bestForTeams') }}
      </div>
    </div>

    <div class="flex-1 space-y-4 p-6">
      <div>
        <h3 class="text-xl font-bold text-foreground">{{ plan.title }}</h3>
        <div class="mt-2 flex items-baseline gap-1">
          <span class="text-3xl font-bold text-foreground">
            {{ formatMoney(plan.price.amount, plan.price.currency) }}
          </span>
          <span v-if="plan.interval" class="text-sm text-muted-foreground">
            / {{ plan.interval === 'monthly' ? $t('billing.planCard.intervalMonthly') : $t('billing.planCard.intervalYearly') }}
          </span>
        </div>
      </div>

      <div v-if="plan.features && plan.features.length > 0" class="space-y-2">
        <ul class="space-y-2">
          <li
            v-for="feature in plan.features"
            :key="feature"
            class="flex items-start gap-2 text-sm text-foreground"
          >
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ $t(`billing.features.${feature}`) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-border p-6 pt-4">
      <Button
        v-if="isCurrentPlan"
        variant="outline"
        class="w-full"
        disabled
      >
        {{ $t('billing.planCard.current') }}
      </Button>
      <Button
        v-else-if="isInactive"
        variant="outline"
        class="w-full"
        disabled
      >
        {{ $t('billing.planCard.unavailable') }}
      </Button>
      <Button
        v-else-if="isFree"
        variant="outline"
        class="w-full"
        :loading="loading"
        :disabled="loading"
        @click="$emit('select', plan.code)"
      >
        {{ $t('billing.planCard.select') }}
      </Button>
      <Button
        v-else
        variant="primary"
        class="w-full"
        :loading="loading"
        :disabled="loading"
        @click="$emit('select', plan.code)"
      >
        {{ $t('billing.planCard.pay') }}
      </Button>
    </div>
  </Card>
</template>

<script setup>
import { computed } from 'vue'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { formatMoney } from '../utils/priceFormatter'

const props = defineProps({
  plan: {
    type: Object,
    required: true
  },
  currentPlanCode: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select'])

const isCurrentPlan = computed(() => {
  return props.plan.code === props.currentPlanCode
})

const isInactive = computed(() => {
  return props.plan.is_active === false
})

const isFree = computed(() => {
  return props.plan.code?.toUpperCase() === 'FREE' || props.plan.price?.amount === 0
})

const isPro = computed(() => {
  return props.plan.code?.toUpperCase() === 'PRO'
})

const isBusiness = computed(() => {
  return props.plan.code?.toUpperCase() === 'BUSINESS'
})
</script>
