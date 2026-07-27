<script setup lang="ts">
/**
 * Історія платежів (§5З Крок 3, 2026-07-27).
 *
 * Замінює заглушку «Історія платежів скоро буде доступна». Раніше показувати
 * було НЕМА ЧОГО: `Payment`-записи не створювались (Ф3-2), ендпойнта не було.
 * Тепер обидва є (Кроки 1-2).
 *
 * ⚠️ НЕ використовує `modules/payments/PaymentHistoryView.vue` — той написаний
 * під marketplace-модель (payment_type lesson/package/tip, platform_fee,
 * booking), якої в BYO-продукті немає й не буде (гроші учень↔тьютор через
 * платформу заборонені). Тут — власний контракт BE: date/amount/currency/
 * status/provider/plan_code.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPaymentHistory } from '../api/billingApi'
import type { PaymentHistoryItemDto } from '../api/dto'
import { activeLocale } from '@/utils/i18nDate'
import Button from '@/ui/Button.vue'

const { t } = useI18n()

const PAGE_SIZE = 10

const items = ref<PaymentHistoryItemDto[]>([])
const total = ref(0)
const isLoading = ref(false)
const error = ref<string | null>(null)

async function load(append = false) {
  isLoading.value = true
  error.value = null
  try {
    const offset = append ? items.value.length : 0
    const data = await getPaymentHistory(PAGE_SIZE, offset)
    items.value = append ? [...items.value, ...data.results] : data.results
    total.value = data.count
  } catch (e: any) {
    error.value = e?.message || t('billing.historyError')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => load())

/** Дата у локалі користувача (не хардкод en-US) — guard check:date-locale. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(activeLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusLabel(status: string): string {
  const key = `billing.paymentStatus.${status}`
  return t(key) !== key ? t(key) : status
}

/** SUCCEEDED → зелений, REFUNDED → сірий, решта → червоний. */
function statusClass(status: string): string {
  if (status === 'SUCCEEDED') return 'text-success'
  if (status === 'REFUNDED') return 'text-muted'
  return 'text-danger'
}
</script>

<template>
  <section class="payment-history">
    <h2 class="payment-history__title">{{ $t('billing.history') }}</h2>

    <!-- Помилка -->
    <div v-if="error" class="payment-history__error">
      <p>{{ error }}</p>
      <Button variant="outline" size="sm" @click="load()">{{ $t('common.retry') }}</Button>
    </div>

    <!-- Перше завантаження -->
    <p v-else-if="isLoading && items.length === 0" class="payment-history__muted">
      {{ $t('billing.loading') }}
    </p>

    <!-- Порожньо: платежів ще не було -->
    <p v-else-if="items.length === 0" class="payment-history__muted">
      {{ $t('billing.historyEmpty') }}
    </p>

    <!-- Список -->
    <template v-else>
      <ul class="payment-history__list">
        <li v-for="(p, i) in items" :key="`${p.date}-${i}`" class="payment-history__row">
          <div class="payment-history__main">
            <span class="payment-history__amount">{{ p.amount }} {{ p.currency }}</span>
            <span v-if="p.plan_code" class="payment-history__plan">{{ p.plan_code }}</span>
          </div>
          <div class="payment-history__meta">
            <span class="payment-history__date">{{ formatDate(p.date) }}</span>
            <span :class="statusClass(p.status)">{{ statusLabel(p.status) }}</span>
          </div>
        </li>
      </ul>

      <Button
        v-if="items.length < total"
        variant="outline"
        size="sm"
        :loading="isLoading"
        class="payment-history__more"
        @click="load(true)"
      >
        {{ $t('billing.historyLoadMore') }}
      </Button>
    </template>
  </section>
</template>

<style scoped>
.payment-history__title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: 0.75rem;
}
.payment-history__muted {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}
.payment-history__error {
  color: var(--danger, #dc2626);
  font-size: var(--text-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}
.payment-history__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.payment-history__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--border, #e5e7eb);
  flex-wrap: wrap;
}
.payment-history__row:last-child {
  border-bottom: none;
}
.payment-history__main {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.payment-history__amount {
  font-weight: 600;
}
.payment-history__plan {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
}
.payment-history__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.payment-history__more {
  margin-top: 0.75rem;
}
</style>
