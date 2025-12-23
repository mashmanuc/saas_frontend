<template>
  <Teleport to="body">
    <Transition name="popover">
      <div
        v-if="visible"
        ref="popoverRef"
        class="calendar-popover"
        :style="popoverStyle"
        role="dialog"
        aria-modal="true"
        aria-label="Time slot actions"
        @click.stop
      >
        <div class="popover-header">
          <div class="time-meta">
            <span class="time-label">{{ formatTime(cell.startAtUTC) }}</span>
            <span class="duration-label">
              {{ $t('booking.calendar.duration', { minutes: cell.durationMin }) }}
            </span>
          </div>
          <button @click="close" class="icon-button" aria-label="Close menu">
            <XIcon class="w-4 h-4" />
          </button>
        </div>

        <div class="popover-actions">
          <!-- PRIMARY ACTION: Запланувати урок (Flow A згідно Canonical Spec 6.1) -->
          <button
            v-if="canBook"
            class="action-btn book primary"
            aria-label="Book a lesson at this time"
            @click="bookLesson"
          >
            <CalendarPlusIcon class="w-4 h-4" />
            {{ $t('booking.actions.bookLesson') }}
          </button>

          <!-- SECONDARY ACTIONS: Availability management -->
          <button
            v-if="canSetAvailable"
            class="action-btn available secondary"
            aria-label="Mark this time as available"
            @click="setAvailable"
          >
            <CheckIcon class="w-4 h-4" />
            {{ $t('booking.actions.setAvailable') }}
          </button>

          <button
            v-if="canSetBlocked"
            class="action-btn blocked secondary"
            aria-label="Block this time slot"
            @click="setBlocked"
          >
            <BanIcon class="w-4 h-4" />
            {{ $t('booking.actions.setBlocked') }}
          </button>

          <button
            v-if="canClearDraft"
            class="action-btn clear secondary"
            aria-label="Clear draft changes"
            @click="clearDraft"
          >
            <RotateCcwIcon class="w-4 h-4" />
            {{ $t('booking.actions.clearDraft') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { X as XIcon, CalendarPlus as CalendarPlusIcon, Check as CheckIcon, Ban as BanIcon, RotateCcw as RotateCcwIcon } from 'lucide-vue-next'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import { useClickOutside } from '@/composables/useClickOutside'
import { useDraftStore } from '@/modules/booking/stores/draftStore'
import { formatInTimezone } from '@/utils/timezone'

const props = defineProps<{
  cell: CalendarCell
  visible: boolean
  anchorEl: HTMLElement | null
  timezone?: string
}>()

const emit = defineEmits<{
  close: []
  bookLesson: [cell: CalendarCell]
}>()

const draftStore = useDraftStore()
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

const canSetAvailable = computed(() => props.cell.status !== 'available')
const canSetBlocked = computed(() => props.cell.status === 'available' || props.cell.status === 'empty')
const canBook = computed(() => props.cell.status === 'available')
const canClearDraft = computed(() => draftStore.draftPatchByKey.has(props.cell.startAtUTC))

useClickOutside(popoverRef, () => {
  if (props.visible) {
    close()
  }
})

watch(() => props.visible, async visible => {
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
    top: `${Math.max(16, top)}px`,
    left: `${Math.max(16, left)}px`,
  }
}

function formatTime(utcTime: string): string {
  if (props.timezone) {
    return formatInTimezone(utcTime, props.timezone)
  }

  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function close() {
  emit('close')
}

function setAvailable() {
  draftStore.addPatch(props.cell, 'set_available')
  close()
}

function setBlocked() {
  draftStore.addPatch(props.cell, 'set_blocked')
  close()
}

function clearDraft() {
  draftStore.removePatch(props.cell.startAtUTC)
  close()
}

function bookLesson() {
  emit('bookLesson', props.cell)
  close()
}
</script>

<style scoped>
.calendar-popover {
  position: fixed;
  z-index: 1000;
  background: white;
  border-radius: 14px;
  box-shadow:
    0 25px 50px -12px rgba(15, 23, 42, 0.45),
    0 10px 15px -3px rgba(15, 23, 42, 0.3);
  min-width: 220px;
  max-width: 320px;
  padding: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
}

.time-meta {
  display: flex;
  flex-direction: column;
}

.time-label {
  font-weight: 600;
  color: #0f172a;
}

.duration-label {
  font-size: 12px;
  color: #64748b;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  width: 28px;
  border-radius: 50%;
  transition: background-color 0.15s ease;
}

.icon-button:hover {
  background-color: rgba(148, 163, 184, 0.2);
}

.popover-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn.available {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.action-btn.available:hover {
  background: rgba(16, 185, 129, 0.2);
}

.action-btn.blocked {
  background: rgba(248, 113, 113, 0.12);
  color: #b91c1c;
}

.action-btn.blocked:hover {
  background: rgba(248, 113, 113, 0.2);
}

.action-btn.clear {
  background: rgba(251, 191, 36, 0.15);
  color: #92400e;
}

.action-btn.clear:hover {
  background: rgba(251, 191, 36, 0.25);
}

.action-btn.primary {
  background: #3b82f6;
  color: white;
  font-weight: 600;
  order: -1;
}

.action-btn.primary:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.action-btn.secondary {
  order: 1;
}

.action-btn.book {
  background: #3b82f6;
  color: white;
}

.action-btn.book:hover {
  background: #2563eb;
}

.popover-enter-active {
  animation: popover-in 0.2s ease-out;
}

.popover-leave-active {
  animation: popover-out 0.15s ease-in forwards;
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
