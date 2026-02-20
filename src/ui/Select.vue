<template>
  <div class="select-field">
    <label v-if="label" :for="id" class="select-field__label">
      {{ label }}
    </label>
    <div class="select-field__control">
      <select
        :id="id"
        v-bind="cleanAttrs"
        :multiple="multiple"
        :disabled="disabled"
        class="select"
        :value="modelValue"
        @change="handleChange"
      >
        <option v-if="placeholder && !multiple" value="">
          {{ placeholder }}
        </option>
        <option
          v-for="option in options"
          :key="option.value ?? option"
          :value="option.value ?? option"
        >
          {{ option.label ?? option }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Array, Object, null],
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  label: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  multiple: Boolean,
  disabled: Boolean,
  id: {
    type: String,
    default: () => 'select-' + Math.random().toString(36).slice(2),
  },
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
const cleanAttrs = computed(() => {
  const { class: _omit, ...rest } = attrs
  return rest
})

function handleChange(event) {
  const { options } = event.target
  if (props.multiple) {
    const value = Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value)
    emit('update:modelValue', value)
  } else {
    const value = event.target.value || ''
    emit('update:modelValue', value)
  }
}
</script>

<style scoped>
.select-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.select-field__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.select {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-secondary);
  font: inherit;
  color: var(--text-primary);
  transition: var(--transition-fast);
}
.select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}
</style>
