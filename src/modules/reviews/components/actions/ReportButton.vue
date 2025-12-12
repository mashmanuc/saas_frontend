<script setup lang="ts">
// F17: Report Button Component
import { ref } from 'vue'
import { Flag, X } from 'lucide-vue-next'

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
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <div class="modal-header">
            <h3>Report Review</h3>
            <button class="close-btn" @click="closeModal">
              <X :size="20" />
            </button>
          </div>

          <div class="modal-body">
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
              <textarea
                v-model="details"
                placeholder="Provide more context..."
                rows="3"
              />
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeModal">
              Cancel
            </button>
            <button
              class="btn btn-danger"
              :disabled="!reason || isSubmitting"
              @click="handleSubmit"
            >
              {{ isSubmitting ? 'Submitting...' : 'Submit Report' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
}

.close-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.form-group select,
.form-group textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-danger {
  background: var(--color-danger, #ef4444);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-dark, #dc2626);
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
