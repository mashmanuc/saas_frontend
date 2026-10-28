<template>
  <Modal
    :open="open"
    :title="$t('dashboard.tutor.payments.title', { name: studentName })"
    size="sm"
    :stacked="stacked"
    @close="$emit('close')"
  >
    <div class="pov" data-testid="payments-overview">
      <p v-if="loading" class="text-sm text-muted">{{ $t('dashboard.tutor.payments.loading') }}</p>
      <p v-else-if="loadError" class="text-sm text-danger" role="alert">{{ loadError }}</p>
      <p v-else-if="coverage && !coverage.tracking" class="text-sm text-muted" data-testid="payments-overview-empty">
        {{ $t('dashboard.tutor.payments.overview.empty') }}
      </p>

      <template v-else-if="coverage">
        <!-- Сплачено · Проведено · Лишилось (або Борг) -->
        <div class="pov__tiles">
          <div class="pov__tile">
            <span class="pov__label">{{ $t('dashboard.tutor.payments.overview.paid') }}</span>
            <b class="pov__value" data-testid="payments-overview-paid">{{ formatUah(coverage.paidAmount) }}</b>
            <span class="pov__sub">{{ $t('dashboard.tutor.payments.lessonsShort', { n: coverage.paidLessons }) }}</span>
          </div>
          <div class="pov__tile">
            <span class="pov__label">{{ $t('dashboard.tutor.payments.overview.held') }}</span>
            <b class="pov__value">{{ coverage.heldLessons }}</b>
            <span class="pov__sub">{{ $t('dashboard.tutor.payments.overview.lessonsWord') }}</span>
          </div>
          <div
            class="pov__tile"
            :class="coverage.leftLessons < 0 ? 'pov__tile--debt' : coverage.leftLessons === 0 ? 'pov__tile--low' : 'pov__tile--ok'"
            data-testid="payments-overview-left"
          >
            <span class="pov__label">
              {{ coverage.leftLessons < 0 ? $t('dashboard.tutor.payments.overview.debt') : $t('dashboard.tutor.payments.overview.left') }}
            </span>
            <b class="pov__value">{{ Math.abs(coverage.leftLessons) }}</b>
            <span class="pov__sub">{{ $t('dashboard.tutor.payments.overview.lessonsWord') }}</span>
            <span class="pov__money">≈ {{ formatUah(coverage.leftLessons < 0 ? coverage.debtMoney : coverage.leftMoney) }}</span>
          </div>
        </div>

        <!-- Кожна оплата: коли, скільки, на які уроки пішла -->
        <section
          v-for="group in groupsNewestFirst"
          :key="group.payment.id"
          class="pov__group"
          data-testid="payments-overview-group"
        >
          <header class="pov__group-head">
            <b>{{ formatDay(group.payment.paid_on) }} · {{ formatUah(group.payment.amount) }}</b>
            <span class="pov__muted">
              {{ $t('dashboard.tutor.payments.lessonsShort', { n: group.payment.lessons }) }} ·
              {{ $t('dashboard.tutor.payments.overview.perLesson', { price: formatUah(group.price) }) }}
            </span>
          </header>
          <p v-if="group.payment.note" class="pov__note">{{ group.payment.note }}</p>
          <ul class="pov__lessons">
            <li v-for="l in group.lessons" :key="l.key" class="pov__lesson" :class="{ 'pov__lesson--held': l.held }">
              <span class="pov__mark" aria-hidden="true">{{ l.held ? '✓' : '○' }}</span>
              <span class="pov__when">{{ formatLesson(l.start) }}</span>
              <span class="pov__state">{{ lessonState(l) }}</span>
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
            </li>
          </ul>
        </section>

        <section v-if="coverage.free.length" class="pov__group pov__group--free">
          <header class="pov__group-head"><b>{{ $t('dashboard.tutor.payments.overview.freeTitle') }}</b></header>
          <ul class="pov__lessons">
            <li v-for="l in coverage.free" :key="l.key" class="pov__lesson">
              <span class="pov__mark" aria-hidden="true">–</span>
              <span class="pov__when">{{ formatLesson(l.start) }}</span>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </Modal>
</template>

<script setup lang="ts">
/**
 * «Оплати» з вікна уроку в розкладі (власник 2026-10-28: «без всякої хуйні показувало за що заплачено. Тобто за які
 * уроки і які дати. Скільки грошей ще лишилось. І уроків проводити на них. І скільки було оплачено і коли. Нового
 * нічого вводити не треба»). Лише показ: дані — той самий облік учня, що «💰 Оплата» в «Моїх учнях».
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import { studentPaymentsApi, formatUah as uah, type StudentLedger } from '../api/studentPayments'
import { paymentCoverage, type CoveredLesson, type PaymentCoverage } from '../utils/paymentCoverage'

// `stacked` — поверх вікна уроку в розкладі (його шар вищий за звичайний); `ledger` — облік, уже завантажений вікном
// уроку (тоді другого запиту немає)
const props = defineProps<{
  open: boolean; studentId: number | null; studentName: string; stacked?: boolean; ledger?: StudentLedger | null
}>()
defineEmits<{ (e: 'close'): void }>()
const { t, locale } = useI18n()

const coverage = ref<PaymentCoverage | null>(null)
const loading = ref(false)
const loadError = ref('')

watch(() => [props.open, props.studentId] as const, async ([open, id]) => {
  if (!open || !id) return
  loading.value = true
  loadError.value = ''
  coverage.value = null
  try {
    coverage.value = paymentCoverage(props.ledger?.student_id === id ? props.ledger : await studentPaymentsApi.ledger(id))
  } catch {
    loadError.value = t('dashboard.tutor.payments.errors.failed')
  } finally {
    loading.value = false
  }
}, { immediate: true })

const groupsNewestFirst = computed(() => [...(coverage.value?.groups ?? [])].reverse())
const unpaid = computed(() => [...(coverage.value?.unpaidHeld ?? []), ...(coverage.value?.unpaidPlanned ?? [])])

function lessonState(l: CoveredLesson): string {
  if (l.held && l.noShow) return t('dashboard.tutor.payments.noShow')
  return l.held ? t('dashboard.tutor.payments.overview.stateHeld') : t('dashboard.tutor.payments.overview.statePlanned')
}
function formatUah(v: number): string {
  return uah(v, String(locale.value) === 'en' ? 'en-US' : 'uk-UA')
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
.pov__group-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; font-size: 14px; color: var(--text-primary); }
.pov__muted, .pov__note { font-size: 12px; color: var(--text-secondary); margin: 0; }
.pov__lessons { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.pov__lesson { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; align-items: baseline; padding: 4px 0; font-size: 13px; color: var(--text-primary); border-bottom: 1px dashed var(--border-color); }
.pov__lesson:last-child { border-bottom: 0; }
.pov__lesson--undated { color: var(--text-secondary); }
.pov__mark { text-align: center; color: var(--text-secondary); }
.pov__lesson--held .pov__mark { color: var(--color-success); }
.pov__state { font-size: 12px; color: var(--text-secondary); }
.pov__group--unpaid .pov__group-head { color: var(--color-danger); }
.pov__group--unpaid .pov__lesson--held .pov__mark { color: var(--color-danger); }
.pov__group--free { opacity: 0.75; }
</style>
