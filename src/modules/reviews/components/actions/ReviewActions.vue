<script setup lang="ts">
// F18: Review Actions Component (Edit/Delete)
import { ref } from 'vue'
import { Edit, Trash2, X } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'

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
    <Button v-if="canEdit" variant="ghost" size="sm" @click="emit('edit')">
      <Edit :size="16" />
      Edit
    </Button>

    <!-- Delete Button -->
    <Button v-if="canEdit" variant="danger" size="sm" @click="confirmDelete">
      <Trash2 :size="16" />
      Delete
    </Button>

    <!-- Confirm Dialog -->
    <Modal
      :open="showConfirm"
      title="Delete Review?"
      size="sm"
      @close="cancelDelete"
    >
      <p class="confirm-text">This action cannot be undone. Your review will be permanently deleted.</p>

      <template #footer>
        <Button variant="secondary" size="sm" @click="cancelDelete">
          Cancel
        </Button>
        <Button variant="danger" size="sm" @click="handleDelete">
          Delete
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.review-actions {
  display: flex;
  gap: var(--space-xs);
}

.confirm-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>
