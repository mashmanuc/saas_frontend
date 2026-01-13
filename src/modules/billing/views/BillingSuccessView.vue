<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <Card class="w-full max-w-md space-y-6">
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
          <svg class="h-8 w-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <Heading :level="1" class="mb-2">
          {{ $t('billing.success.title') }}
        </Heading>
        
        <p class="text-sm text-muted-foreground">
          {{ statusMessage }}
        </p>
      </div>

      <div v-if="billingStore.me" class="space-y-4">
        <div class="rounded-lg border border-border bg-muted/30 p-4">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground">
              {{ $t('billing.currentPlanCard.planName') }}
            </span>
            <span class="text-lg font-bold text-foreground">
              {{ billingStore.currentPlanCode }}
            </span>
          </div>
          
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">
              {{ $t('billing.success.status') }}
            </span>
            <span 
              class="rounded-full px-2 py-1 text-xs font-medium"
              :class="getStatusClass(billingStore.subscription?.status)"
            >
              {{ $t(`billing.statuses.${billingStore.subscription?.status || 'none'}`) }}
            </span>
          </div>
        </div>

        <div class="space-y-2">
          <Button
            variant="primary"
            class="w-full"
            @click="goToBilling"
          >
            {{ $t('billing.success.viewBilling') }}
          </Button>
          
          <Button
            variant="outline"
            class="w-full"
            @click="goToDashboard"
          >
            {{ $t('billing.success.backToDashboard') }}
          </Button>
        </div>
      </div>

      <div v-else-if="isLoading" class="space-y-4">
        <div class="h-20 animate-pulse rounded-lg bg-muted"></div>
        <div class="h-10 animate-pulse rounded bg-muted"></div>
        <div class="h-10 animate-pulse rounded bg-muted"></div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBillingStore } from '../stores/billingStore'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Heading from '@/ui/Heading.vue'

const router = useRouter()
const { t } = useI18n()
const billingStore = useBillingStore()
const isLoading = ref(true)

const statusMessage = computed(() => {
  const status = billingStore.subscription?.status
  
  if (!status || status === 'none') {
    return t('billing.success.processing')
  }
  
  if (status === 'active') {
    return t('billing.success.activated')
  }
  
  if (status === 'incomplete' || status === 'trialing') {
    return t('billing.success.processing')
  }
  
  return t('billing.success.checkStatus')
})

function getStatusClass(status: string | undefined): string {
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
  return classes[status as keyof typeof classes] || classes.none
}

function goToBilling() {
  router.push({ name: 'account-billing' })
}

function goToDashboard() {
  router.push('/')
}

onMounted(async () => {
  try {
    await Promise.all([
      billingStore.fetchMe(),
      billingStore.fetchPlans()
    ])
  } catch (error) {
    console.error('Failed to fetch billing data:', error)
  } finally {
    isLoading.value = false
  }
})
</script>
