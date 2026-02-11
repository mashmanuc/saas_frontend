<template>
  <button
    class="tool-btn"
    :class="{ 'tool-btn--active': active }"
    :title="tooltip"
    @click="$emit('click')"
  >
    <span class="tool-btn__icon">{{ icon }}</span>
    <span v-if="tooltip" class="tool-btn__tooltip">
      {{ tooltip }}
      <span v-if="shortcut" class="tool-btn__shortcut">({{ shortcut }})</span>
    </span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  tooltip?: string
  shortcut?: string
  active?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>
