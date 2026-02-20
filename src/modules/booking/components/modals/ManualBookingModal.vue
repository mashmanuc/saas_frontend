<template>
  <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">{{ $t('booking.manualBooking.title') }}</h2>
        <button class="modal-close" @click="handleClose">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="student-select">{{ $t('booking.manualBooking.student') }}</label>
          <select
            id="student-select"
            v-model="selectedStudentId"
            class="form-control"
            :disabled="isLoading"
          >
            <option :value="null">{{ $t('booking.manualBooking.selectStudent') }}</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="start-time">{{ $t('booking.manualBooking.startTime') }}</label>
          <input
            id="start-time"
            v-model="startTime"
            type="time"
            class="form-control"
            :disabled="isLoading"
          />
        </div>
        
        <div class="form-group">
          <label for="duration">{{ $t('booking.manualBooking.duration') }}</label>
          <div class="duration-buttons">
            <button
              v-for="dur in [30, 60, 90]"
              :key="dur"
              class="duration-btn"
              :class="{ active: duration === dur }"
              @click="duration = dur"
            >
              {{ dur }} min
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="notes">{{ $t('booking.manualBooking.notes') }}</label>
          <textarea
            id="notes"
            v-model="notes"
            class="form-control"
            rows="3"
            :disabled="isLoading"
          />
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
      
      <div class="modal-footer">
        <button
          class="btn btn--secondary"
          :disabled="isLoading"
          @click="handleClose"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="btn btn--primary"
          :disabled="isLoading || !isFormValid"
          @click="handleSubmit"
        >
          {{ isLoading ? $t('common.creating') : $t('booking.manualBooking.create') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  visible: boolean
  cell: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  created: [id: number]
}>()

const selectedStudentId = ref<number | null>(null)
const startTime = ref('')
const duration = ref(60)
const notes = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)

const isFormValid = computed(() => {
  return selectedStudentId.value !== null && startTime.value !== ''
})

watch(() => props.visible, (visible) => {
  if (visible) {
    resetForm()
    if (props.cell?.startAtUTC) {
      const date = new Date(props.cell.startAtUTC)
      startTime.value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  }
})

function resetForm() {
  selectedStudentId.value = null
  startTime.value = ''
  duration.value = 60
  notes.value = ''
  error.value = null
}

function handleClose() {
  emit('close')
}

function handleOverlayClick() {
  if (!isLoading.value) {
    handleClose()
  }
}

async function handleSubmit() {
  if (!isFormValid.value) return
  
  error.value = null
  isLoading.value = true
  
  try {
    // Mock submission - emit created event
    emit('created', 123)
    handleClose()
  } catch (err: any) {
    error.value = err.message || 'Failed to create booking'
  } finally {
    isLoading.value = false
  }
}
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
}

.modal-container {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-control:disabled {
  background-color: var(--bg-secondary);
  cursor: not-allowed;
}

textarea.form-control {
  resize: vertical;
  font-family: inherit;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background-color: var(--danger-bg, #fef2f2);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  color: var(--danger);
  font-size: 14px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background-color: var(--accent);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background-color: var(--accent-hover, #2563eb);
}

.btn--secondary {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.btn--secondary:hover:not(:disabled) {
  background-color: var(--bg-tertiary, #d1d5db);
}

.duration-buttons {
  display: flex;
  gap: 8px;
}

.duration-btn {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--card-bg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.duration-btn.active {
  background-color: var(--accent);
  color: white;
  border-color: var(--accent);
}

.duration-btn:hover:not(.active) {
  background-color: var(--bg-secondary);
}
</style>
