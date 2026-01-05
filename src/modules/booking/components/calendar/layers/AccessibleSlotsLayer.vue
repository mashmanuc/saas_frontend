<template>
  <div class="accessible-slots-layer">
    <div
      v-for="slot in accessibleSlots"
      :key="slot.id"
      class="accessible-slot"
      data-testid="accessible-slot"
      :data-slot-hour="getSlotHour(slot.start)"
      :style="getSlotStyle(slot)"
      :title="`Доступно: ${formatTime(slot.start)} - ${formatTime(slot.end)}`"
      @click="handleSlotClick(slot)"
    >
      <div class="slot-label">
        <span class="slot-time">{{ formatTime(slot.start) }}</span>
        <span v-if="slot.is_recurring" class="slot-recurring">🔁</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { useCalendarGrid } from '@/modules/booking/composables/useCalendarGrid'

dayjs.extend(utc)
dayjs.extend(timezone)

interface AccessibleSlot {
  id: number
  start: string
  end: string
  is_recurring: boolean
}

const props = defineProps<{
  accessibleSlots: AccessibleSlot[]
  pxPerMinute: number
  timezone?: string
}>()

const emit = defineEmits<{
  'slot-click': [slot: AccessibleSlot]
}>()

const tz = computed(() => props.timezone || 'UTC')
const { calculateTopPx, calculateHeightPx, formatTime } = useCalendarGrid({
  timezone: tz.value,
  pxPerMinute: props.pxPerMinute,
})

const handleSlotClick = (slot: AccessibleSlot) => {
  emit('slot-click', slot)
}

const getSlotHour = (startTime: string): number => {
  return dayjs(startTime).tz(tz.value).hour()
}

const getSlotStyle = (slot: AccessibleSlot) => {
  const topPx = calculateTopPx(slot.start)
  const heightPx = calculateHeightPx(slot.start, slot.end)

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: '4px',
    right: '4px',
  }
}

</script>

<style scoped>
.accessible-slots-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}

.accessible-slot {
  position: absolute;
  background: linear-gradient(135deg, #d4f4dd 0%, #a8e6cf 100%);
  border: 2px solid #4caf50;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
  overflow: hidden;
}

.accessible-slot:hover {
  background: linear-gradient(135deg, #c8f0d4 0%, #95ddbf 100%);
  border-color: #388e3c;
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.slot-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  color: #1b5e20;
  padding: 4px;
  text-align: center;
}

.slot-time {
  font-size: 13px;
}

.slot-recurring {
  font-size: 10px;
}
</style>
