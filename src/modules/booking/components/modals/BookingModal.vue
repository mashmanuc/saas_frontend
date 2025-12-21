<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h2>{{ t('booking.modal.title') }}</h2>
          <button @click="$emit('close')" class="close-button">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-body">
          <div v-if="slot && tutorInfo" class="booking-details">
            <div class="detail-row">
              <User :size="16" />
              <span class="label">{{ t('booking.modal.tutor') }}:</span>
              <span class="value">{{ tutorInfo.name }}</span>
            </div>

            <div class="detail-row">
              <Calendar :size="16" />
              <span class="label">{{ t('booking.modal.date') }}:</span>
              <span class="value">{{ formatDate(slot.start_datetime) }}</span>
            </div>

            <div class="detail-row">
              <Clock :size="16" />
              <span class="label">{{ t('booking.modal.time') }}:</span>
              <span class="value">{{ formatTime(slot) }}</span>
            </div>

            <div class="form-group">
              <label for="subject">{{ t('booking.modal.subject') }} *</label>
              <select 
                id="subject" 
                v-model="formData.subject"
                :disabled="submitting"
                required
              >
                <option value="">{{ t('booking.modal.selectSubject') }}</option>
                <option value="English">English</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Computer Science">Computer Science</option>
              </select>
              <span v-if="errors.subject" class="error-text">{{ errors.subject }}</span>
            </div>

            <div class="form-group">
              <label for="note">{{ t('booking.modal.noteLabel') }}</label>
              <textarea
                id="note"
                v-model="formData.student_notes"
                :placeholder="t('booking.modal.notePlaceholder')"
                :disabled="submitting"
                rows="3"
                maxlength="500"
              ></textarea>
              <span class="char-count">{{ formData.student_notes.length }} / 500</span>
            </div>

            <div class="info-box">
              <Info :size="16" />
              <span>{{ t('booking.modal.tutorResponseTime') }}</span>
            </div>
          </div>

          <div v-if="error" class="error-banner">
            <AlertCircle :size="20" />
            <span>{{ error }}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button 
            @click="$emit('close')" 
            class="btn btn-outline"
            :disabled="submitting"
          >
            {{ t('common.cancel') }}
          </button>
          <button 
            @click="handleConfirm" 
            class="btn btn-primary"
            :disabled="submitting || !isValid"
          >
            <Loader2 v-if="submitting" :size="16" class="animate-spin" />
            <Check v-else :size="16" />
            {{ submitting ? t('booking.modal.confirming') : t('booking.modal.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Calendar, Clock, User, Info, AlertCircle, Check, Loader2 } from 'lucide-vue-next'
import { bookingApi } from '../../api/bookingApi'
import type { TimeSlot } from '../../api/availabilityApi'
import type { Booking } from '../../api/bookingApi'

interface Props {
  show: boolean
  slot: TimeSlot | null
  tutorInfo: { name: string; slug: string; avatar?: string }
  matchId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  confirmed: [booking: Booking]
}>()

const { t } = useI18n()

const formData = ref({
  subject: '',
  student_notes: ''
})

const errors = ref<Record<string, string>>({})
const submitting = ref(false)
const error = ref<string | null>(null)

const isValid = computed(() => {
  return formData.value.subject.trim().length > 0
})

function formatDate(datetime: string): string {
  return new Date(datetime).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatTime(slot: TimeSlot): string {
  const start = new Date(slot.start_datetime)
  const end = new Date(slot.end_datetime)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  
  return `${start.toLocaleTimeString(undefined, { 
    hour: '2-digit', 
    minute: '2-digit' 
  })} - ${end.toLocaleTimeString(undefined, { 
    hour: '2-digit', 
    minute: '2-digit' 
  })} (${timezone})`
}

function validate(): boolean {
  errors.value = {}
  
  if (!formData.value.subject.trim()) {
    errors.value.subject = t('booking.modal.subjectRequired')
    return false
  }
  
  if (formData.value.student_notes.length > 500) {
    errors.value.student_notes = t('booking.modal.noteTooLong')
    return false
  }
  
  return true
}

async function handleConfirm(): Promise<void> {
  if (!validate() || !props.slot) return
  
  submitting.value = true
  error.value = null
  
  try {
    const booking = await bookingApi.createTrialBooking(props.matchId, {
      slot_id: props.slot.id,
      subject: formData.value.subject,
      student_notes: formData.value.student_notes || undefined
    })
    
    emit('confirmed', booking)
    resetForm()
  } catch (err: any) {
    if (err.response?.status === 409) {
      error.value = t('booking.errors.slotUnavailable')
    } else if (err.response?.status === 403) {
      error.value = t('booking.errors.matchNotAccepted')
    } else {
      error.value = err.message || t('booking.errors.generic')
    }
  } finally {
    submitting.value = false
  }
}

function handleOverlayClick(): void {
  if (!submitting.value) {
    emit('close')
  }
}

function resetForm(): void {
  formData.value = {
    subject: '',
    student_notes: ''
  }
  errors.value = {}
  error.value = null
}

watch(() => props.show, (newVal) => {
  if (!newVal) {
    resetForm()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background-color: var(--surface);
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: var(--text-secondary);
  border-radius: 0.375rem;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: var(--surface-muted);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.booking-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--surface-muted);
  border-radius: 0.5rem;
}

.detail-row .label {
  font-weight: 500;
  color: var(--text-secondary);
}

.detail-row .value {
  font-weight: 600;
  margin-left: auto;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  font-size: 0.875rem;
}

.form-group select,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background-color: var(--surface);
  font-family: inherit;
  font-size: 0.875rem;
}

.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-bg);
}

.form-group select:disabled,
.form-group textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.char-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: right;
}

.error-text {
  font-size: 0.75rem;
  color: var(--error-text);
}

.info-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--info-bg);
  color: var(--info-text);
  border-radius: 0.5rem;
  border: 1px solid var(--info-border);
  font-size: 0.875rem;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--error-bg);
  color: var(--error-text);
  border-radius: 0.5rem;
  border: 1px solid var(--error-border);
  margin-top: 1rem;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
