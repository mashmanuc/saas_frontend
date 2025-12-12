<script setup lang="ts">
// F15: Tutor Response Form Component
import { ref, computed } from 'vue'

const props = defineProps<{
  existingResponse?: string
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  submit: [content: string]
  cancel: []
}>()

const content = ref(props.existingResponse || '')
const maxLength = 1000

const contentLength = computed(() => content.value.length)
const isValid = computed(() => content.value.trim().length >= 10)
const isEditing = computed(() => !!props.existingResponse)

function handleSubmit() {
  if (!isValid.value) return
  emit('submit', content.value.trim())
}
</script>

<template>
  <div class="response-form">
    <div class="form-header">
      <h4>{{ isEditing ? 'Edit Response' : 'Write a Response' }}</h4>
    </div>

    <textarea
      v-model="content"
      class="textarea"
      placeholder="Thank the student for their feedback or address any concerns..."
      :maxlength="maxLength"
      rows="4"
    />

    <div class="form-footer">
      <div class="char-info">
        <span v-if="content.length < 10" class="hint error">
          Minimum 10 characters
        </span>
        <span class="char-count" :class="{ warning: contentLength > maxLength * 0.9 }">
          {{ contentLength }}/{{ maxLength }}
        </span>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" @click="emit('cancel')">
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!isValid || isSubmitting"
          @click="handleSubmit"
        >
          {{ isSubmitting ? 'Sending...' : isEditing ? 'Update' : 'Send Response' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.response-form {
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  border-left: 3px solid var(--color-primary, #3b82f6);
}

.form-header h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.15s;
}

.textarea:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.char-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.hint.error {
  color: var(--color-danger, #ef4444);
}

.char-count {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.char-count.warning {
  color: var(--color-warning, #f59e0b);
}

.form-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}
</style>
