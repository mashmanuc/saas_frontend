<template>
  <div class="pov">
    <!-- Сплачено · Проведено · Лишилось (або Борг) -->
    <div class="pov__tiles">
      <div class="pov__tile">
        <span class="pov__label">{{ $t('dashboard.tutor.payments.overview.paid') }}</span>
        <b class="pov__value" data-testid="payments-overview-paid">{{ uah(coverage.paidAmount) }}</b>
        <span class="pov__sub">{{ $t('dashboard.tutor.payments.lessonsShort', { n: coverage.paidLessons }) }}</span>
      </div>
      <div class="pov__tile">
        <span class="pov__label">{{ $t('dashboard.tutor.payments.overview.held') }}</span>
        <b class="pov__value">{{ coverage.heldLessons }}</b>
        <span class="pov__sub">{{ $t('dashboard.tutor.payments.overview.lessonsWord') }}</span>
      </div>
      <div
        class="pov__tile"
        :class="coverage.leftLessons < 0 ? 'pov__tile--debt' : coverage.leftLessons <= 1 ? 'pov__tile--low' : 'pov__tile--ok'"
        data-testid="payments-overview-left"
      >
        <span class="pov__label">
          {{ coverage.leftLessons < 0 ? $t('dashboard.tutor.payments.overview.debt') : $t('dashboard.tutor.payments.overview.left') }}
        </span>
        <b class="pov__value">{{ Math.abs(coverage.leftLessons) }}</b>
        <span class="pov__sub">{{ $t('dashboard.tutor.payments.overview.lessonsWord') }}</span>
        <span class="pov__money">≈ {{ uah(coverage.leftLessons < 0 ? coverage.debtMoney : coverage.leftMoney) }}</span>
      </div>
    </div>

    <!-- Кожна оплата: коли, скільки, на які уроки пішла (найсвіжіша зверху) -->
    <section
      v-for="group in groupsNewestFirst"
      :key="group.payment.id"
      class="pov__group"
      data-testid="payments-overview-group"
    >
      <header class="pov__group-head">
        <span class="pov__group-title">
          <b>{{ formatDay(group.payment.paid_on) }} · {{ uah(group.payment.amount) }}</b>
          <span class="pov__muted">
            {{ $t('dashboard.tutor.payments.lessonsShort', { n: group.payment.lessons }) }} ·
            {{ $t('dashboard.tutor.payments.overview.perLesson', { price: uah(group.price) }) }}
          </span>
        </span>
        <slot name="payment-actions" :payment="group.payment" />
      </header>
      <p v-if="group.payment.note" class="pov__note">{{ group.payment.note }}</p>
      <ul class="pov__lessons">
        <li v-for="l in group.lessons" :key="l.key" class="pov__lesson" :class="{ 'pov__lesson--held': l.held }">
          <span class="pov__mark" aria-hidden="true">{{ l.held ? '✓' : '○' }}</span>
          <span class="pov__when">{{ formatLesson(l.start) }}</span>
          <span class="pov__state">{{ lessonState(l) }}</span>
          <slot name="lesson-actions" :lesson="l" />
        </li>
        <li v-if="group.undated" class="pov__lesson pov__lesson--undated">
          <span class="pov__mark" aria-hidden="true">○</span>
          <span class="pov__when">{{ $t('dashboard.tutor.payments.overview.undated', { n: group.undated }) }}</span>
        </li>
      </ul>
    </section>

    <!-- Понад оплачене: борг (проведені) і ще не оплачені (у розкладі) -->
    <section v-if="unpaid.length" class="pov__group pov__group--unpaid" data-testid="payments-overview-unpaid">
      <header class="pov__group-head"><b>{{ $t('dashboard.tutor.payments.overview.unpaidTitle') }}</b></header>
      <ul class="pov__lessons">
        <li v-for="l in unpaid" :key="l.key" class="pov__lesson" :class="{ 'pov__lesson--held': l.held }">
          <span class="pov__mark" aria-hidden="true">{{ l.held ? '!' : '○' }}</span>
          <span class="pov__when">{{ formatLesson(l.start) }}</span>
          <span class="pov__state">{{ lessonState(l) }}</span>
          <slot name="lesson-actions" :lesson="l" />
        </li>
      </ul>
    </section>

    <section v-if="coverage.free.length" class="pov__group pov__group--free" data-testid="payments-overview-free">
      <header class="pov__group-head"><b>{{ $t('dashboard.tutor.payments.overview.freeTitle') }}</b></header>
      <ul class="pov__lessons">
        <li v-for="l in coverage.free" :key="l.key" class="pov__lesson">
          <span class="pov__mark" aria-hidden="true">–</span>
          <span class="pov__when">{{ formatLesson(l.start) }}</span>
          <span class="pov__state">{{ lessonState(l) }}</span>
          <slot name="lesson-actions" :lesson="l" />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * «За що заплачено» — картки й оплати з уроками (власник 2026-10-28). Один вигляд для огляду з вікна уроку
 * (`StudentPaymentsOverview`, лише показ) і для «💰 Оплата» в «Моїх учнях» (`StudentPaymentsDialog`: у слотах —
 * «Видалити» оплату й «рахується» на проведеному уроці).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatUah } from '../api/studentPayments'
