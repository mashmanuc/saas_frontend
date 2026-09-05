<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">{{ $t('billing.page.title') }}</Heading>
          <p class="text-sm text-muted-foreground">{{ $t('billing.page.subtitle') }}</p>
        </div>
        <!-- 2026-07-28: кнопку «Назад» ПРИБРАНО. Вона вела на /dashboard/account —
             сторінку-СИРОТУ, на яку не веде НІЧОГО з навігації (сайдбар «Акаунт»
             веде на /settings). Юзер із сайдбару «Мій план» тиснув «Назад» і
             потрапляв у покинутий кут (де й була бита кнопка «Безпека»).
             Ця сторінка самостійна — вихід із неї = сайдбар або браузерне «назад». -->
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
      <!-- PR-1 (2026-09-04, інваріант 1): у картку йде ЛИШЕ entitlement —
           displayPlanCode підставляв pending-план як «поточний». Pending
           передаємо окремо, і картка сама показує його окремою плашкою. -->
      <CurrentPlanCard
        :plan-code="billingStore.currentPlanCode"
        :pending-plan-code="billingStore.pendingPlanCode"
        :sales-enabled="billingStore.salesEnabled"
        :subscription="billingStore.subscription"
        :entitlement="billingStore.entitlement"
        :loading="billingStore.isLoadingAction"
        @cancel="handleCancelSubscription"
      />

      <!-- PR-1 (2026-09-04): BILLING_SALES_ENABLED=False на сервері → вітрини
           немає взагалі, а не «планів не знайдено». Сервер той самий прапорець
           тримає на POST /checkout/, тож це не лише видимість. -->
      <Card v-if="!billingStore.salesEnabled" data-testid="sales-disabled-notice">
        <p class="text-sm text-muted-foreground">{{ $t('billing.plansList.salesDisabled') }}</p>
      </Card>
      <PlansList
        v-else
        :plans="billingStore.plans"
        :current-plan-code="billingStore.currentPlanCode"
        :pending-plan-code="billingStore.pendingPlanCode"
        :loading="billingStore.isLoadingPlans || billingStore.isLoadingAction"
        :error="plansError"
        @select="handleSelectPlan"
        @retry="retryPlans"
      />

      <!-- §5З Крок 3: історія платежів (замість заглушки «скоро буде») -->
      <Card>
        <PaymentHistorySection />
      </Card>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBillingStore } from '../stores/billingStore'
import Button from '@/ui/Button.vue'
import PaymentHistorySection from '../components/PaymentHistorySection.vue'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import CurrentPlanCard from '../components/CurrentPlanCard.vue'
import PlansList from '../components/PlansList.vue'
import { isSameTier } from '../utils/planCode'

const billingStore = useBillingStore()
const { t } = useI18n()

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

  // PR-1 (2026-09-04): другий бар'єр до інваріантів 1 і 3, незалежний від того,
  // яка картка емітила подію. Чинний план не потребує checkout (`free` з
  // каталогу проти `FREE` з entitlement — один план), а за pending-план інвойс
  // уже є — другого не створюємо.
  if (!billingStore.salesEnabled) {
    const { notifyError } = await import('@/utils/notify')
    notifyError(t('billing.errors.salesDisabled'))
    return
  }
  // Tier, не slug: PRO-USD при чинному PRO — той самий доступ (дзеркало
  // серверного 409 ALREADY_SUBSCRIBED_SAME_TIER).
  if (isSameTier(planCode, billingStore.currentPlanCode)) {
    return
  }
  if (isSameTier(planCode, billingStore.pendingPlanCode)) {
    const { notifyError } = await import('@/utils/notify')
    notifyError(t('billing.errors.pendingAlready'))
    return
  }

  try {
    await billingStore.startCheckout(planCode)
  } catch (error) {
    console.error('Checkout failed:', error)
    const { notifyError } = await import('@/utils/notify')
    const code = String(error?.code || '').toLowerCase()
    if (code === 'sales_disabled') {
      notifyError(t('billing.errors.salesDisabled'))
    } else if (code === 'already_subscribed_same_tier') {
      notifyError(t('billing.errors.sameTierAlready'))
    } else {
      notifyError(error?.message || 'Помилка при створенні checkout сесії')
    }
  }
}

// A7 (launch-план, 2026-09-01): скасування — лише для Stripe-підписок
// (CurrentPlanCard емітить 'cancel' тільки коли provider='stripe', canCancel).
// cancel_at_period_end=true — доступ триває до кінця оплаченого періоду,
// той самий вибір, що мала стара кнопка до видалення 2026-07-28.
async function handleCancelSubscription() {
  const { notifySuccess, notifyError } = await import('@/utils/notify')
  if (!window.confirm(t('billing.cancelConfirm'))) {
    return
  }
  try {
    await billingStore.cancel(true)
    notifySuccess(t('billing.cancelSuccess'))
  } catch (error) {
    console.error('Cancel subscription failed:', error)
    notifyError(error?.message || t('billing.cancelError'))
  }
}



// Auto-refresh billing status when user returns from payment tab
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && billingStore.me) {
    billingStore.fetchMe().catch(() => {})
  }
}

onMounted(async () => {
  loadData()
  document.addEventListener('visibilitychange', handleVisibilityChange)
  // Marketplace Extraction 2026-06-18: getTutorActivityStatus() прибрано (marketplace
  // activity-status → 404 без marketplace; dormant у BYO).
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>
