<template>
  <div class="availability-overlay">
    <div
      v-for="layout in dayLayouts"
      :key="layout.slotId"
      class="availability-block"
      :style="{
        top: `${layout.top}px`,
        height: `${layout.height}px`
      }"
      @click="handleSlotClick(layout.slotId)"
    >
      <div class="availability-block__inner">
        <span class="availability-block__label">
          {{ formatSlotLabel(slotsById?.[layout.slotId]) }}
        </span>
        <div class="availability-block__actions">
          <button
            class="action-btn action-btn--edit"
            :title="t('calendar.slotEditor.title')"
            @click.stop="handleEditClick(layout.slotId)"
          >
            <EditIcon class="w-3 h-3" />
          </button>
          <button
            class="action-btn action-btn--block"
            :title="t('calendar.blockSlot.title')"
            @click.stop="handleBlockClick(layout.slotId)"
          >
            <BanIcon class="w-3 h-3" />
          </button>
          <button
            class="action-btn action-btn--delete"
            :title="t('calendar.slotEditor.delete')"
            @click.stop="handleDeleteClick(layout.slotId)"
          >
            <TrashIcon class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Edit as EditIcon, Trash2 as TrashIcon, Ban as BanIcon } from 'lucide-vue-next'
import type { AvailabilityLayout, AccessibleSlot } from '@/modules/booking/types/calendarWeek'

const { t } = useI18n()

const props = defineProps<{
  dayKey: string
  layouts?: AvailabilityLayout[]
  slotsById?: Record<number, AccessibleSlot>
}>()

const emit = defineEmits<{
  slotClicked: [slotId: number]
  slotEdit: [slotId: number]
  slotDelete: [slotId: number]
  slotBlock: [slotId: number]
}>()

const dayLayouts = computed(() => {
  return (props.layouts || []).filter(layout => layout.dayKey === props.dayKey)
})

function formatSlotLabel(slot?: AccessibleSlot) {
  if (!slot) return ''
  // Parse with timezone awareness to prevent incorrect time display
  const start = new Date(slot.start)
  const end = new Date(slot.end)
  
  // Format in local timezone
  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  
  return `${formatTime(start)} – ${formatTime(end)}`
}

function handleSlotClick(slotId: number) {
  emit('slotClicked', slotId)
}

function handleEditClick(slotId: number) {
  emit('slotEdit', slotId)
}

function handleDeleteClick(slotId: number) {
  if (window.confirm(t('calendar.slotEditor.deleteConfirm'))) {
    emit('slotDelete', slotId)
  }
}

function handleBlockClick(slotId: number) {
  emit('slotBlock', slotId)
}
</script>

<style scoped>
.availability-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
}

.availability-block {
  position: absolute;
  left: 4px;
  right: 4px;
  background: rgba(251, 191, 36, 0.25);
  border: 1px solid rgba(217, 119, 6, 0.45);
  border-radius: 8px;
  overflow: visible;
  cursor: pointer;
  transition: all 0.2s ease;
}

.availability-block:hover {
  background: rgba(251, 191, 36, 0.35);
  border-color: rgba(217, 119, 6, 0.65);
  transform: scale(1.02);
}

.availability-block__inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  padding: 4px 6px;
  box-sizing: border-box;
}

.availability-block__label {
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  padding: 2px 6px;
  line-height: 1.2;
}

.availability-block__actions {
  display: none;
  gap: 4px;
  position: absolute;
  top: 4px;
  right: 4px;
}

.availability-block:hover .availability-block__actions {
  display: flex;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.action-btn--edit {
  color: #2563eb;
}

.action-btn--edit:hover {
  background: #dbeafe;
}

.action-btn--block {
  color: #f59e0b;
}

.action-btn--block:hover {
  background: #fef3c7;
}

.action-btn--delete {
  color: #dc2626;
}

.action-btn--delete:hover {
  background: #fee2e2;
}
</style>
