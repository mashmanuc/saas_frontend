<template>
  <div class="spinner" role="status" aria-live="polite" aria-busy="true">
    <span class="spinner-ring" aria-hidden="true"></span>
    <span v-if="label" class="spinner-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
}

defineProps<Props>()
</script>

<style scoped>
.spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.spinner-ring {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: 3px solid rgba(0, 0, 0, 0.12);
  border-top-color: var(--color-primary, #3b82f6);
  animation: spin 0.8s linear infinite;
}

.spinner-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
