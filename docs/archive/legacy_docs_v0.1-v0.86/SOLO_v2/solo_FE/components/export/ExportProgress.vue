<template>
  <div class="export-progress">
    <div class="export-progress__bar">
      <div
        class="export-progress__fill"
        :style="{ width: `${progress}%` }"
      />
    </div>
    <div class="export-progress__info">
      <span class="export-progress__percent">{{ Math.round(progress) }}%</span>
      <span v-if="status" class="export-progress__status">{{ status }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  progress: number
  status?: string
}>()
</script>

<style scoped>
.export-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.export-progress__bar {
  height: 8px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 4px;
  overflow: hidden;
}

.export-progress__fill {
  height: 100%;
  background: var(--accent-color, #3b82f6);
  transition: width 0.3s ease;
}

.export-progress__info {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.export-progress__percent {
  font-weight: 500;
}

.export-progress__status {
  color: var(--text-secondary, #6b7280);
}
</style>
