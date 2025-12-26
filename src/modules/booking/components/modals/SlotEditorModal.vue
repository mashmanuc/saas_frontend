<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container" role="dialog" aria-modal="true">
          <SlotEditor
            :slot="transformedSlot"
            @saved="handleSaved"
            @cancelled="handleClose"
            @deleted="handleDeleted"
            @error="handleError"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import SlotEditor from '../availability/SlotEditor.vue'
import type { AccessibleSlot } from '@/modules/booking/types/calendarWeek'
import type { Slot } from '@/modules/booking/types/slot'
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  slot: AccessibleSlot
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

// Transform AccessibleSlot to Slot format expected by SlotEditor
const transformedSlot = computed<Slot>(() => {
  const startDate = new Date(props.slot.start)
  const endDate = new Date(props.slot.end)
  
  // Format time as HH:MM using locale time (as displayed to user)
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }
  
  return {
    id: String(props.slot.id),
    date: startDate.toISOString().split('T')[0],
    start: formatTime(startDate),
    end: formatTime(endDate),
    status: 'available',
    source: 'template',
    createdAt: props.slot.start,
    updatedAt: props.slot.start
  }
})

function handleClose() {
  emit('close')
}

function handleSaved() {
  emit('saved')
}

function handleDeleted() {
  emit('deleted')
}

function handleError(error: any) {
  console.error('[SlotEditorModal] Error:', error)
}
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
  padding: 16px;
}

.modal-container {
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
  }
  
  .modal-container {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>
