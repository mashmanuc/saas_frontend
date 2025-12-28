<template>
  <div class="accessible-slots-layer">
    <div
      v-for="slot in accessibleSlots"
      :key="slot.id"
      class="accessible-slot"
      :style="getSlotStyle(slot)"
      :title="`Доступно: ${formatTime(slot.start)} - ${formatTime(slot.end)}`"
      @click="$emit('slot-click', slot)"
    >
      <div class="slot-label">
        <span class="slot-time">{{ formatTime(slot.start) }}</span>
        <span v-if="slot.is_recurring" class="slot-recurring">🔁</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface AccessibleSlot {
  id: number
  start: string
  end: string
  is_recurring: boolean
}

const props = defineProps<{
  accessibleSlots: AccessibleSlot[]
  pxPerMinute: number
}>()

const emit = defineEmits<{
  'slot-click': [slot: AccessibleSlot]
}>()

const getSlotStyle = (slot: AccessibleSlot) => {
  const start = new Date(slot.start)
  const end = new Date(slot.end)
  const minutesFromDayStart = start.getHours() * 60 + start.getMinutes()
  const durationMinutes = (end.getTime() - start.getTime()) / 60000

  return {
    top: `${minutesFromDayStart * props.pxPerMinute}px`,
    height: `${durationMinutes * props.pxPerMinute}px`,
    left: `4px`,
    right: `4px`
  }
}

const formatTime = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
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
