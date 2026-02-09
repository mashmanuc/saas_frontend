<template>
  <button
    class="report-spam-button"
    :class="{ 'reported': reported }"
    :disabled="disabled || reported"
    @click="onClick"
  >
    <i :class="reported ? 'icon-check' : 'icon-flag'"></i>
    <span>{{ reported ? $t('inquiries.spam.reported') : $t('inquiries.spam.report') }}</span>
  </button>
</template>

<script setup>
const props = defineProps({
  reported: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

function onClick() {
  if (!props.reported && !props.disabled) {
    emit('click')
  }
}
</script>

<style scoped>
.report-spam-button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.report-spam-button:hover:not(:disabled) {
  background: var(--color-error-subtle);
  border-color: var(--color-error);
  color: var(--color-error);
}

.report-spam-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.report-spam-button.reported {
  background: var(--color-success-subtle);
  border-color: var(--color-success);
  color: var(--color-success);
  cursor: default;
}

.report-spam-button i {
  font-size: 14px;
}
</style>
