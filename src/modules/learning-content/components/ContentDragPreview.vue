<template>
  <div ref="ghostEl" class="lc-drag-ghost" aria-hidden="true">
    <span class="lc-drag-ghost-icon">&#128203;</span>
    <span class="lc-drag-ghost-title">{{ title }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ title: string }>()
const ghostEl = ref<HTMLElement | null>(null)

defineExpose({ ghostEl })
</script>

<style scoped>
.lc-drag-ghost {
  position: fixed;
  top: -9999px;
  left: -9999px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--card-bg);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--shadow);
  font-size: 12px;
  color: var(--text-primary);
  pointer-events: none;
  z-index: 10000;
}
.lc-drag-ghost-icon {
  font-size: 14px;
}
.lc-drag-ghost-title {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
