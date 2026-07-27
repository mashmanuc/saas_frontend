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
    <div class="input-wrapper">
      <input
        :id="id"
        v-bind="cleanAttrs"
        :type="resolvedType"
        :value="modelValue"
        :disabled="disabled"
        @input="$emit('update:modelValue', $event.target.value)"
        class="input"
        :class="{
          'error': !!error,
          'disabled': disabled,
          'input--has-toggle': type === 'password'
        }"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="input-toggle-btn"
        tabindex="-1"
        @click="togglePasswordVisibility"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
      >
        <EyeOff v-if="showPassword" :size="18" />
        <Eye v-else :size="18" />
      </button>
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
import { computed, ref, useAttrs } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

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

const showPassword = ref(false)

const resolvedType = computed(() => {
  if (props.type === 'password' && showPassword.value) return 'text'
  return props.type
})

function togglePasswordVisibility() {
  showPassword.value = !showPassword.value
}

const attrs = useAttrs()
const cleanAttrs = computed(() => {
  const { class: _omit, ...rest } = attrs
  return rest
})
</script>

<style scoped>
/* Дзеркалить FormField.vue / Textarea.vue — той самий паттерн, тут його
   бракувало: .form-field__error ніде не мав кольору й зливався зі звичайним
   текстом, тож помилку не було видно з першого погляду. */
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
