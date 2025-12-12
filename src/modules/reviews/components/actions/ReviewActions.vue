<script setup lang="ts">
// F18: Review Actions Component (Edit/Delete)
import { ref } from 'vue'
import { Edit, Trash2, X } from 'lucide-vue-next'

defineProps<{
  canEdit: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const showConfirm = ref(false)

function confirmDelete() {
  showConfirm.value = true
}

function cancelDelete() {
  showConfirm.value = false
}

function handleDelete() {
  emit('delete')
  showConfirm.value = false
}
</script>

<template>
  <div class="review-actions">
    <!-- Edit Button -->
    <button v-if="canEdit" class="action-btn" @click="emit('edit')">
      <Edit :size="16" />
      Edit
    </button>

    <!-- Delete Button -->
    <button v-if="canEdit" class="action-btn danger" @click="confirmDelete">
      <Trash2 :size="16" />
      Delete
    </button>

    <!-- Confirm Dialog -->
    <Teleport to="body">
      <div v-if="showConfirm" class="modal-overlay" @click.self="cancelDelete">
        <div class="confirm-dialog">
          <h4>Delete Review?</h4>
          <p>This action cannot be undone. Your review will be permanently deleted.</p>

          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="cancelDelete">
              Cancel
            </button>
            <button class="btn btn-danger" @click="handleDelete">
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.review-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.action-btn.danger {
  color: var(--color-danger, #ef4444);
  border-color: var(--color-danger, #ef4444);
}

.action-btn.danger:hover {
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

.confirm-dialog {
  width: 100%;
  max-width: 360px;
  padding: 24px;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  text-align: center;
}

.confirm-dialog h4 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.confirm-dialog p {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 10px 20px;
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

.btn-danger:hover {
  background: var(--color-danger-dark, #dc2626);
}
</style>
