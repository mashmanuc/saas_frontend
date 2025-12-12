<script setup lang="ts">
// F23: Progress Bar Component
defineProps<{
  value: number
  showLabel?: boolean
}>()
</script>

<template>
  <div class="progress-bar">
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: `${Math.min(100, Math.max(0, value))}%` }"
      />
    </div>
    <span v-if="showLabel" class="progress-label">{{ value }}%</span>
  </div>
</template>

<style scoped>
.progress-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-track {
  flex: 1;
  height: 8px;
  background: var(--color-bg-secondary, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary, #3b82f6) 0%, var(--color-primary-dark, #2563eb) 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  min-width: 40px;
  text-align: right;
}
</style>
