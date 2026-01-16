<template>
  <div class="remote-cursors">
    <div
      v-for="cursor in activeCursors"
      :key="cursor.userId"
      class="remote-cursor"
      :style="{
        left: `${cursor.x}px`,
        top: `${cursor.y}px`,
        color: cursor.color
      }"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="cursor-icon"
      >
        <path
          d="M5 3L19 12L12 13L9 20L5 3Z"
          :fill="cursor.color"
          stroke="white"
          stroke-width="1.5"
        />
      </svg>
      <div class="cursor-label" :style="{ backgroundColor: cursor.color }">
        {{ cursor.userName }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RemoteCursor } from '@/core/whiteboard/adapters/RealtimeAdapter'

interface Props {
  cursors: Map<string, RemoteCursor>
  maxAge?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxAge: 5000
})

const activeCursors = computed(() => {
  const now = Date.now()
  const active: RemoteCursor[] = []
  
  props.cursors.forEach((cursor) => {
    if (now - cursor.timestamp < props.maxAge) {
      active.push(cursor)
    }
  })
  
  return active
})
</script>

<style scoped>
.remote-cursors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

.remote-cursor {
  position: absolute;
  pointer-events: none;
  transition: all 0.1s ease-out;
  transform: translate(-2px, -2px);
}

.cursor-icon {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.cursor-label {
  position: absolute;
  top: 20px;
  left: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>
