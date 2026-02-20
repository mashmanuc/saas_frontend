<template>
  <div class="page-theme-provider">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore } from './themeStore'

const themeStore = useThemeStore()

onMounted(() => {
  // Ensure data-theme is applied on mount (canonical store uses <html> data-theme)
  themeStore.init()
})
</script>

<style scoped>
.page-theme-provider {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
