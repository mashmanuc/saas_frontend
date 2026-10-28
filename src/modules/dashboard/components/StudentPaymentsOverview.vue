<template>
  <Modal
    :open="open"
    :title="$t('dashboard.tutor.payments.title', { name: studentName })"
    size="sm"
    :stacked="stacked"
    @close="$emit('close')"
  >
    <div class="space-y-4" data-testid="payments-overview">
      <p v-if="loading" class="text-sm text-muted">{{ $t('dashboard.tutor.payments.loading') }}</p>
      <p v-else-if="loadError" class="text-sm text-danger" role="alert">{{ loadError }}</p>
      <p v-else-if="coverage && !coverage.tracking" class="text-sm text-muted" data-testid="payments-overview-empty">
        {{ $t('dashboard.tutor.payments.overview.empty') }}
      </p>
      <PaymentsCoverage v-else-if="coverage" :coverage="coverage" />
    </div>
  </Modal>
</template>

<script setup lang="ts">
/**
 * «Оплати» з вікна уроку в розкладі (власник 2026-10-28: «без всякої хуйні показувало за що заплачено. Тобто за які
 * уроки і які дати. Скільки грошей ще лишилось. І уроків проводити на них. І скільки було оплачено і коли. Нового
 * нічого вводити не треба»). Лише показ: дані — той самий облік учня, що «💰 Оплата» в «Моїх учнях».
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import PaymentsCoverage from './PaymentsCoverage.vue'
import { studentPaymentsApi, type StudentLedger } from '../api/studentPayments'
import { paymentCoverage, type PaymentCoverage } from '../utils/paymentCoverage'

// `stacked` — поверх вікна уроку в розкладі (його шар вищий за звичайний); `ledger` — облік, уже завантажений вікном
// уроку (тоді другого запиту немає)
const props = defineProps<{
  open: boolean; studentId: number | null; studentName: string; stacked?: boolean; ledger?: StudentLedger | null
}>()
defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

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
</script>
