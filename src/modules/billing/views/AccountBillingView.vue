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

    <!-- Візуальний огляд 2026-09-22 (п.10): dev-панель показувала на цій
         сторінці «Duplicate requests (1)». Перший кадр малювався ЩЕ ДО старту
         завантаження (`isLoading` = false, бо `loadData()` кличеться в
         `onMounted`), тож гілка з вмістом монтувалась, `PaymentHistorySection`
         слав `GET /billing/payments/`, потім store вмикав `isLoading` → гілка
         зникала → після завантаження монтувалась удруге і слала той самий
         запит ще раз. Скелет тримаємо до кінця ПЕРШОГО завантаження. -->
    <div v-if="showSkeleton" class="space-y-6">
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

    <!-- Продаж вимкнено і людині нема чого показувати про оплати — чесний
         екран раннього доступу замість «FREE + Без підписки + ліміти + порожня
         історія» (слово власника 2026-09-24). Умови — у `showEarlyAccess`. -->
    <EarlyAccessCard v-else-if="showEarlyAccess" />

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
import EarlyAccessCard from '../components/EarlyAccessCard.vue'
import { getPaymentHistory } from '../api/billingApi'
import { isSameTier } from '../utils/planCode'

const billingStore = useBillingStore()
const { t } = useI18n()

// Перше завантаження ще не завершилось → показуємо скелет, а не вміст
// (див. коментар у шаблоні: інакше вміст монтується двічі).
// Якщо store вже має дані (перехід назад на сторінку, попередній fetch) —
// показувати скелет нема чого.
const initialLoadDone = ref(false)
const showSkeleton = computed(
  () => billingStore.isLoading || (!initialLoadDone.value && !billingStore.me)
)

/**
 * Чи були в людини оплати. Історію тримає `PaymentHistorySection` у собі, а
 * рішення «ховати чи ні» приймається тут, тож питаємо коротко (одна позиція).
 * `null` = ще не знаємо; поки не знаємо — раннього доступу НЕ показуємо.
 */
const hadPayments = ref(null)

/**
 * Екран раннього доступу — лише коли ВСІ умови справдились разом:
 *   1. сервер справді відповів про плани (`plansAnswered`) і сказав
 *      `sales_enabled: false` — помилка чи очікування відповіді сюди не ведуть;
 *   2. у людини немає підписки й немає очікуваного платежу;
 *   3. entitlement = FREE;
 *   4. історія платежів порожня (і ми це вже знаємо).
 * Той, хто платив, бачить свій стан як раніше — просто без вітрини тарифів.
 */
const showEarlyAccess = computed(() =>
  billingStore.plansAnswered &&
  !billingStore.salesEnabled &&
  billingStore.isFree &&
  // ⚠️ Сервер віддає `subscription` ОБ'ЄКТОМ навіть без підписки:
  // `{status: 'none', plan_code: 'FREE', provider: 'none', …}` (звірено на
  // проді 2026-09-24). Перевірка «об'єкт є» ховала б екран від усіх.
  (billingStore.subscription?.status ?? 'none') === 'none' &&
  !billingStore.pendingPlanCode &&
  hadPayments.value === false
)

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
      billingStore.fetchPlans(),
      // Помилка тут не ховає нічого: `hadPayments` лишиться null, і сторінка
      // покаже звичайний вміст, а не ранній доступ (fail-closed).
      getPaymentHistory(1, 0)
        // Форма відповіді — `{results: [], count: 0}` (звірено на проді);
        // `total/items` лишаємо як запасні назви, щоб не залежати від однієї.
        .then((res) => {
          const count = res?.count ?? res?.total ?? res?.results?.length ?? res?.items?.length ?? 0
          hadPayments.value = count > 0
        })
        .catch(() => { hadPayments.value = null }),
    ])
  } catch (error) {
    console.error('Failed to load billing data:', error)
  } finally {
    initialLoadDone.value = true
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
