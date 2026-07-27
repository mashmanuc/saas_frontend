<script setup lang="ts">
/**
 * Plans View — динамічна тутор-сторінка тарифів (PLAN V2 — Option A, 2026-06-23).
 *
 * Характеристики картки АВТО-генеруються з Plan.limits (buildPlanFeatures) —
 * зміна квоти в Staff оновлює картку без коду/деплою (Rule 2). `description_uk`
 * = звичайний опис тарифу (прозою, НЕ булети). Marketplace-фічі (Plan.features) НЕ рендеримо.
 *
 * Ф4 (2026-07-23, вимога власника): заглушку «Незабаром» замінено РОБОЧОЮ кнопкою
 * оплати через billingStore.startCheckout (той самий флоу, що PlanCard/PlansList;
 * LiqPay redirect робить submitCheckoutForm усередині стора).
 *
 * SSOT: saas_docs/plans/TARIFFS_V2_MARKETING_SSOT_2026-06-23.md
 */
import { onMounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles, Check, Star } from 'lucide-vue-next'
import { useBillingStore } from '@/modules/billing/stores/billingStore'
import { buildPlanFeatures, type TranslateFn } from '@/modules/payments/planLimitFeatures'
import type { PlanDto } from '@/modules/billing/api/dto'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Heading from '@/ui/Heading.vue'

const { t, locale } = useI18n()
const billingStore = useBillingStore()

onMounted(async () => {
  try {
    await Promise.all([billingStore.fetchPlans(), billingStore.fetchMe()])
  } catch (err) {
    console.error('Failed to load billing data:', err)
  }
})

const currentPlanCode = computed(() => (billingStore.currentPlanCode || '').toUpperCase())

function isCurrentPlan(plan: PlanDto): boolean {
  return (plan.code || '').toUpperCase() === currentPlanCode.value
}

/** Опис тарифу (прозою). uk-локаль → description_uk, інакше description. */
function planDescription(plan: PlanDto): string {
  const uk = plan.description_uk?.trim()
  const en = plan.description?.trim()
  return (locale.value.startsWith('uk') ? uk || en : en || uk) || ''
}

/** Авто-характеристики з Plan.limits (числа з БД, лейбли з i18n). */
function planFeatures(plan: PlanDto): string[] {
  return buildPlanFeatures(plan.limits, t as unknown as TranslateFn)
}

function formatPrice(plan: PlanDto): string {
  const amount = plan.price?.amount ?? 0
  const cur = plan.price?.currency === 'UAH' ? '₴' : plan.price?.currency || ''
  return `${amount} ${cur}`.trim()
}

function isFree(plan: PlanDto): boolean {
  return (plan.code || '').toUpperCase() === 'FREE' || (plan.price?.amount ?? 0) === 0
}

// Ф4: реальна купівля. startCheckout сам робить LiqPay-redirect (checkoutHelper).
const checkoutLoading = ref<string | null>(null)
const checkoutError = ref<string | null>(null)

async function buyPlan(plan: PlanDto): Promise<void> {
  if (checkoutLoading.value) return
  checkoutLoading.value = plan.code
  checkoutError.value = null
  try {
    await billingStore.startCheckout(plan.code)
  } catch (err: any) {
    checkoutError.value =
      err?.response?.data?.error?.detail || err?.message || t('billing.plans.checkoutError')
  } finally {
    checkoutLoading.value = null
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="text-center mb-12">
      <Sparkles :size="48" class="mx-auto mb-4 text-accent" />
      <Heading :level="1" class="mb-2">{{ $t('billing.plans.title') }}</Heading>
      <p class="text-muted text-lg">{{ $t('billing.plans.subtitle') }}</p>
    </div>

    <!-- Loading -->
    <div
      v-if="billingStore.isLoadingPlans && billingStore.plans.length === 0"
      class="flex justify-center py-12"
    >
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
    </div>

    <!-- Error -->
    <Card
      v-else-if="billingStore.lastError && billingStore.plans.length === 0"
      class="p-6 text-center"
    >
      <p class="text-danger mb-4">{{ billingStore.lastError?.message }}</p>
      <Button variant="secondary" @click="billingStore.fetchPlans()">
        {{ $t('common.retry') }}
      </Button>
    </Card>

    <!-- Plans grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card
        v-for="plan in billingStore.plans"
        :key="plan.code"
        class="relative p-6 flex flex-col"
        :class="{ 'ring-2 ring-accent': isCurrentPlan(plan) }"
      >
        <div
          v-if="plan.is_featured"
          class="absolute top-4 right-4 inline-flex items-center gap-1 text-xs font-semibold text-accent"
        >
          <Star :size="14" /> {{ $t('billing.recommended') }}
        </div>

        <h3 class="text-2xl font-bold mb-2">{{ plan.title }}</h3>

        <div class="flex items-baseline gap-1 mb-4">
          <span class="text-4xl font-bold">{{ formatPrice(plan) }}</span>
          <span class="text-muted">/ {{ $t('billing.perMonth') }}</span>
        </div>

        <p v-if="planDescription(plan)" class="text-sm text-muted mb-4">
          {{ planDescription(plan) }}
        </p>

        <ul class="space-y-2 mb-6 flex-1">
          <li
            v-for="(f, i) in planFeatures(plan)"
            :key="i"
            class="flex items-start gap-2"
          >
            <Check :size="20" class="text-accent shrink-0 mt-0.5" />
            <span class="text-sm">{{ f }}</span>
          </li>
        </ul>

        <!-- Ф4: поточний/FREE = disabled; платний = робоча оплата -->
        <Button
          v-if="isCurrentPlan(plan) || isFree(plan)"
          variant="secondary"
          class="w-full"
          disabled
        >
          {{ isCurrentPlan(plan) ? $t('billing.yourCurrentPlan') : $t('billing.plans.freeLabel') }}
        </Button>
        <Button
          v-else
          variant="primary"
          class="w-full"
          :loading="checkoutLoading === plan.code"
          :disabled="checkoutLoading !== null"
          @click="buyPlan(plan)"
        >
          {{ $t('billing.plans.subscribe') }}
        </Button>
        <p v-if="checkoutError && checkoutLoading === null" class="mt-2 text-sm text-danger text-center">
          {{ checkoutError }}
        </p>
      </Card>
    </div>
  </div>
</template>
