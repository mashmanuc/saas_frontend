<script setup lang="ts">
// F15: Tutor Response Form Component
import { ref, computed } from 'vue'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'

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

    <Textarea
      v-model="content"
      placeholder="Thank the student for their feedback or address any concerns..."
      :maxlength="maxLength"
      :rows="4"
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
        <Button variant="secondary" size="sm" @click="emit('cancel')">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          :disabled="!isValid"
          :loading="isSubmitting"
          @click="handleSubmit"
        >
          {{ isEditing ? 'Update' : 'Send Response' }}
        </Button>
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
  gap: var(--space-xs);
}
</style>
