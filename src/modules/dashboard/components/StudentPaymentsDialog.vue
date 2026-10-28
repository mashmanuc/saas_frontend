<template>
  <Modal
    :open="open"
    :title="$t('dashboard.tutor.payments.title', { name: studentName })"
    size="sm"
    @close="$emit('close')"
  >
    <div class="space-y-4" data-testid="student-payments">
      <p v-if="loading" class="text-sm text-muted">{{ $t('dashboard.tutor.payments.loading') }}</p>
      <p v-else-if="loadError" class="text-sm text-danger" role="alert">{{ loadError }}</p>

      <template v-else-if="ledger && coverage">
        <!-- 2026-10-28 (власник: «повно однотонних символів, тяжко розібрати»): той самий вигляд, що «Оплати» з розкладу —
             картки «Сплачено / Проведено / Лишилось», кожна оплата з уроками по датах; тут ще «Видалити» й «рахується» -->
        <p v-if="!coverage.tracking" class="text-sm text-muted" data-testid="student-payments-balance">
          {{ $t('dashboard.tutor.payments.balance.none') }}
        </p>
        <div v-else data-testid="student-payments-history">
          <PaymentsCoverage :coverage="coverage">
            <template #payment-actions="{ payment }">
              <button
                v-if="confirmId !== payment.id"
                type="button"
                class="shrink-0 text-xs text-muted hover:text-danger"
                :data-testid="`student-payment-delete-${payment.id}`"
                @click="confirmId = payment.id"
              >
                {{ $t('dashboard.tutor.payments.delete') }}
              </button>
              <span v-else class="flex shrink-0 items-center gap-2 text-xs">
                <button type="button" class="font-semibold text-danger" :data-testid="`student-payment-delete-yes-${payment.id}`" @click="remove(payment.id)">
                  {{ $t('dashboard.tutor.payments.deleteYes') }}
                </button>
                <button type="button" class="text-muted" @click="confirmId = null">{{ $t('dashboard.tutor.payments.deleteNo') }}</button>
              </span>
            </template>
            <!-- «Урок не рахувати» (власник 2026-10-15, пункт 3) — лише на проведених -->
            <template #lesson-actions="{ lesson }">
              <button
                v-if="lesson.held"
                type="button"
                class="pay-count"
                :class="lesson.counted ? 'pay-count--on' : ''"
                :disabled="togglingKey === `${lesson.source}-${lesson.id}`"
                :data-testid="`student-payment-lesson-${lesson.source}-${lesson.id}`"
                :title="$t(lesson.counted ? 'dashboard.tutor.payments.makeNotCounted' : 'dashboard.tutor.payments.makeCounted')"
                @click="toggleCounted(lesson)"
              >
                {{ $t(lesson.counted ? 'dashboard.tutor.payments.lessonCounted' : 'dashboard.tutor.payments.lessonNotCounted') }}
              </button>
              <span v-else />
            </template>
          </PaymentsCoverage>
          <p v-if="ledger.lessons.length" class="mt-2 text-xs text-muted">{{ $t('dashboard.tutor.payments.lessonsHint') }}</p>
        </div>

        <p v-if="saveError" class="text-sm text-danger" role="alert" data-testid="student-payment-error">{{ saveError }}</p>

        <!-- Записати оплату: є оплати — згорнуто (спершу видно, що вже є); оплат немає — одразу відкрито -->
        <button
          v-if="!formOpen"
          type="button"
          class="pay-add"
          data-testid="student-payments-add-toggle"
          @click="formOpen = true"
        >
          ＋ {{ $t('dashboard.tutor.payments.add') }}
        </button>
        <form v-else class="space-y-3 rounded-xl border border-border-subtle p-3" data-testid="student-payments-form" @submit.prevent="save">
          <p class="text-sm font-semibold text-body">{{ $t('dashboard.tutor.payments.add') }}</p>
          <div class="grid grid-cols-2 gap-3">
            <Input
              id="student-payment-amount"
              v-model="amount"
              :label="$t('dashboard.tutor.payments.amount')"
              inputmode="decimal"
              :placeholder="$t('dashboard.tutor.payments.amountPlaceholder')"
              required
              data-testid="student-payment-amount"
            />
            <Input
              id="student-payment-lessons"
              v-model="lessons"
              :label="$t('dashboard.tutor.payments.lessons')"
              inputmode="numeric"
              :placeholder="$t('dashboard.tutor.payments.lessonsPlaceholder')"
              required
              data-testid="student-payment-lessons"
            />
          </div>
          <div v-if="monthHints.length" class="flex flex-wrap gap-2">
            <button
              v-for="h in monthHints"
              :key="h.month"
              type="button"
              class="rounded-full border border-default px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
              :data-testid="`student-payment-month-${h.month}`"
              @click="lessons = String(h.count)"
            >
              {{ $t('dashboard.tutor.payments.monthHint', { month: h.label, n: h.count }) }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <Input
              id="student-payment-date"
              v-model="paidOn"
              type="date"
              :label="$t('dashboard.tutor.payments.date')"
              data-testid="student-payment-date"
            />
            <Input
              id="student-payment-note"
              v-model="note"
              :label="$t('dashboard.tutor.payments.note')"
              :placeholder="$t('dashboard.tutor.payments.notePlaceholder')"
              maxlength="500"
              data-testid="student-payment-note"
            />
          </div>
          <p v-if="pricePreview" class="text-xs text-muted">{{ pricePreview }}</p>
          <p v-else-if="!saving && !canSave" class="text-xs text-muted" data-testid="student-payment-fill-hint">
            {{ $t('dashboard.tutor.payments.fillHint') }}
          </p>
          <div class="flex justify-end">
            <Button variant="primary" size="sm" type="submit" :disabled="!canSave" data-testid="student-payment-save">
              {{ saving ? $t('dashboard.tutor.payments.saving') : $t('dashboard.tutor.payments.save') }}
            </Button>
          </div>
        </form>
      </template>
    </div>
  </Modal>
</template>

<script setup lang="ts">
// Облік передоплат учня (власник 2026-10-14: «з учня треба реєструвати плату… платять наперед, за кілька
// уроків або за місяць»). Оплата — «сума за N уроків»; залишок рахує сервер (оплачені − проведені).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '../../../ui/Modal.vue'
import Button from '../../../ui/Button.vue'
import Input from '../../../ui/Input.vue'
import PaymentsCoverage from './PaymentsCoverage.vue'
import { formatUah, studentPaymentsApi, type HeldLessonItem, type StudentLedger } from '../api/studentPayments'
import { paymentCoverage } from '../utils/paymentCoverage'

const props = defineProps<{ open: boolean; studentId: number | string | null; studentName: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const { t, locale } = useI18n()

const ledger = ref<StudentLedger | null>(null)
const loading = ref(false)
const loadError = ref('')
const amount = ref('')
const lessons = ref('')
const paidOn = ref('')
const note = ref('')
const saving = ref(false)
const saveError = ref('')
const confirmId = ref<number | null>(null)
const togglingKey = ref<string | null>(null)
/** 2026-10-28: форма «Записати оплату» — відкрита, лише коли оплат ще немає (або вчитель її відкрив) */
const formOpen = ref(false)
const coverage = computed(() => (ledger.value ? paymentCoverage(ledger.value) : null))

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function errorText(err: unknown): string {
  const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
  const key = `dashboard.tutor.payments.errors.${code}`
  return code && t(key) !== key ? t(key) : t('dashboard.tutor.payments.errors.failed')
}

async function load(): Promise<void> {
  if (props.studentId == null) return
  loading.value = true
  loadError.value = ''
  try {
    ledger.value = await studentPaymentsApi.ledger(props.studentId)
    formOpen.value = !ledger.value.balance.tracking
  } catch (err) {
    ledger.value = null
    loadError.value = errorText(err)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.studentId],
  ([open]) => {
    if (!open) return
    amount.value = ''
    lessons.value = ''
    paidOn.value = today()
    note.value = ''
    saveError.value = ''
    confirmId.value = null
    void load()
  },
  { immediate: true },
)

const monthHints = computed(() => {
  const m = ledger.value?.month_lessons ?? {}
  return Object.entries(m)
    .filter(([, n]) => n > 0)
    .map(([month, count]) => ({
      month,
      count,
      label: new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(`${month}-15T12:00:00`)),
    }))
})

const amountNumber = computed(() => Number(String(amount.value).replace(/\s/g, '').replace(',', '.')))
const lessonsNumber = computed(() => Number(lessons.value))
const canSave = computed(() =>
  !saving.value && amountNumber.value > 0 && Number.isInteger(lessonsNumber.value) && lessonsNumber.value >= 1,
)
const pricePreview = computed(() =>
  canSave.value ? t('dashboard.tutor.payments.pricePreview', { price: formatUah(Math.round((amountNumber.value / lessonsNumber.value) * 100) / 100) }) : '',
)

/** «Урок не рахувати» / знову рахувати: урок лишається проведеним, змінюється лише списання з передоплати */
async function toggleCounted(l: Pick<HeldLessonItem, 'source' | 'id' | 'counted'>): Promise<void> {
  if (props.studentId == null || !ledger.value) return
  const key = `${l.source}-${l.id}`
  togglingKey.value = key
  saveError.value = ''
  try {
    const res = await studentPaymentsApi.setLessonCounted(props.studentId, { source: l.source, id: l.id, counted: !l.counted })
    ledger.value = {
      ...ledger.value,
      balance: res.balance,
      lessons: ledger.value.lessons.map((x) => (x.source === l.source && x.id === l.id ? { ...x, counted: !l.counted } : x)),
    }
    emit('changed')
  } catch (err) {
    // Видимо у вікні; позначка не змінилась
    saveError.value = errorText(err)
  } finally {
    togglingKey.value = null
  }
}

async function save(): Promise<void> {
  if (!canSave.value || props.studentId == null || !ledger.value) return
  saving.value = true
  saveError.value = ''
  try {
    const res = await studentPaymentsApi.record(props.studentId, {
      amount: String(amount.value).replace(/\s/g, ''),
      lessons: lessonsNumber.value,
      paid_on: paidOn.value || undefined,
      note: note.value.trim(),
    })
    const payments = [res.payment, ...ledger.value.payments]
      .sort((a, b) => (a.paid_on === b.paid_on ? b.id - a.id : a.paid_on < b.paid_on ? 1 : -1))
    ledger.value = { ...ledger.value, balance: res.balance, payments }
    amount.value = ''
    lessons.value = ''
    note.value = ''
    emit('changed')
  } catch (err) {
    // Видимо у вікні; нічого не записано — виправити й зберегти ще раз
    saveError.value = errorText(err)
  } finally {
    saving.value = false
  }
}

async function remove(paymentId: number): Promise<void> {
  if (!ledger.value) return
  saveError.value = ''
  try {
    const res = await studentPaymentsApi.remove(paymentId)
    ledger.value = { ...ledger.value, balance: res.balance, payments: ledger.value.payments.filter((p) => p.id !== paymentId) }
    confirmId.value = null
    emit('changed')
  } catch (err) {
    saveError.value = errorText(err)
  }
}
</script>

<style scoped>
/* 2026-10-28: «рахується» — зелене, «не рахується» — сіре; «Записати оплату» — помітна, але не форма на пів-вікна */
.pay-count {
  flex: none;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  background: none;
  cursor: pointer;
}
.pay-count--on {
  border-color: var(--color-success);
  color: var(--color-success);
}
.pay-count:disabled {
  opacity: 0.6;
  cursor: default;
}
.pay-add {
  width: 100%;
  min-height: 42px;
  border-radius: 12px;
  border: 1.5px dashed var(--accent);
  background: none;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
