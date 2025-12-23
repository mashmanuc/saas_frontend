<template>
  <Teleport to="body">
    <Transition name="popover">
      <div
        v-if="visible"
        ref="popoverRef"
        class="calendar-popover"
        :style="popoverStyle"
      >
        <div class="popover-header">
          <span class="time-label">{{ formatTime(cell.startAtUTC) }}</span>
          <button @click="close" class="close-btn">
            <XIcon class="w-4 h-4" />
          </button>
        </div>
        
        <div class="popover-content">
          <!-- Available cell actions -->
          <div v-if="cell.status === 'available'" class="action-list">
            <button @click="handleBookLesson" class="action-btn">
              <CalendarPlusIcon class="w-4 h-4" />
              {{ $t('booking.actions.bookLesson') }}
            </button>
            <button @click="handleBlockTime" class="action-btn">
              <LockIcon class="w-4 h-4" />
              {{ $t('booking.actions.blockTime') }}
            </button>
            <button @click="handleClearAvailability" class="action-btn text-red-600">
              <TrashIcon class="w-4 h-4" />
              {{ $t('booking.actions.clearAvailability') }}
            </button>
          </div>
          
          <!-- Blocked cell actions -->
          <div v-else-if="cell.status === 'blocked'" class="action-list">
            <button @click="handleMakeAvailable" class="action-btn">
              <UnlockIcon class="w-4 h-4" />
              {{ $t('booking.actions.makeAvailable') }}
            </button>
            <button @click="handleBookLesson" class="action-btn">
              <CalendarPlusIcon class="w-4 h-4" />
              {{ $t('booking.actions.bookLesson') }}
            </button>
          </div>
          
          <!-- Booked cell info -->
          <div v-else-if="cell.booking" class="booking-info">
            <div class="student-info">
              <UserIcon class="w-4 h-4" />
              <span>{{ cell.booking.student.name }}</span>
            </div>
            <button @click="handleViewLesson" class="action-btn">
              {{ $t('booking.actions.viewDetails') }}
            </button>
            <button @click="handleCancelLesson" class="action-btn text-red-600">
              {{ $t('booking.actions.cancelLesson') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X as XIcon, CalendarPlus as CalendarPlusIcon, Lock as LockIcon, Unlock as UnlockIcon, Trash as TrashIcon, User as UserIcon } from 'lucide-vue-next'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import { useClickOutside } from '@/composables/useClickOutside'

const props = defineProps<{
  cell: CalendarCell
  visible: boolean
  anchorEl: HTMLElement | null
}>()

const emit = defineEmits<{
  close: []
  bookLesson: [cell: CalendarCell]
  blockTime: [cell: CalendarCell]
  makeAvailable: [cell: CalendarCell]
  clearAvailability: [cell: CalendarCell]
  viewLesson: [lessonId: number]
  cancelLesson: [lessonId: number]
}>()

const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref({})

useClickOutside(popoverRef, () => {
  if (props.visible) {
    close()
  }
})

watch(() => props.visible, async (visible) => {
  if (visible && props.anchorEl) {
    await nextTick()
    calculatePosition()
  }
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function calculatePosition() {
  if (!props.anchorEl || !popoverRef.value) return
  
  const anchorRect = props.anchorEl.getBoundingClientRect()
  const popoverRect = popoverRef.value.getBoundingClientRect()
  
  let top = anchorRect.bottom + 8
  let left = anchorRect.left
  
  if (left + popoverRect.width > window.innerWidth) {
    left = window.innerWidth - popoverRect.width - 16
  }
  
  if (top + popoverRect.height > window.innerHeight) {
    top = anchorRect.top - popoverRect.height - 8
  }
  
  popoverStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function close() {
  emit('close')
}

function handleBookLesson() {
  emit('bookLesson', props.cell)
  close()
}

function handleBlockTime() {
  emit('blockTime', props.cell)
  close()
}

function handleMakeAvailable() {
  emit('makeAvailable', props.cell)
  close()
}

function handleClearAvailability() {
  emit('clearAvailability', props.cell)
  close()
}

function handleViewLesson() {
  if (props.cell.booking) {
    emit('viewLesson', props.cell.booking.lesson_id)
  }
  close()
}

function handleCancelLesson() {
  if (props.cell.booking) {
    emit('cancelLesson', props.cell.booking.lesson_id)
  }
  close()
}
</script>

<style scoped>
.calendar-popover {
  position: fixed;
  z-index: 1000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  max-width: 300px;
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.time-label {
  font-weight: 600;
  color: #111827;
}

.close-btn {
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: #f3f4f6;
}

.popover-content {
  padding: 8px;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  text-align: left;
  transition: background-color 0.15s;
  font-size: 14px;
}

.action-btn:hover {
  background-color: #f3f4f6;
}

.booking-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.student-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: #f0fdf4;
  border-radius: 6px;
  font-weight: 500;
}

.popover-enter-active {
  animation: popover-in 0.2s ease-out;
}

.popover-leave-active {
  animation: popover-out 0.15s ease-in;
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes popover-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
}
</style>
