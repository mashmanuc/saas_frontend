<template>
  <div class="form-field">
    <label v-if="label" :for="htmlFor" class="form-field__label">
      {{ label }}<span v-if="required" class="text-danger"> *</span>
    </label>
    <slot />
    <div v-if="error" class="form-field__error">{{ error }}</div>
    <div v-else-if="hint" class="form-field__hint">{{ hint }}</div>
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
  hint: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
  htmlFor: {
    type: String,
    default: '',
  },
})
</script>

<style scoped>
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
