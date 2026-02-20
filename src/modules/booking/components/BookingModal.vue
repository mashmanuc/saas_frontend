<template>
  <Modal :open="open" title="Забронювати урок" size="md" @close="$emit('close')">
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
        <input v-model="subject" type="text" class="input" placeholder="Математика, Англійська..." />
      </div>
      <div class="form-group">
        <label>Тип уроку</label>
        <select v-model="lessonType" class="input">
          <option value="trial">Пробний</option>
          <option value="regular">Звичайний</option>
          <option value="package">Пакет</option>
        </select>
      </div>
      <div class="form-group">
        <label>Коментар до уроку (необов'язково)</label>
        <textarea
          v-model="notes"
          class="input"
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

    <template #footer>
      <Button v-if="step > 1" variant="ghost" @click="step--">Назад</Button>
      <Button
        v-if="step === 1"
        variant="primary"
        :disabled="!selectedSlot"
        @click="step = 2"
      >
        Далі
      </Button>
      <Button
        v-if="step === 2"
        variant="primary"
        :disabled="!subject"
        :loading="isSubmitting"
        @click="submitBooking"
      >
        Підтвердити
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SlotPicker from './booking/SlotPicker.vue'
import { bookingApi } from '../api/booking'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

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
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.booking-summary {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-top: 1rem;
}

.booking-summary p {
  margin: 0.25rem 0;
}
</style>
