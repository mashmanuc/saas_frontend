<template>
  <label class="toggle-wrapper">
    <input
      type="checkbox"
      :checked="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="toggle-track">
      <span class="toggle-thumb" />
    </span>
    <span v-if="label" class="toggle-label">{{ label }}</span>
    <span v-if="description" class="toggle-description">{{ description }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  description?: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.toggle-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
}

.toggle-wrapper input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  display: flex;
  align-items: center;
  width: 48px;
  height: 24px;
  background: var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 2px;
  transition: background 0.2s;
}

.toggle-wrapper input:checked + .toggle-track {
  background: var(--accent-primary, #3b82f6);
}

.toggle-thumb {
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-wrapper input:checked + .toggle-track .toggle-thumb {
  transform: translateX(24px);
}

.toggle-label {
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-description {
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
