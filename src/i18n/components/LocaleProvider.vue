<script setup lang="ts">
// F6: Locale Provider Component
import { ref, onMounted } from 'vue'
import { useLocaleStore } from '../stores/localeStore'

const props = defineProps<{
  userPreference?: string
}>()

const localeStore = useLocaleStore()
const isReady = ref(false)

onMounted(async () => {
  try {
    await localeStore.initLocale(props.userPreference)
    await localeStore.loadSupportedLocales()
  } catch (e) {
    console.error('Failed to initialize locale:', e)
  } finally {
    isReady.value = true
  }
})
</script>

<template>
  <slot v-if="isReady" />
  <div v-else class="locale-loading">
    <div class="spinner" />
  </div>
</template>

<style scoped>
.locale-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
