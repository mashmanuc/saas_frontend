<template>
  <div class="form-field">
    <label v-if="label" :for="inputId" class="form-field__label">
      {{ label }}<span v-if="required" class="text-danger"> *</span>
    </label>
    <textarea
      :id="inputId"
      :value="modelValue"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      class="input"
      :class="{ error: !!error }"
      @input="onInput"
    />
    <div v-if="maxlength" class="form-field__hint" style="text-align: right;">
      {{ modelValue?.length || 0 }}/{{ maxlength }}
    </div>
    <div v-if="error" class="form-field__error">{{ error }}</div>
    <div v-else-if="help" class="form-field__hint">{{ help }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
  rows: {
    type: Number,
    default: 3,
  },
  maxlength: {
    type: Number,
    default: undefined,
  },
  error: {
    type: String,
    default: '',
  },
  help: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

const inputId = computed(() => {
  return props.id || 'textarea-' + Math.random().toString(36).slice(2)
})

function onInput(event) {
  emit('update:modelValue', event.target.value)
}
</script>

<style scoped>
textarea.input {
  resize: vertical;
  min-height: 4.5rem;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}
.form-field__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}
.form-field__error {
  font-size: var(--text-xs);
  color: var(--danger-bg);
}
.form-field__hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
</style>
