<template>
  <div class="modal-overlay" @click.self="handleCancel" data-testid="create-slot-modal-overlay">
    <div class="modal-content" role="dialog" aria-labelledby="create-slot-title" aria-modal="true">
      <div class="modal-header">
        <h3 id="create-slot-title" class="modal-title">{{ t('availability.createSlot.title') }}</h3>
        <button
          class="close-button"
          @click="handleCancel"
          :aria-label="t('common.close')"
          data-testid="close-modal"
        >
          <XIcon :size="20" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Date Display -->
        <div class="date-section">
          <CalendarIcon :size="16" class="icon" />
          <span class="date-text">{{ formatDate(date) }}</span>
        </div>

        <!-- Time Range Input -->
        <div class="time-section">
          <h4 class="section-title">{{ t('availability.createSlot.timeRange') }}</h4>
          <TimeRangeInput
            v-model:start="localStart"
            v-model:end="localEnd"
            :disabled="isLoading"
            @change="handleTimeChange"
          />
        </div>

        <!-- Conflict Warning -->
        <div v-if="conflicts.length > 0" class="conflict-warning" role="alert" data-testid="conflict-warning">
          <AlertCircleIcon :size="20" class="warning-icon" />
          <div class="warning-content">
            <p class="warning-title">{{ t('availability.createSlot.conflictsDetected') }}</p>
            <ul class="conflict-list">
              <li v-for="(conflict, index) in conflicts" :key="index" class="conflict-item">
                {{ conflict.message }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state" role="status" aria-live="polite">
          <LoaderIcon :size="20" class="spinner" />
          <span>{{ t('availability.createSlot.creating') }}</span>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          @click="handleCancel"
          :disabled="isLoading"
          data-testid="cancel-create"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="btn btn-primary"
          @click="handleCreate"
          :disabled="isLoading || hasErrorConflicts || !isValid"
          data-testid="confirm-create"
        >
          <PlusIcon v-if="!isLoading" :size="16" />
          <LoaderIcon v-else :size="16" class="spinner" />
          {{ t('availability.createSlot.create') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { X as XIcon, Calendar as CalendarIcon, AlertCircle as AlertCircleIcon, Loader as LoaderIcon, Plus as PlusIcon } from 'lucide-vue-next'
import TimeRangeInput from './TimeRangeInput.vue'
import { bookingApi } from '@/modules/booking/api/booking'
import { useSlotStore } from '@/stores/slotStore'
import { useToast } from '@/composables/useToast'
import type { Conflict } from '@/modules/booking/types/slot'

interface Props {
  date: string
  start: string
  end: string
}

interface Emits {
  created: [slot: any]
  cancelled: []
  error: [error: any]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const slotStore = useSlotStore()
const toast = useToast()

const localStart = ref(props.start)
const localEnd = ref(props.end)
const isLoading = ref(false)
const error = ref<string | null>(null)
const conflicts = ref<Conflict[]>([])

const hasErrorConflicts = computed(() => 
  conflicts.value.some(c => c.severity === 'error')
)

const isValid = computed(() => {
  if (!localStart.value || !localEnd.value) return false
  const [startHour, startMin] = localStart.value.split(':').map(Number)
  const [endHour, endMin] = localEnd.value.split(':').map(Number)
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  return endMinutes > startMinutes
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

async function handleTimeChange() {
  if (!isValid.value) {
    conflicts.value = []
    return
  }
  
  try {
    const response = await bookingApi.checkSlotConflicts({
      date: props.date,
      start_time: localStart.value,
      end_time: localEnd.value
    })
    
    conflicts.value = Array.isArray(response) ? response : (response?.conflicts || [])
  } catch (error) {
    console.error('[CreateSlotModal] Failed to check conflicts:', error)
    conflicts.value = []
  }
}

async function handleCreate() {
  if (!isValid.value) return
  
  isLoading.value = true
  error.value = null
  
  try {
    // Check for conflicts before creating
    await handleTimeChange()
    
    if (hasErrorConflicts.value) {
      error.value = t('availability.createSlot.conflictsDetected')
      return
    }
    
    const slotData = {
      date: props.date,
      start_time: localStart.value,
      end_time: localEnd.value
    }
    
    // Optimistic update: show slot immediately
    const tempId = Date.now()
    const optimisticSlot = {
      id: tempId,
      date: props.date,
      start: localStart.value,
      end: localEnd.value,
      status: 'available' as const,
      source: 'manual' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    console.log('[CreateSlotModal] Optimistic slot created:', optimisticSlot)
    
    const createdSlot = await bookingApi.createCustomSlot(slotData)
    
    console.log('[CreateSlotModal] Slot created on server:', createdSlot)
    
    toast.success(t('availability.createSlot.success'))
    emit('created', createdSlot)
  } catch (err: any) {
    console.error('[CreateSlotModal] Failed to create slot:', err)
    
    // Handle 401 errors - retry after token refresh
    if (err?.response?.status === 401 && !err.config?._retryAfter401) {
      console.log('[CreateSlotModal] 401 detected, retrying after token refresh...')
      try {
        if (err.config) {
          err.config._retryAfter401 = true
        }
        const newSlot = await bookingApi.createCustomSlot({
          date: props.date,
          start_time: localStart.value,
          end_time: localEnd.value
        })
        
        slotStore.refreshSlot(newSlot)
        toast.success(t('availability.createSlot.success'))
        emit('created', newSlot)
        return
      } catch (retryError) {
        console.error('[CreateSlotModal] Retry failed:', retryError)
        toast.error(t('availability.createSlot.error'))
        emit('error', retryError)
        return
      }
    }
    
    toast.error(t('availability.createSlot.error'))
    emit('error', err)
  } finally {
    isLoading.value = false
  }
}

function handleCancel() {
  emit('cancelled')
}

onMounted(() => {
  handleTimeChange()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.close-button:hover {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #111827);
}

.modal-body {
  padding: 24px;
}

.date-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 8px;
  margin-bottom: 20px;
}

.date-section .icon {
  color: var(--color-primary, #3b82f6);
}

.date-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.time-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin-bottom: 12px;
}

.conflict-warning {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--color-warning-light, #fef3c7);
  border: 1px solid var(--color-warning, #f59e0b);
  border-radius: 8px;
  margin-bottom: 20px;
}

.warning-icon {
  flex-shrink: 0;
  color: var(--color-warning, #f59e0b);
}

.warning-content {
  flex: 1;
}

.warning-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-warning-dark, #d97706);
  margin: 0 0 8px 0;
}

.conflict-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.conflict-item {
  margin-bottom: 4px;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #111827);
  border: 1px solid var(--color-border, #e5e7eb);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .modal-content {
    max-width: 100%;
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }
  
  .modal-footer {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
