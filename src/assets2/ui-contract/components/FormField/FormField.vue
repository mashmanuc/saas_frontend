<script setup lang="ts">
import { computed, useSlots } from 'vue';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'textarea';
export type ValidationState = 'default' | 'error' | 'success';

export interface FormFieldProps {
  modelValue?: string | number;
  label?: string;
  type?: InputType;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  state?: ValidationState;
  maxLength?: number;
  showCharCount?: boolean;
  horizontal?: boolean;
  name?: string;
  id?: string;
  autocomplete?: string;
  rows?: number;
}

const props = withDefaults(defineProps<FormFieldProps>(), {
  modelValue: '',
  type: 'text',
  required: false,
  disabled: false,
  readonly: false,
  state: 'default',
  showCharCount: false,
  horizontal: false,
  rows: 4,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();

const slots = useSlots();

const inputId = computed(() => props.id || `field-${Math.random().toString(36).slice(2, 9)}`);

const validationState = computed(() => {
  if (props.errorText) return 'error';
  return props.state;
});

const charCount = computed(() => String(props.modelValue).length);
const charCountClass = computed(() => {
  if (!props.maxLength) return '';
  const ratio = charCount.value / props.maxLength;
  if (ratio >= 1) return 'atLimit';
  if (ratio >= 0.9) return 'nearLimit';
  return '';
});

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};
</script>

<template>
  <div :class="[$style.field, { [$style.fieldHorizontal]: horizontal }]">
    <!-- Label -->
    <label
      v-if="label"
      :for="inputId"
      :class="[$style.label, { [$style.labelHorizontal]: horizontal, [$style.required]: required }]"
    >
      {{ label }}
    </label>

    <!-- Input wrapper -->
    <div :class="$style.inputWrapper">
      <!-- Icon Left -->
      <span v-if="slots.iconLeft" :class="$style.iconLeft">
        <slot name="iconLeft" />
      </span>

      <!-- Textarea -->
      <textarea
        v-if="type === 'textarea'"
        :id="inputId"
        :value="modelValue"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :maxlength="maxLength"
        :rows="rows"
        :class="[$style.input, $style.textarea, {
          [$style.error]: validationState === 'error',
          [$style.success]: validationState === 'success',
          [$style.hasIconLeft]: slots.iconLeft,
          [$style.hasIconRight]: slots.iconRight,
        }]"
        @input="handleInput"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
      />

      <!-- Input -->
      <input
        v-else
        :id="inputId"
        :type="type"
        :value="modelValue"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :maxlength="maxLength"
        :autocomplete="autocomplete"
        :class="[$style.input, {
          [$style.error]: validationState === 'error',
          [$style.success]: validationState === 'success',
          [$style.hasIconLeft]: slots.iconLeft,
          [$style.hasIconRight]: slots.iconRight,
        }]"
        @input="handleInput"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
      />

      <!-- Icon Right -->
      <span v-if="slots.iconRight" :class="$style.iconRight">
        <slot name="iconRight" />
      </span>
    </div>

    <!-- Helper text -->
    <p v-if="helperText && !errorText" :class="$style.helper">{{ helperText }}</p>

    <!-- Error text -->
    <p v-if="errorText" :class="$style.errorText">
      <svg :class="$style.errorIcon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      {{ errorText }}
    </p>

    <!-- Character count -->
    <p v-if="showCharCount && maxLength" :class="[$style.charCount, $style[charCountClass]]">
      {{ charCount }} / {{ maxLength }}
    </p>
  </div>
</template>

<style module>
.field { display: flex; flex-direction: column; gap: var(--ui-space-xs, 0.25rem); width: 100%; }
.fieldHorizontal { flex-direction: row; align-items: flex-start; gap: var(--ui-space-md, 0.75rem); }

.label {
  display: flex;
  align-items: center;
  gap: var(--ui-space-xs, 0.25rem);
  font-size: var(--ui-font-size-sm, 0.875rem);
  font-weight: var(--ui-font-weight-medium, 500);
  color: var(--ui-color-text, #0d4a3e);
}
.labelHorizontal { min-width: 8rem; padding-top: var(--ui-space-sm, 0.5rem); }
.required::after { content: '*'; color: var(--ui-color-danger, #ef4444); margin-left: 2px; }

.inputWrapper { position: relative; flex: 1; }

.input {
  width: 100%;
  height: var(--ui-input-height, 2.5rem);
  padding: 0 var(--ui-space-md, 0.75rem);
  background-color: var(--ui-color-surface, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-md, 0.5rem);
  color: var(--ui-color-text, #0d4a3e);
  font-family: var(--ui-font-family, inherit);
  font-size: var(--ui-font-size-md, 1rem);
  transition: all var(--ui-transition-fast, 150ms);
  outline: none;
}
.input::placeholder { color: var(--ui-color-text-muted, #1f6b5a); }
.input:hover:not(:disabled):not(.error) { border-color: color-mix(in srgb, var(--ui-color-primary, #059669) 50%, transparent); }
.input:focus:not(.error) { border-color: var(--ui-color-primary, #059669); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary, #059669) 15%, transparent); }
.input:disabled { opacity: 0.6; cursor: not-allowed; }

.textarea { height: auto; min-height: 5rem; padding: var(--ui-space-sm, 0.5rem) var(--ui-space-md, 0.75rem); resize: vertical; line-height: var(--ui-line-height, 1.5); }

.input.error { border-color: var(--ui-color-danger, #ef4444); }
.input.error:focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-danger, #ef4444) 15%, transparent); }
.input.success { border-color: var(--ui-color-success, #10b981); }
.input.success:focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-success, #10b981) 15%, transparent); }

.hasIconLeft { padding-left: 2.5rem; }
.hasIconRight { padding-right: 2.5rem; }

.iconLeft, .iconRight {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: var(--ui-color-text-muted, #1f6b5a);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.iconLeft { left: var(--ui-space-md, 0.75rem); }
.iconRight { right: var(--ui-space-md, 0.75rem); }

.helper, .errorText { font-size: var(--ui-font-size-xs, 0.75rem); margin-top: var(--ui-space-xs, 0.25rem); }
.helper { color: var(--ui-color-text-muted, #1f6b5a); }
.errorText { color: var(--ui-color-danger, #ef4444); display: flex; align-items: center; gap: var(--ui-space-xs, 0.25rem); }
.errorIcon { width: 0.875rem; height: 0.875rem; flex-shrink: 0; }

.charCount { font-size: var(--ui-font-size-xs, 0.75rem); color: var(--ui-color-text-muted, #1f6b5a); text-align: right; margin-top: var(--ui-space-xs, 0.25rem); }
.charCount.nearLimit { color: var(--ui-color-warning, #f59e0b); }
.charCount.atLimit { color: var(--ui-color-danger, #ef4444); }
</style>
