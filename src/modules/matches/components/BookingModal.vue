<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookingStore } from '../store/bookingStore'
import { Calendar, Clock, CheckCircle, X } from 'lucide-vue-next'

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
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ t('booking.modal.title') }}</h2>
          <button class="close-btn" @click="handleClose">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-body">
          <div v-if="step === 'confirm'" class="step-confirm">
            <div class="slot-info">
              <Calendar :size="20" />
              <div>
                <p class="label">{{ t('booking.modal.selectedSlot') }}</p>
                <p class="value">{{ slotStart }} - {{ slotEnd }}</p>
              </div>
            </div>

            <div class="note-input">
              <label>{{ t('booking.modal.noteLabel') }}</label>
              <textarea
                v-model="note"
                :placeholder="t('booking.modal.notePlaceholder')"
                rows="3"
              />
            </div>

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
        </div>

        <div class="modal-footer">
          <button
            v-if="step === 'confirm'"
            class="btn btn-secondary"
            :disabled="loading"
            @click="handleClose"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            v-if="step === 'confirm'"
            class="btn btn-primary"
            :disabled="loading"
            @click="confirmBooking"
          >
            {{ loading ? t('booking.modal.confirming') : t('booking.modal.confirm') }}
          </button>
          <button
            v-if="step === 'success'"
            class="btn btn-primary"
            @click="handleClose"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(4, 6, 20, 0.78);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--surface-card);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 30px 60px rgba(2, 6, 23, 0.55);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid var(--border-color);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

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

.note-input label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.note-input textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  font-family: inherit;
  background: var(--surface-input);
  color: var(--text-primary);
  resize: vertical;
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
