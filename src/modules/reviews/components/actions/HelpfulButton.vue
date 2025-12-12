<script setup lang="ts">
// F16: Helpful Button Component
import { ThumbsUp } from 'lucide-vue-next'

defineProps<{
  count: number
  active?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="helpful-btn"
    :class="{ active }"
    @click="$emit('click')"
  >
    <ThumbsUp :size="16" :fill="active ? 'currentColor' : 'none'" />
    <span>Helpful{{ count > 0 ? ` (${count})` : '' }}</span>
  </button>
</template>

<style scoped>
.helpful-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 20px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.helpful-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

.helpful-btn.active {
  background: var(--color-primary-light, #dbeafe);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}
</style>
