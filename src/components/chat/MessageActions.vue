<template>
  <div class="message-actions">
    <!-- Edit button (only for own messages, within 15 min) -->
    <button
      v-if="canEdit"
      class="action-btn"
      @click="$emit('edit')"
      :title="$t('chat.editMessage')"
    >
      <span class="icon">✏️</span>
    </button>
    
    <!-- Delete button (only for own messages) -->
    <button
      v-if="canDelete"
      class="action-btn"
      @click="handleDelete"
      :title="$t('chat.deleteMessage')"
    >
      <span class="icon">🗑️</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { deleteMessage } from '@/api/messageEdit'
import { notifySuccess, notifyError } from '@/utils/notify'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  currentUserId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['edit', 'deleted'])

const EDIT_TIME_LIMIT = 15 * 60 * 1000 // 15 minutes

const isOwnMessage = computed(() => {
  return props.message.sender_id === props.currentUserId
})

const canEdit = computed(() => {
  if (!isOwnMessage.value) return false
  if (props.message.deleted_at) return false
  
  // Check if within 15 minutes
  const createdAt = new Date(props.message.created_at).getTime()
  const now = Date.now()
  const timeSinceCreation = now - createdAt
  
  return timeSinceCreation < EDIT_TIME_LIMIT
})

const canDelete = computed(() => {
  return isOwnMessage.value && !props.message.deleted_at
})

async function handleDelete() {
  const confirmed = confirm('Ви впевнені, що хочете видалити це повідомлення?')
  if (!confirmed) return
  
  try {
    await deleteMessage(props.message.message_id)
    notifySuccess('Повідомлення видалено')
    emit('deleted', props.message.message_id)
  } catch (err) {
    console.error('Failed to delete message:', err)
    
    const errorMessage = err.response?.data?.error?.message || 'Помилка при видаленні повідомлення'
    notifyError(errorMessage)
  }
}
</script>

<style scoped>
.message-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.message:hover .message-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.icon {
  font-size: 1rem;
  display: inline-block;
}
</style>
