<template>
  <div class="color-picker">
    <button
      v-for="color in presetColors"
      :key="color"
      class="color-picker__preset"
      :class="{ 'color-picker__preset--active': modelValue === color }"
      :style="{ backgroundColor: color }"
      :title="color"
      @click="$emit('update:modelValue', color)"
    />
    <input
      type="color"
      class="color-picker__custom"
      :value="modelValue"
      title="Custom color"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  presetColors: string[]
}>()

defineEmits<{
  'update:modelValue': [color: string]
}>()
</script>
