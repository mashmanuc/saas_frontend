<template>
  <div class="ui-card" :class="customClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ class?: string }>()
const customClass = computed(() => props.class ?? '')
</script>

<style scoped>
.ui-card {
  @apply rounded-lg bg-white shadow-sm border border-gray-200;
}
</style>
