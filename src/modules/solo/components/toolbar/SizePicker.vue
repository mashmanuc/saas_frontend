<template>
  <div class="size-picker">
    <button
      v-for="size in presetSizes"
      :key="size"
      class="size-picker__option"
      :class="{ 'size-picker__option--active': modelValue === size }"
      :title="`Size ${size}`"
      @click="$emit('update:modelValue', size)"
    >
      <span
        class="size-picker__dot"
        :style="{ width: `${size * 2}px`, height: `${size * 2}px` }"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: number
  presetSizes: number[]
}>()

defineEmits<{
  'update:modelValue': [size: number]
}>()
</script>
