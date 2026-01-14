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
              {{ billingStore.displayPlanCode }}
            </span>
          </div>
          
          <!-- v0.76.3: Show pending indicator if plan is pending -->
          <div v-if="billingStore.hasPendingPlan" class="mb-2 text-xs text-blue-600">
            {{ $t('billing.success.pendingActivation') }}
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

      <!-- FE-75.1: Recovery UI for auth errors -->
      <div v-else-if="authError" class="space-y-4">
        <div class="rounded-lg border border-warning bg-warning-light/20 p-4 text-sm">
          <p class="font-medium text-warning-dark">
            {{ $t('billing.success.sessionExpired') }}
          </p>
          <p class="mt-1 text-muted-foreground">
            {{ $t('billing.success.pleaseLogin') }}
          </p>
        </div>
        
        <Button
          variant="primary"
          class="w-full"
          @click="handleRecovery"
        >
          {{ $t('billing.success.loginAgain') }}
        </Button>
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
  const hasPending = billingStore.hasPendingPlan
  if (hasPending) {
    return t('billing.success.pendingMessage')
  }

  const planCode = billingStore.currentPlanCode
  if (planCode && planCode !== 'FREE') {
    return t('billing.success.activated')
  }

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

const authError = ref(false)
const pollingAttempts = ref(0)
const maxPollingAttempts = 10
const pollingTimeoutId = ref<number | null>(null)

async function handleRecovery() {
  // FE-75.1: Recovery scenario - logout and redirect to login
  const { useAuthStore } = await import('@/modules/auth/store/authStore')
  const authStore = useAuthStore()
  await authStore.logout()
  router.push({ 
    name: 'login', 
    query: { redirect: '/billing', message: 'session_expired' } 
  })
}

// FE-76.2.1: Poll /billing/me with status-aware logic (check plan_code)
async function pollStatus() {
  if (pollingAttempts.value >= maxPollingAttempts) {
    console.log('Polling stopped: max attempts reached')
    return
  }
  
  try {
    await billingStore.fetchMe()

    if (!billingStore.hasPendingPlan) {
      console.log('Pending cleared, stopping poll')
      const { notifySuccess } = await import('@/utils/notify')
      notifySuccess('Підписку активовано!')
      return
    }

    pollingAttempts.value++
    const delay = Math.min(pollingAttempts.value * 1000, 3000)
    pollingTimeoutId.value = window.setTimeout(pollStatus, delay)
  } catch (error) {
    console.error('Polling error:', error)
    // Stop polling on error
  }
}

onMounted(async () => {
  try {
    // FE-76.2.1: Single attempt to fetch billing data, no parallel spam
    await billingStore.fetchMe()
    
    if (billingStore.hasPendingPlan) {
      console.log('Pending exists, start polling for activation')
      pollingTimeoutId.value = window.setTimeout(pollStatus, 1000)
    } else {
      console.log('No pending, no polling needed')
    }
  } catch (error: any) {
    console.error('Failed to fetch billing data:', error)
    
    // FE-76.2.2: Handle 401 errors gracefully (no parallel refresh cycles)
    if (error?.response?.status === 401 || error?.code === 'auth_refresh_missing') {
      authError.value = true
      const { notifyWarning } = await import('@/utils/notify')
      notifyWarning('Сесія оновлюється. Будь ласка, увійдіть ще раз.')
    }
  } finally {
    isLoading.value = false
  }
})

// Cleanup polling on unmount
import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (pollingTimeoutId.value) {
    clearTimeout(pollingTimeoutId.value)
  }
})
</script>