import type { CoveredLesson, PaymentCoverage } from '../utils/paymentCoverage'

const props = defineProps<{ coverage: PaymentCoverage }>()
const { t, locale } = useI18n()

const groupsNewestFirst = computed(() => [...props.coverage.groups].reverse())
const unpaid = computed(() => [...props.coverage.unpaidHeld, ...props.coverage.unpaidPlanned])

function lessonState(l: CoveredLesson): string {
  if (l.held && l.noShow) return t('dashboard.tutor.payments.noShow')
  if (l.held && l.source === 'instant') return t('dashboard.tutor.payments.sourceInstant')
  return l.held ? t('dashboard.tutor.payments.overview.stateHeld') : t('dashboard.tutor.payments.overview.statePlanned')
}
function uah(v: number): string {
  return formatUah(v, String(locale.value) === 'en' ? 'en-US' : 'uk-UA')
}
function formatDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(String(locale.value), { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatLesson(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = d.toLocaleDateString(String(locale.value), { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString(String(locale.value), { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}
</script>

<style scoped>
.pov { display: flex; flex-direction: column; gap: 14px; }
.pov__tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pov__tile {
  display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
}
.pov__tile--ok { border-color: var(--color-success); }
.pov__tile--low { border-color: var(--color-warning); }
.pov__tile--debt { border-color: var(--color-danger); }
.pov__tile--debt .pov__value { color: var(--color-danger); }
.pov__label { font-size: 12px; color: var(--text-secondary); }
.pov__value { font-size: 20px; line-height: 1.2; color: var(--text-primary); }
.pov__sub { font-size: 12px; color: var(--text-secondary); }
.pov__money { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; }
.pov__group { display: flex; flex-direction: column; gap: 6px; }
.pov__group-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 14px; color: var(--text-primary); }
.pov__group-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; min-width: 0; }
.pov__muted, .pov__note { font-size: 12px; color: var(--text-secondary); margin: 0; }
.pov__lessons { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.pov__lesson { display: grid; grid-template-columns: 18px 1fr auto auto; gap: 8px; align-items: center; padding: 4px 0; font-size: 13px; color: var(--text-primary); border-bottom: 1px dashed var(--border-color); }
.pov__lesson:last-child { border-bottom: 0; }
.pov__lesson--undated { color: var(--text-secondary); }
.pov__mark { text-align: center; color: var(--text-secondary); }
.pov__lesson--held .pov__mark { color: var(--color-success); }
.pov__state { font-size: 12px; color: var(--text-secondary); }
.pov__group--unpaid .pov__group-head { color: var(--color-danger); }
.pov__group--unpaid .pov__lesson--held .pov__mark { color: var(--color-danger); }
.pov__group--free .pov__when { color: var(--text-secondary); text-decoration: line-through; }
</style>
