<template>
  <Modal :open="isOpen" title="Send Contact Request" @close="handleClose">
    <p class="text-sm" style="color: var(--text-secondary); margin-bottom: var(--space-md);">
      Send a request to {{ tutorName }} to establish contact.
    </p>

    <Textarea
      v-model="message"
      label="Message"
      placeholder="Introduce yourself and explain why you'd like to connect..."
      :rows="4"
      :disabled="isSubmitting"
      :error="validationError || undefined"
      help="Minimum 1 character"
    />

    <div v-if="error" class="error-banner">
      <p>{{ error }}</p>
    </div>

    <template #footer>
      <Button variant="outline" :disabled="isSubmitting" @click="handleClose">
        Cancel
      </Button>
      <Button
        variant="primary"
        :disabled="isSubmitting || !isValid"
        :loading="isSubmitting"
        @click="handleSubmit"
      >
        Send Request
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import Textarea from '@/ui/Textarea.vue'

const props = defineProps<{
  isOpen: boolean
  tutorId: string
  tutorName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const inquiriesStore = useInquiriesStore()

const message = ref('')
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const validationError = ref<string | null>(null)

const isValid = computed(() => {
  return message.value.trim().length >= 1
})

function validateMessage() {
  if (message.value.trim().length < 1) {
    validationError.value = 'Message must be at least 1 character'
    return false
  }
  validationError.value = null
  return true
}

async function handleSubmit() {
  if (!validateMessage()) {
    return
  }

  isSubmitting.value = true
  error.value = null

  try {
    await inquiriesStore.createInquiry(props.tutorId, message.value.trim())
    emit('success')
    handleClose()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to send request'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (!isSubmitting.value) {
    message.value = ''
    error.value = null
    validationError.value = null
    emit('close')
  }
}
</script>

<style scoped>
.error-banner {
  margin-top: var(--space-md);
  padding: var(--space-sm);
  background: var(--danger-bg, #fef2f2);
  border: 1px solid var(--danger, #fecaca);
  border-radius: var(--radius-md);
}

.error-banner p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--danger, #991b1b);
}
</style>
