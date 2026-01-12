<script setup lang="ts">
/**
 * Plans View (v0.72.0)
 * 
 * Shows available billing plans from backend.
 * User can upgrade to a plan via checkout_url.
 * 
 * INVARIANTS:
 * - Plans come from backend, NOT hardcoded
 * - FE does NOT know payment provider
 * - FE redirects to checkout_url from backend
 * - After checkout, user returns and billing/me is refetched
 */

import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Sparkles, Check } from 'lucide-vue-next'
import { useBillingStore } from '@/modules/billing/stores/billingStore'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Heading from '@/ui/Heading.vue'

const router = useRouter()
const { t } = useI18n()
const billingStore = useBillingStore()

const isUpgrading = ref(false)
const upgradeError = ref<string | null>(null)

onMounted(async () => {
  try {
    await Promise.all([
      billingStore.fetchPlans(),
      billingStore.fetchMe(),
    ])
  } catch (err) {
    console.error('Failed to load billing data:', err)
  }
})

const currentPlanSlug = computed(() => billingStore.currentPlan?.toLowerCase())

function isPlanActive(planSlug: string): boolean {
  return currentPlanSlug.value === planSlug.toLowerCase()
}

function formatPrice(priceDecimal: string): string {
  const price = parseFloat(priceDecimal)
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
  }).format(price)
}

function formatInterval(interval: string): string {
  if (!interval) return ''
  return interval === 'monthly' ? t('billing.perMonth') : t('billing.perYear')
}

async function handleUpgrade(planSlug: string) {
  if (isPlanActive(planSlug)) return

  isUpgrading.value = true
  upgradeError.value = null

  try {
    // Initiate checkout - store will submit POST form to payment provider
    // This causes navigation to payment provider's checkout page
    await billingStore.checkout(planSlug)
    
    // Note: After checkout() submits form, browser navigates away.
    // When user returns from payment provider, route guard or component
    // should call billingStore.fetchMe() to refresh billing status.
  } catch (err: any) {
    console.error('Upgrade failed:', err)
    upgradeError.value = err.response?.data?.error?.message || t('billing.upgradeError')
    isUpgrading.value = false
  }
}

function goToBilling() {
  router.push('/billing')
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="text-center mb-12">
      <Sparkles :size="48" class="mx-auto mb-4 text-accent" />
      <Heading :level="1" class="mb-2">
        {{ $t('billing.plans.title') }}
      </Heading>
      <p class="text-muted text-lg">
        {{ $t('billing.plans.subtitle') }}
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="billingStore.isLoading && billingStore.plans.length === 0" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
    </div>

    <!-- Error State -->
    <Card v-else-if="billingStore.error" class="p-6 text-center">
      <p class="text-danger mb-4">{{ billingStore.error }}</p>
      <Button variant="secondary" @click="billingStore.fetchPlans()">
        {{ $t('common.retry') }}
      </Button>
    </Card>

    <!-- Plans Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card
        v-for="plan in billingStore.plans"
        :key="plan.slug"
        class="relative p-6 flex flex-col"
        :class="{ 'ring-2 ring-accent': isPlanActive(plan.slug) }"
      >
        <!-- Popular Badge -->
        <div v-if="plan.is_featured" class="absolute top-0 right-0 bg-accent text-white px-3 py-1 text-xs font-semibold rounded-bl-lg rounded-tr-lg">
          {{ $t('billing.popular') }}
        </div>

        <!-- Plan Header -->
        <div class="mb-4">
          <h3 class="text-2xl font-bold mb-2">{{ plan.name }}</h3>
          <div class="flex items-baseline gap-1">
            <span class="text-4xl font-bold">{{ formatPrice(plan.price_decimal) }}</span>
            <span v-if="plan.interval" class="text-muted">{{ formatInterval(plan.interval) }}</span>
          </div>
        </div>

        <!-- Plan Description -->
        <p v-if="plan.description" class="text-sm text-muted mb-4">
          {{ plan.description }}
        </p>

        <!-- Features List -->
        <ul class="space-y-2 mb-6 flex-1">
          <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
            <Check :size="20" class="text-accent flex-shrink-0 mt-0.5" />
            <span class="text-sm">{{ $t(`billing.features.${feature}`) }}</span>
          </li>
          <li v-if="plan.features.length === 0" class="text-sm text-muted">
            {{ $t('billing.basicFeatures') }}
          </li>
        </ul>

        <!-- Action Button -->
        <Button
          v-if="isPlanActive(plan.slug)"
          variant="secondary"
          class="w-full"
          disabled
        >
          {{ $t('billing.currentPlan') }}
        </Button>
        <Button
          v-else
          variant="primary"
          class="w-full"
          :disabled="isUpgrading"
          @click="handleUpgrade(plan.slug)"
        >
          {{ isUpgrading ? $t('billing.processing') : $t('billing.upgrade') }}
        </Button>
      </Card>
    </div>

    <!-- Upgrade Error -->
    <Card v-if="upgradeError" class="p-4 bg-danger-light border-danger">
      <p class="text-danger text-sm">{{ upgradeError }}</p>
    </Card>

    <!-- Current Plan Info -->
    <Card v-if="billingStore.currentPlan" class="p-6 mt-8">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-muted mb-1">{{ $t('billing.yourCurrentPlan') }}</p>
          <p class="text-xl font-semibold">{{ billingStore.currentPlan }}</p>
        </div>
        <Button variant="ghost" @click="goToBilling">
          {{ $t('billing.manageBilling') }}
        </Button>
      </div>
    </Card>

    <!-- FAQ Section -->
    <div class="mt-12">
      <Heading :level="2" class="text-center mb-6">
        {{ $t('billing.faq.title') }}
      </Heading>
      <div class="max-w-3xl mx-auto space-y-4">
        <details class="bg-card border border-default rounded-lg p-4">
          <summary class="font-semibold cursor-pointer">
            {{ $t('billing.faq.cancel.question') }}
          </summary>
          <p class="mt-2 text-sm text-muted">
            {{ $t('billing.faq.cancel.answer') }}
          </p>
        </details>
        <details class="bg-card border border-default rounded-lg p-4">
          <summary class="font-semibold cursor-pointer">
            {{ $t('billing.faq.change.question') }}
          </summary>
          <p class="mt-2 text-sm text-muted">
            {{ $t('billing.faq.change.answer') }}
          </p>
        </details>
        <details class="bg-card border border-default rounded-lg p-4">
          <summary class="font-semibold cursor-pointer">
            {{ $t('billing.faq.refund.question') }}
          </summary>
          <p class="mt-2 text-sm text-muted">
            {{ $t('billing.faq.refund.answer') }}
          </p>
        </details>
      </div>
    </div>
  </div>
</template>

