<template>
  <div class="availability-layer">
    <div
      v-for="range in blockedRanges"
      :key="range.id"
      class="blocked-range"
      :style="getRangeStyle(range)"
      :title="range.reason"
    >
      <div class="blocked-label">{{ range.reason }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface BlockedRange {
  id: number
  start: string
  end: string
  reason: string
}

const props = defineProps<{
  blockedRanges: BlockedRange[]
  pxPerMinute: number
}>()

const getRangeStyle = (range: BlockedRange) => {
  const start = new Date(range.start)
  const end = new Date(range.end)
  
  const minutesFromDayStart = start.getHours() * 60 + start.getMinutes()
  const durationMinutes = (end.getTime() - start.getTime()) / 60000
  
  return {
    top: `${minutesFromDayStart * props.pxPerMinute}px`,
    height: `${durationMinutes * props.pxPerMinute}px`
  }
}
</script>

<style scoped>
.availability-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  pointer-events: none;
}

.blocked-range {
  position: absolute;
  left: 0;
  right: 0;
  background: repeating-linear-gradient(
    45deg,
    #fafafa,
    #fafafa 10px,
    #f0f0f0 10px,
    #f0f0f0 20px
  );
  border: 1px dashed #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.blocked-label {
  font-size: 12px;
  color: #666;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
  pointer-events: auto;
}
</style>
