<template>
  <div
    :class="eventClasses"
    :style="eventStyle"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <div class="event-content">
      <span class="event-time">{{ formatTime(event.start) }}</span>
      <span class="event-client">{{ event.clientName }}</span>
      <span class="event-duration">{{ event.durationMin }} {{ t('common.minutes') }}</span>
    </div>
    
    <div v-if="event.paidStatus === 'paid'" class="paid-indicator">
      <CheckCircleIcon class="w-3 h-3" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle as CheckCircleIcon } from 'lucide-vue-next'
import type { CalendarEvent, EventLayout } from '@/modules/booking/types/calendarWeek'

const { t } = useI18n()

const props = defineProps<{
  event: CalendarEvent
  layout: EventLayout
}>()

const emit = defineEmits<{
  click: []
}>()

const eventClasses = computed(() => [
  'event-block',
  `event-${props.event.type}`,
  `event-${props.event.doneStatus}`,
  {
    'event-paid': props.event.paidStatus === 'paid',
  },
])

const eventStyle = computed(() => ({
  top: `${props.layout.top}px`,
  height: `${props.layout.height}px`,
  left: `${props.layout.left}px`,
  width: props.layout.width,
}))

const ariaLabel = computed(() => {
  return `Урок з ${props.event.clientName} о ${formatTime(props.event.start)}, тривалість ${props.event.durationMin} ${t('common.minutes')}`
})

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleClick() {
  emit('click')
}
</script>

<style scoped>
.event-block {
  position: absolute;
  pointer-events: auto;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  outline: none;
}

.event-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 20;
}

.event-block:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  z-index: 21;
}

.event-class {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.event-trial {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.event-other {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.event-done {
  opacity: 0.7;
}

.event-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-time {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.9;
}

.event-client {
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-duration {
  font-size: 10px;
  opacity: 0.8;
}

.paid-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
