<script setup lang="ts">
// F20: Day Schedule Component
import { Plus, X, Clock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import TimeRangeInput from './TimeRangeInput.vue'

interface TimeWindow {
  start: string
  end: string
}

interface BlockedSlot {
  id: number
  start: string
  end: string
  status?: 'available' | 'booked' | 'blocked'
}

const props = defineProps<{
  windows: TimeWindow[]
  blockedSlots?: BlockedSlot[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
  update: [index: number, field: 'start' | 'end', value: string]
  slotClick: [slot: BlockedSlot]
}>()

const { t } = useI18n()

const formatTime = (datetime: string) => {
  try {
    if (datetime.includes('T')) {
      return datetime.substring(11, 16)
    }
    return datetime
  } catch (e) {
    console.error('[DaySchedule] Invalid datetime format:', datetime)
    return '00:00'
  }
}

const getSlotBadge = (slot: BlockedSlot) => {
  if (slot.status === 'booked') {
    return t('availability.editor.daySchedule.liveLesson')
  }
  return t('availability.editor.daySchedule.booked')
}

const getSlotClass = (slot: BlockedSlot) => {
  return slot.status === 'booked' ? 'blocked-slot-booked' : 'blocked-slot'
}
</script>

<template>
  <div class="day-schedule">
    <div v-if="props.blockedSlots && props.blockedSlots.length > 0" class="blocked-slots-list">
      <div 
        v-for="slot in props.blockedSlots" 
        :key="slot.id" 
        :class="[getSlotClass(slot), 'clickable']"
        @click="emit('slotClick', slot)"
        role="button"
        tabindex="0"
        :aria-label="`Edit slot ${formatTime(slot.start)} - ${formatTime(slot.end)}`"
        :data-testid="`blocked-slot-${slot.id}`"
      >
        <Clock :size="16" class="blocked-icon" />
        <span class="blocked-time">{{ formatTime(slot.start) }} - {{ formatTime(slot.end) }}</span>
        <span class="blocked-label">{{ getSlotBadge(slot) }}</span>
      </div>
    </div>

    <div v-if="windows.length > 0" class="windows-list">
      <div 
        v-for="(window, index) in windows" 
        :key="index" 
        class="window-item"
        :data-testid="`window-item-${index}`"
      >
        <TimeRangeInput
          :start="window.start"
          :end="window.end"
          :disabled="props.disabled"
          @update:start="(v) => emit('update', index, 'start', v)"
          @update:end="(v) => emit('update', index, 'end', v)"
        />
        <button 
          class="remove-btn" 
          @click="emit('remove', index)"
          :disabled="props.disabled"
          :data-testid="`remove-window-${index}`"
          :aria-label="t('availability.editor.daySchedule.remove')"
        >
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- Empty state (only if no blocked slots) -->
    <div v-else-if="!props.blockedSlots || props.blockedSlots.length === 0" class="empty-state">
      <span>{{ t('availability.editor.daySchedule.empty') }}</span>
    </div>

    <button 
      class="add-btn" 
      @click="emit('add')"
      :disabled="props.disabled"
      data-testid="add-window"
      :aria-label="t('availability.editor.daySchedule.add')"
    >
      <Plus :size="16" />
      {{ t('availability.editor.daySchedule.add') }}
    </button>
  </div>
</template>

<style scoped>
.day-schedule {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.blocked-slots-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.blocked-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--color-warning-light, #fef3c7);
  border: 1px solid var(--color-warning, #d97706);
  border-radius: 6px;
  font-size: 12px;
}

.blocked-slot-booked {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--color-danger-light, #fee2e2);
  border: 1px solid var(--color-danger, #ef4444);
  border-radius: 6px;
  font-size: 12px;
}

.blocked-slot.clickable {
  cursor: pointer;
  transition: all 0.2s;
}

.blocked-slot.clickable:hover {
  background: var(--color-warning, #fde68a);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.blocked-slot-booked.clickable:hover {
  background: var(--color-danger, #fecaca);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.blocked-slot.clickable:focus {
  outline: 2px solid var(--color-primary, #3b82f6);
  outline-offset: 2px;
}

.blocked-icon {
  color: var(--color-warning, #d97706);
  flex-shrink: 0;
}

.blocked-time {
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.blocked-label {
  margin-left: auto;
  color: var(--color-warning, #d97706);
  font-size: 11px;
  font-weight: 500;
}

.windows-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.window-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.remove-btn:hover:not(:disabled) {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
}

.remove-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.empty-state {
  padding: 8px 0;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.add-btn:hover:not(:disabled) {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--color-border, #d1d5db);
}
</style>
