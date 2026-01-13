<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">{{ $t('billing.page.title') }}</Heading>
          <p class="text-sm text-muted-foreground">{{ $t('billing.page.subtitle') }}</p>
        </div>
        <Button variant="outline" size="sm" @click="goBack">
          {{ $t('common.back') }}
        </Button>
      </div>
    </Card>

    <div v-if="billingStore.isLoading" class="space-y-6">
      <Card class="space-y-4">
        <div class="h-6 w-48 animate-pulse rounded bg-muted"></div>
        <div class="h-4 w-full animate-pulse rounded bg-muted"></div>
        <div class="h-4 w-3/4 animate-pulse rounded bg-muted"></div>
      </Card>
      <Card class="space-y-4">
        <div class="h-6 w-48 animate-pulse rounded bg-muted"></div>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div v-for="i in 3" :key="i" class="h-64 animate-pulse rounded-lg bg-muted"></div>
        </div>
      </Card>
    </div>

    <div v-else-if="billingStore.lastError && !billingStore.me" class="space-y-4">
      <Card class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <div class="space-y-2">
          <p class="font-semibold">{{ $t('billing.errors.loadFailed') }}</p>
          <p>{{ billingStore.lastError.message }}</p>
        </div>
      </Card>
      <Button variant="primary" @click="retry">
        {{ $t('billing.retryButton') }}
      </Button>
    </div>

    <div v-else class="space-y-6">
      <CurrentPlanCard
        :plan-code="billingStore.currentPlanCode"
        :subscription="billingStore.subscription"
        :entitlement="billingStore.entitlement"
        :loading="billingStore.isLoadingAction"
        @cancel="handleCancel"
      />

      <PlansList
        :plans="billingStore.plans"
        :current-plan-code="billingStore.currentPlanCode"
        :loading="billingStore.isLoadingPlans || billingStore.isLoadingAction"
        :error="plansError"
        @select="handleSelectPlan"
        @retry="retryPlans"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBillingStore } from '../stores/billingStore'
import Button from '@/ui/Button.vue'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import CurrentPlanCard from '../components/CurrentPlanCard.vue'
import PlansList from '../components/PlansList.vue'

const router = useRouter()
const billingStore = useBillingStore()

const plansError = computed(() => {
  if (billingStore.lastError && billingStore.plans.length === 0) {
    return billingStore.lastError
  }
  return null
})

async function loadData() {
  try {
    await Promise.all([
      billingStore.fetchMe(),
      billingStore.fetchPlans()
    ])
  } catch (error) {
    console.error('Failed to load billing data:', error)
  }
}

async function retry() {
  await loadData()
}

async function retryPlans() {
  try {
    await billingStore.fetchPlans()
  } catch (error) {
    console.error('Failed to load plans:', error)
  }
}

async function handleSelectPlan(planCode) {
  if (!planCode) {
    const { notifyError } = await import('@/utils/notify')
    notifyError('Неможливо оплатити: plan code відсутній')
    return
  }
  
  try {
    await billingStore.startCheckout(planCode)
  } catch (error) {
    console.error('Checkout failed:', error)
    const { notifyError } = await import('@/utils/notify')
    notifyError(error?.message || 'Помилка при створенні checkout сесії')
  }
}

async function handleCancel() {
  if (!confirm('Are you sure you want to cancel your subscription?')) {
    return
  }
  
  try {
    await billingStore.cancel(true)
    await billingStore.fetchMe()
  } catch (error) {
    console.error('Cancel failed:', error)
  }
}

function goBack() {
  router.push({ name: 'user-account' })
}

onMounted(() => {
  loadData()
})
</script>
