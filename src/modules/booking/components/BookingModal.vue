<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <header class="modal-header">
        <h2>Забронювати урок</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </header>

      <div class="modal-body">
        <!-- Step 1: Select slot -->
        <div v-if="step === 1">
          <h3>Оберіть час</h3>
          <SlotPicker :tutor-id="tutorId" :loading="isLoadingSlots" />
        </div>

        <!-- Step 2: Add notes -->
        <div v-if="step === 2">
          <h3>Додаткова інформація</h3>
          <div class="form-group">
            <label>Предмет</label>
            <input v-model="subject" type="text" placeholder="Математика, Англійська..." />
          </div>
          <div class="form-group">
            <label>Тип уроку</label>
            <select v-model="lessonType">
              <option value="trial">Пробний</option>
              <option value="regular">Звичайний</option>
              <option value="package">Пакет</option>
            </select>
          </div>
          <div class="form-group">
            <label>Коментар до уроку (необов'язково)</label>
            <textarea
              v-model="notes"
              placeholder="Що б ви хотіли вивчити на цьому уроці?"
              rows="4"
            ></textarea>
          </div>

          <div v-if="selectedSlot" class="booking-summary">
            <p><strong>Дата:</strong> {{ formattedDate }}</p>
            <p><strong>Час:</strong> {{ formattedTime }}</p>
            <p><strong>Тривалість:</strong> {{ selectedSlot.duration_minutes }} хвилин</p>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button v-if="step > 1" class="btn ghost" @click="step--">Назад</button>
        <button
          v-if="step === 1"
          class="btn primary"
          :disabled="!selectedSlot"
          @click="step = 2"
        >
          Далі
        </button>
        <button
          v-if="step === 2"
          class="btn primary"
          :disabled="isSubmitting || !subject"
          @click="submitBooking"
        >
          {{ isSubmitting ? 'Бронюємо...' : 'Підтвердити' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SlotPicker from './booking/SlotPicker.vue'
import { bookingApi } from '../api/booking'

interface Props {
  tutorId: number
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'booked', booking: unknown): void
}>()

const selectedSlot = ref<any>(null)

// State
const step = ref(1)
const subject = ref('')
const lessonType = ref<'trial' | 'regular' | 'package'>('regular')
const notes = ref('')
const isSubmitting = ref(false)
const isLoadingSlots = ref(false)

// Computed
const formattedDate = computed(() => {
  if (!selectedSlot.value) return ''
  const date = new Date(selectedSlot.value.start_datetime)
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const formattedTime = computed(() => {
  if (!selectedSlot.value) return ''
  const date = new Date(selectedSlot.value.start_datetime)
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
})

// Methods
async function submitBooking() {
  if (!selectedSlot.value || isSubmitting.value || !subject.value) return

  isSubmitting.value = true

  try {
    const booking = await bookingApi.createBooking({
      tutor_id: props.tutorId,
      slot_id: selectedSlot.value.id,
      subject: subject.value,
      lesson_type: lessonType.value,
      student_notes: notes.value || undefined,
    })

    emit('booked', booking)
    emit('close')
  } catch (error) {
    console.error('Failed to create booking:', error)
    alert('Не вдалося створити бронювання. Спробуйте ще раз.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
}

.modal-body {
  padding: 1.5rem;
}

.modal-body h3 {
  margin-bottom: 1rem;
  font-size: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
}

.booking-summary {
  padding: 1rem;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 8px;
  margin-top: 1rem;
}

.booking-summary p {
  margin: 0.25rem 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn.primary {
  background: var(--primary-600, #2563eb);
  color: white;
}

.btn.primary:disabled {
  background: var(--gray-300, #d1d5db);
  cursor: not-allowed;
}

.btn.ghost {
  background: transparent;
  border: 1px solid var(--border-color, #e5e7eb);
}
</style>
