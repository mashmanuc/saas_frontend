<template>
  <Transition name="fade">
    <div v-if="isLoading" class="loader-overlay" aria-live="polite">
      <div class="loader-panel" role="status">
        <span class="loader-spinner" aria-hidden="true"></span>
        <p class="text-sm font-medium text-primary">{{ $t('loader.loading') }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useLoaderStore } from '../stores/loaderStore'

const loader = useLoaderStore()
const { isLoading } = storeToRefs(loader)
</script>

<style scoped>
.fade-enter-active {
  transition: opacity 0.2s ease;
}
.fade-leave-active {
  transition: opacity 0.2s ease;
  pointer-events: none; /* Не блокуємо кліки під час fade-out */
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
