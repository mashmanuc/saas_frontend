<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookingStore } from '../store/bookingStore'
import { Calendar, Clock, CheckCircle } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import Textarea from '@/ui/Textarea.vue'

const props = defineProps<{
  show: boolean
  matchId: string
  selectedSlot?: { start: string; end: string } | null
  onClose?: () => void
}>()

const emit = defineEmits(['close', 'success'])

const { t } = useI18n()
const bookingStore = useBookingStore()

const step = ref<'select' | 'confirm' | 'success'>(props.selectedSlot ? 'confirm' : 'select')
const note = ref('')
const loading = ref(false)

const slotStart = computed(() => props.selectedSlot?.start || '')
const slotEnd = computed(() => props.selectedSlot?.end || '')

async function confirmBooking() {
  loading.value = true
  try {
    await bookingStore.createTrialRequest(props.matchId, {
      slot_start: slotStart.value,
      slot_end: slotEnd.value,
      note: note.value || undefined
    })
    step.value = 'success'
    emit('success')
  } catch (err) {
    console.error('Booking failed:', err)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  if (props.onClose) props.onClose()
  emit('close')
}
</script>

<template>
  <Modal :open="show" :title="t('booking.modal.title')" @close="handleClose">
    <div v-if="step === 'confirm'" class="step-confirm">
      <div class="slot-info">
        <Calendar :size="20" />
        <div>
          <p class="label">{{ t('booking.modal.selectedSlot') }}</p>
          <p class="value">{{ slotStart }} - {{ slotEnd }}</p>
        </div>
      </div>

      <Textarea
        v-model="note"
        :label="t('booking.modal.noteLabel')"
        :placeholder="t('booking.modal.notePlaceholder')"
        :rows="3"
      />

      <div class="info-box">
        <Clock :size="18" />
        <p>{{ t('booking.modal.tutorResponseTime') }}</p>
      </div>
    </div>

    <div v-if="step === 'success'" class="step-success">
      <CheckCircle :size="48" class="success-icon" />
      <h3>{{ t('booking.modal.successTitle') }}</h3>
      <p>{{ t('booking.modal.successMessage') }}</p>
    </div>

    <template #footer>
      <Button
        v-if="step === 'confirm'"
        variant="outline"
        :disabled="loading"
        @click="handleClose"
      >
        {{ t('common.cancel') }}
      </Button>
      <Button
        v-if="step === 'confirm'"
        variant="primary"
        :disabled="loading"
        :loading="loading"
        @click="confirmBooking"
      >
        {{ t('booking.modal.confirm') }}
      </Button>
      <Button
        v-if="step === 'success'"
        variant="primary"
        @click="handleClose"
      >
        {{ t('common.close') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.step-confirm {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.slot-info {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-md, 8px);
}

.slot-info .label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem 0;
}

.slot-info .value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.info-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--info-bg, #dbeafe);
  color: var(--info, #3b82f6);
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
}

.info-box p {
  margin: 0;
}

.step-success {
  text-align: center;
  padding: 2rem 1rem;
}

.success-icon {
  color: var(--success, #10b981);
  margin-bottom: 1rem;
}

.step-success h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
}

.step-success p {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
}

</style>
