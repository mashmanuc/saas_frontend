<template>
  <div class="form-field">
    
    <!-- LABEL -->
    <label
      v-if="label"
      :for="id"
      class="form-field__label"
    >
      {{ label }}
      <span v-if="required" class="text-danger"> *</span>
    </label>

    <!-- INPUT WRAPPER -->
    <div class="relative">
      <input
        :id="id"
        v-bind="cleanAttrs"
        :type="type"
        :value="modelValue"
        :disabled="disabled"
        @input="$emit('update:modelValue', $event.target.value)"
        class="input"
        :class="{
          'error': !!error,
          'disabled': disabled
        }"
      />
    </div>

    <!-- ERROR MESSAGE -->
    <p v-if="error" class="form-field__error">
      {{ error }}
    </p>

    <!-- HELP TEXT -->
    <p v-else-if="help" class="form-field__hint">
      {{ help }}
    </p>

  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  label: String,
  type: {
    type: String,
    default: 'text',
  },
  error: {
    type: String,
    default: '',
  },
  help: {
    type: String,
    default: '',
  },
  required: Boolean,
  disabled: Boolean,
  id: {
    type: String,
    default: () => 'input-' + Math.random().toString(36).slice(2),
  }
})

defineEmits(['update:modelValue'])

const attrs = useAttrs()
const cleanAttrs = computed(() => {
  const { class: _omit, ...rest } = attrs
  return rest
})
</script>
