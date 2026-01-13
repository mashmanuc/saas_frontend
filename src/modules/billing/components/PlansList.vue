<template>
  <Card class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-foreground">
        {{ $t('billing.plansList.title') }}
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ $t('billing.plansList.subtitle') }}
      </p>
    </div>

    <div v-if="loading && plans.length === 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-64 animate-pulse rounded-lg bg-muted"></div>
    </div>

    <div v-else-if="error" class="space-y-4">
      <Card class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <div class="space-y-2">
          <p class="font-semibold">{{ $t('billing.errors.plansLoadFailed') }}</p>
          <p>{{ error.message }}</p>
        </div>
      </Card>
      <Button variant="primary" size="sm" @click="$emit('retry')">
        {{ $t('billing.retryButton') }}
      </Button>
    </div>

    <div v-else-if="plans.length === 0" class="py-8 text-center">
      <p class="text-sm text-muted-foreground">
        {{ $t('billing.plansList.empty') }}
      </p>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <PlanCard
        v-for="plan in sortedPlans"
        :key="plan.code"
        :plan="plan"
        :current-plan-code="currentPlanCode"
        :loading="loading"
        @select="$emit('select', $event)"
      />
    </div>
  </Card>
</template>

<script setup>
import { computed } from 'vue'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import PlanCard from './PlanCard.vue'

const props = defineProps({
  plans: {
    type: Array,
    required: true
  },
  currentPlanCode: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: Object,
    default: null
  }
})

defineEmits(['select', 'retry'])

const sortedPlans = computed(() => {
  return [...props.plans].sort((a, b) => {
    return (a.sort_order || 0) - (b.sort_order || 0)
  })
})
</script>
