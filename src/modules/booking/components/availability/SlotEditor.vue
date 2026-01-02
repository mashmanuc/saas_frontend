<template>
  <div class="slot-editor" :class="{ 'is-loading': isLoading }" data-testid="slot-editor">
    <!-- Header -->
    <div class="slot-editor-header">
      <h3 class="slot-editor-title">{{ t('calendar.slotEditor.title') }}</h3>
      <div class="slot-editor-actions">
        <button
          class="btn btn-primary"
          :disabled="isLoading || hasConflicts || !hasChanges"
          @click="handleSave"
          data-testid="save-slot"
          aria-label="Save slot changes"
        >
          <SaveIcon class="w-4 h-4" />
          {{ t('common.save') }}
        </button>
        
        <button
          class="btn btn-secondary"
          :disabled="isLoading"
          @click="handleCancel"
          data-testid="cancel-edit"
          aria-label="Cancel editing"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="btn btn-danger"
          :disabled="isLoading"
          @click="handleDelete"
          data-testid="delete-slot"
        >
          {{ t('calendar.slotEditor.delete') }}
        </button>
      </div>
    </div>

    <!-- Slot Info -->
    <div class="slot-info">
      <div class="slot-date" data-testid="slot-date">
        <CalendarIcon class="w-4 h-4" />
        {{ formatDate(slot.date) }}
      </div>
      <div class="slot-status" :class="slot.status" data-testid="slot-status">
        <span class="status-dot w-2 h-2" />
        {{ t(`availability.status.${slot.status}`) }}
      </div>
    </div>

    <!-- Time Range Input -->
    <div class="time-range-section">
      <h4 class="section-title">{{ t('calendar.slotEditor.timeRange') }}</h4>
      <TimeRangeInput
        v-model:start="localStart"
        v-model:end="localEnd"
        :disabled="isLoading"
        @change="handleTimeChange"
      />
    </div>

    <!-- Conflict Resolver -->
    <ConflictResolver
      v-if="conflicts.length > 0"
      :conflicts="conflicts"
      :show-resolution-options="true"
      @resolve="handleResolveConflicts"
      @cancel="handleCancelConflicts"
    />

    <!-- Edit Strategy -->
    <div v-if="conflicts.length > 0" class="strategy-section" data-testid="edit-strategy">
      <h4 class="section-title">{{ t('calendar.slotEditor.strategy') }}</h4>
      <div class="strategy-options">
        <label class="strategy-option">
          <input
            v-model="selectedStrategy"
            type="radio"
            value="override"
            :disabled="isLoading"
            data-testid="strategy-override"
          />
          <div class="strategy-content">
            <div class="strategy-title">{{ t('calendar.slotEditor.strategies.override.title') }}</div>
            <div class="strategy-description" data-testid="override-description">{{ t('calendar.slotEditor.strategies.override.description') }}</div>
          </div>
        </label>
        
        <label class="strategy-option">
          <input
            v-model="selectedStrategy"
            type="radio"
            value="update_template"
            :disabled="isLoading"
            data-testid="strategy-template-update"
          />
          <div class="strategy-content">
            <div class="strategy-title">{{ t('calendar.slotEditor.strategies.update_template.title') }}</div>
            <div class="strategy-description" data-testid="template-update-description">{{ t('calendar.slotEditor.strategies.update_template.description') }}</div>
          </div>
        </label>
        
        <label class="strategy-option">
          <input
            v-model="selectedStrategy"
            type="radio"
            value="update_slot"
            :disabled="isLoading"
            data-testid="strategy-update-slot"
          />
          <div class="strategy-content">
            <div class="strategy-title">{{ t('calendar.slotEditor.strategies.update_slot.title') }}</div>
            <div class="strategy-description" data-testid="update-slot-description">{{ t('calendar.slotEditor.strategies.update_slot.description') }}</div>
          </div>
        </label>
      </div>
    </div>

    <!-- Override Reason -->
    <div v-if="selectedStrategy === 'override'" class="override-section" data-testid="override-reason">
      <h4 class="section-title">{{ t('calendar.slotEditor.overrideReason') }}</h4>
      <textarea
        v-model="overrideReason"
        class="override-textarea"
        :placeholder="t('calendar.slotEditor.overrideReasonPlaceholder')"
        :disabled="isLoading"
        rows="3"
        data-testid="override-reason-textarea"
      />
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay" data-testid="loading-overlay">
      <LoaderIcon class="w-6 h-6 animate-spin" />
      <span data-testid="loading-text">{{ t('calendar.slotEditor.saving') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Save as SaveIcon, Calendar as CalendarIcon, Loader as LoaderIcon } from 'lucide-vue-next'
import { Clock, AlertCircle } from 'lucide-vue-next'
import { useSlotEditor } from '../../composables/useSlotEditor'
import { useSlotStore } from '@/stores/slotStore'
import ConflictResolver from './ConflictResolver.vue'
import TimeRangeInput from './TimeRangeInput.vue'
import type { Slot, SlotEditStrategy, Conflict } from '../../types/slot'
import { formatDateInCalendarTz } from '@/modules/booking/utils/time'

interface Props {
  slot: Slot
  timezone?: string
}

interface Emits {
  saved: [slot: Slot]
  cancelled: []
  error: [error: any]
  deleted: [slotId: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const slotStore = useSlotStore()
const { isLoading, editSlot, detectConflicts, deleteSlot: deleteSlotApi } = useSlotEditor()

// Local state
const localStart = ref(props.slot.start)
const localEnd = ref(props.slot.end)
const selectedStrategy = ref<SlotEditStrategy>('override')
const overrideReason = ref('')
const conflicts = ref<Conflict[]>([])

// Computed
const hasChanges = computed(() => 
  localStart.value !== props.slot.start || 
  localEnd.value !== props.slot.end
)

const hasConflicts = computed(() => 
  conflicts.value.some(c => c.severity === 'error')
)

// Methods
function formatDate(dateStr: string): string {
  if (props.timezone) {
    // Use calendar timezone if provided
    return formatDateInCalendarTz(dateStr, props.timezone)
  }
  // Fallback to browser locale
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

async function handleTimeChange() {
  if (!hasChanges.value) {
    conflicts.value = []
    return
  }
  
  try {
    conflicts.value = await detectConflicts(
      props.slot.id, 
      props.slot.date,
      localStart.value, 
      localEnd.value
    )
  } catch (error) {
    console.error('Failed to detect conflicts:', error)
    conflicts.value = []
  }
}

async function handleSave() {
  console.log('[SlotEditor] handleSave called:', {
    slotId: props.slot.id,
    localStart: localStart.value,
    localEnd: localEnd.value,
    strategy: selectedStrategy.value,
    overrideReason: overrideReason.value
  })
  
  try {
    const updatedSlot = await editSlot(
      props.slot.id,
      localStart.value,
      localEnd.value,
      selectedStrategy.value,
      overrideReason.value
    )
    
    console.log('[SlotEditor] Slot saved successfully:', updatedSlot)
    
    // Convert AccessibleSlotV055 to Slot format for emit
    const slotForEmit: Slot = {
      id: String(updatedSlot.id),
      date: updatedSlot.start.slice(0, 10),
      start: updatedSlot.start,
      end: updatedSlot.end,
      status: 'available',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    emit('saved', slotForEmit)
  } catch (error: any) {
    console.error('[SlotEditor] Save error:', error)
    
    // Handle 401 errors specifically - token might have been refreshed, retry once
    if (error?.response?.status === 401 && !error.config?._retryAfter401) {
      console.log('[SlotEditor] 401 detected, token should be refreshed, retrying...')
      try {
        // Mark this request as retried to avoid infinite loops
        if (error.config) {
          error.config._retryAfter401 = true
        }
        // Retry the save operation
        const updatedSlot = await editSlot(
          props.slot.id,
          localStart.value,
          localEnd.value,
          selectedStrategy.value,
          overrideReason.value
        )
        console.log('[SlotEditor] Retry successful:', updatedSlot)
        
        const slotForEmit: Slot = {
          id: String(updatedSlot.id),
          date: updatedSlot.start.slice(0, 10),
          start: updatedSlot.start,
          end: updatedSlot.end,
          status: 'available',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        emit('saved', slotForEmit)
        return
      } catch (retryError) {
        console.error('[SlotEditor] Retry failed:', retryError)
        emit('error', retryError)
        return
      }
    }
    
    // Handle 409 conflict errors - reset to original values
    if (error?.response?.status === 409) {
      console.warn('[SlotEditor] Conflict detected, resetting to original values')
      localStart.value = props.slot.start
      localEnd.value = props.slot.end
      // Conflicts should already be shown by useSlotEditor toast
    }
    
    // Handle 422 validation errors
    if (error?.response?.status === 422) {
      const errorCode = error?.response?.data?.error?.code
      console.warn('[SlotEditor] Validation error:', errorCode)
      
      if (errorCode === 'STALE_REVISION') {
        // Slot was modified by another user/process
        localStart.value = props.slot.start
        localEnd.value = props.slot.end
      } else if (errorCode === 'CANNOT_EDIT_BOOKED') {
        // Cannot edit booked slots
        localStart.value = props.slot.start
        localEnd.value = props.slot.end
      } else if (errorCode === 'CANNOT_EDIT_PAST') {
        // Cannot edit past slots
        localStart.value = props.slot.start
        localEnd.value = props.slot.end
      }
    }
    
    emit('error', error)
  }
}

function handleCancel() {
  emit('cancelled')
}

async function handleDelete() {
  const confirmed = window.confirm(t('calendar.slotEditor.deleteConfirm'))
  if (!confirmed) return
  try {
    await deleteSlotApi(Number(props.slot.id))
    slotStore.removeSlotFromState(Number(props.slot.id))
    emit('deleted', props.slot.id)
  } catch (error) {
    emit('error', error)
  }
}

function handleResolveConflicts() {
  // User chose to resolve conflicts anyway - clear conflicts and allow save
  conflicts.value = []
}

function handleCancelConflicts() {
  // Reset to original values
  localStart.value = props.slot.start
  localEnd.value = props.slot.end
  conflicts.value = []
}

// Watch for prop changes
watch(() => props.slot, (newSlot) => {
  localStart.value = newSlot.start
  localEnd.value = newSlot.end
  conflicts.value = []
})
</script>

<style scoped>
.slot-editor {
  position: relative;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
}

.slot-editor.is-loading {
  pointer-events: none;
}

.slot-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.slot-editor-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.slot-editor-actions {
  display: flex;
  gap: 8px;
}

.slot-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.slot-date,
.slot-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.slot-status.available {
  color: var(--color-success);
}

.slot-status.booked {
  color: var(--color-warning);
}

.slot-status.blocked {
  color: var(--color-error);
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.time-range-section,
.strategy-section,
.override-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.strategy-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strategy-option {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.strategy-option:hover {
  border-color: var(--color-primary);
}

.strategy-option input[type="radio"] {
  margin: 0;
}

.strategy-content {
  flex: 1;
}

.strategy-title {
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.strategy-description {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.override-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
}

.override-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 12px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
}

/* Responsive */
@media (max-width: 640px) {
  .slot-editor {
    padding: 16px;
  }
  
  .slot-editor-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .slot-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .slot-editor-actions {
    justify-content: stretch;
  }
  
  .btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
