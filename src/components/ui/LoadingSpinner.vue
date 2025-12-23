<template>
  <div class="loading-spinner" :class="sizeClass">
    <div class="spinner" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const sizeClass = computed(() => `spinner-${props.size}`)
</script>

<style scoped>
.loading-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  border: 2px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm .spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.spinner-md .spinner {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

.spinner-lg .spinner {
  width: 40px;
  height: 40px;
  border-width: 3px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
