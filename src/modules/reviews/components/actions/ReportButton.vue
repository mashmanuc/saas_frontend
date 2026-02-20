<script setup lang="ts">
// F17: Report Button Component
import { ref } from 'vue'
import { Flag, X } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import Textarea from '@/ui/Textarea.vue'

const emit = defineEmits<{
  report: [reason: string, details?: string]
}>()

const showModal = ref(false)
const reason = ref('')
const details = ref('')
const isSubmitting = ref(false)

const reasons = [
  { value: 'spam', label: 'Spam or fake review' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'misleading', label: 'Misleading information' },
  { value: 'other', label: 'Other' },
]

function openModal() {
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  reason.value = ''
  details.value = ''
}

function handleSubmit() {
  if (!reason.value) return

  isSubmitting.value = true
  emit('report', reason.value, details.value || undefined)

  setTimeout(() => {
    isSubmitting.value = false
    closeModal()
  }, 500)
}
</script>

<template>
  <div class="report-button-wrapper">
    <button class="report-btn" @click="openModal">
      <Flag :size="14" />
    </button>

    <!-- Modal -->
    <Modal
      :open="showModal"
      title="Report Review"
      size="sm"
      @close="closeModal"
    >
      <div class="form-group">
        <label>Reason for reporting</label>
        <select v-model="reason">
          <option value="">Select a reason</option>
          <option v-for="r in reasons" :key="r.value" :value="r.value">
            {{ r.label }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>Additional details (optional)</label>
        <Textarea
          v-model="details"
          placeholder="Provide more context..."
          :rows="3"
        />
      </div>

      <template #footer>
        <Button variant="secondary" size="sm" @click="closeModal">
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          :disabled="!reason"
          :loading="isSubmitting"
          @click="handleSubmit"
        >
          Submit Report
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.report-button-wrapper {
  display: inline-flex;
}

.report-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-tertiary, #9ca3af);
  cursor: pointer;
  transition: all 0.15s;
}

.report-btn:hover {
  color: var(--color-danger, #ef4444);
  background: var(--color-danger-light, #fee2e2);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: var(--space-md);
}

.form-group label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.form-group select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  background: var(--card-bg);
  color: var(--text-primary);
}

.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
