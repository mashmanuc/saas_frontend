<template>
  <input
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    class="ui-input"
    :placeholder="placeholder"
    :type="type"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
  type?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped>
.ui-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  font-size: 0.9375rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.ui-input:focus {
  outline: none;
  border-color: var(--accent-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>
