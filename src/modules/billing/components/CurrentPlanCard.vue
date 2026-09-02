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
        {{ $t(`billing.statuses.${subscription.status || 'none'}`) }}
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
      <!-- Sprint 2 §4.3: inline soft upgrade hint (presentation-only, не блокує). -->
      <div class="mt-3">
        <UpgradeHint context="feature" variant="standalone" />
      </div>
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
        <p
          v-if="hasPending"
          class="text-xs text-muted-foreground"
        >
          {{ $t('billing.currentlyActive') }}: {{ activePlanCode }}
        </p>
        
        <div v-if="subscription.current_period_end" class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            <!-- 2026-07-28: завжди «Діє до». «Продовжується» БРЕХАЛО: Plata/mono
                 не має автопродовження — кожен платіж це разовий інвойс, гроші
                 вдруге не спишуться, тож «продовження» не буває. -->
            {{ $t('billing.currentPlanCard.validUntil') }}
          </span>
          <span class="font-medium text-foreground">
            {{ formatDate(subscription.current_period_end) }}
          </span>
        </div>

        <!-- Ф1-1 (2026-07-27): BE віддає РЯДОК 'none' коли підписки нема —
           truthy-рядок проходив v-if і юзер бачив технічне «None». -->
        <div v-if="subscription.provider && subscription.provider !== 'none'" class="mt-2 flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            {{ $t('billing.currentPlanCard.providerLabel') }}
          </span>
          <span class="font-medium capitalize text-foreground">
            {{ subscription.provider }}
          </span>
        </div>
      </div>

      <!-- 2026-07-28 (скарга власника: «під планом ніхера не пише, що
           надається»): картка називала план і мовчала про те, за що людина
           заплатила. Показуємо РЕЗОЛВЛЕНІ ліміти з BE (entitlement.limits) —
           ті самі, за якими система реально пускає чи блокує. Не беремо їх зі
           списку тарифів: чинний план може бути знятий з продажу (Business),
           і тоді у списку його вже нема. -->
      <div v-if="planLimitFeatures.length > 0" class="space-y-2">
        <h3 class="text-sm font-semibold text-foreground">
          {{ $t('billing.currentPlanCard.includedTitle') }}
        </h3>
        <ul class="space-y-2">
          <li
            v-for="line in planLimitFeatures"
            :key="line"
            class="flex items-center gap-2 text-sm text-foreground"
          >
            <svg class="h-4 w-4 flex-shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ line }}</span>
          </li>
        </ul>
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
            <span>{{ featureLabel(feature) }}</span>
          </li>
        </ul>
      </div>

      <!-- 2026-07-28: кнопку «Скасувати підписку» прибирали (рішення власника),
           бо Plata/mono НЕ має recurring — кожен платіж разовий інвойс,
           автосписання не буде в будь-якому разі, і кнопка «скасовувала» те,
           чого не станеться. 2026-09-01 (launch-план A7): Stripe-підписка —
           СПРАВЖНІЙ recurring (`mode='subscription'` у stripe_provider.py),
           тому та сама причина видалення сюди НЕ поширюється; повертаємо
           кнопку, але ЛИШЕ для provider='stripe'. Plata/LiqPay й далі без
           кнопки — стара логіка коментаря вище лишається правдивою для них. -->
      <div
        v-if="cancelScheduled"
        class="rounded-lg border border-warning/40 bg-warning-light/20 p-3 text-sm text-warning-dark"
      >
        {{ $t('billing.cancelScheduled') }}
      </div>
      <div v-else-if="canCancel" class="space-y-2 border-t border-border pt-4">
        <p class="text-xs text-muted-foreground">
          {{ $t('billing.cancelDescription') }}
        </p>
        <Button variant="outline" :loading="loading" @click="$emit('cancel')">
          {{ $t('billing.cancelSubscription') }}
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
import UpgradeHint from './UpgradeHint.vue'
import { buildPlanFeatures } from '@/modules/payments/planLimitFeatures'

defineEmits(['cancel'])

/**
 * 2026-07-27 (скрін власника): невідомі коди фіч рендерились СИРИМИ ключами
 * «billing.features.BULK_MESSAGING». te()-фолбек: нема перекладу → показуємо
 * сам код без техпрефікса (не ховаємо: юзер, що заплатив, має бачити ВСЕ,
 * що йому синкнули, а не «мінус 4 позиції мовчки»).
 */
function featureLabel(code) {
  const key = `billing.features.${code}`
  return te(key) ? t(key) : code
}

const props = defineProps({
  planCode: {
    type: String,
    required: true
  },
  activePlanCode: {
    type: String,
    default: 'FREE'
  },
  hasPending: {
    type: Boolean,
    default: false
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

const { d, t, te } = useI18n()

/**
 * Що людині реально надається за її план — з `entitlement.limits` (BE віддає
 * резолвлені ліміти, за якими LimitChecker пускає/блокує). Той самий білдер,
 * що й на картках тарифів, тож формулювання «до / необмежено» ідентичні.
 */
const planLimitFeatures = computed(() => buildPlanFeatures(props.entitlement?.limits, t))

/**
 * A7 (launch-план, 2026-09-01): кнопка скасування — ЛИШЕ для справжніх
 * recurring-провайдерів. Plata/LiqPay не мають recurring (кожен платіж
 * разовий), тож "скасувати" для них не має об'єкта дії. Stripe і Paddle —
 * mode='subscription'/справжня recurring-підписка з реальним автосписанням.
 * 2026-09-01 (Phase 2): додано 'paddle' — активний провайдер міжнародного
 * ринку (Stripe не підтримує Україну як країну акаунта, лишається dormant).
 */
const RECURRING_PROVIDERS = ['stripe', 'paddle']
const isRecurringProviderSubscription = computed(() => RECURRING_PROVIDERS.includes(props.subscription?.provider))

const canCancel = computed(() => {
  return isRecurringProviderSubscription.value
    && ['active', 'past_due'].includes(props.subscription?.status)
    && !props.subscription?.cancel_at_period_end
})

const cancelScheduled = computed(() => {
  return isRecurringProviderSubscription.value && props.subscription?.cancel_at_period_end === true
})

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
