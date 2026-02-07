<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('chat.editMessage') }}</h3>
        <button class="close-btn" @click="handleClose" aria-label="Close">×</button>
      </div>
      
      <div class="modal-body">
        <textarea
          v-model="editedBody"
          class="edit-textarea"
          :placeholder="$t('chat.editMessagePlaceholder')"
          rows="4"
          maxlength="5000"
          @keydown.esc="handleClose"
        />
        
        <div v-if="timeRemaining > 0" class="time-remaining">
          {{ $t('chat.timeRemaining') }}: {{ formatTimeRemaining(timeRemaining) }}
        </div>
        <div v-else class="time-expired">
          {{ $t('chat.editTimeExpired') }}
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose" :disabled="loading">
          {{ $t('common.cancel') }}
        </button>
        <button 
          class="btn btn-primary" 
          @click="handleSave" 
          :disabled="loading || !canSave"
        >
          <span v-if="!loading">{{ $t('common.save') }}</span>
          <span v-else>{{ $t('common.saving') }}...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { editMessage } from '@/api/messageEdit'
import { notifySuccess, notifyError } from '@/utils/notify'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  message: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'updated'])

const editedBody = ref('')
const loading = ref(false)
const error = ref('')
const timeRemaining = ref(0)
let intervalId = null

const EDIT_TIME_LIMIT = 15 * 60 * 1000 // 15 minutes in milliseconds

const canSave = computed(() => {
  return editedBody.value.trim().length > 0 && 
         editedBody.value !== props.message.body &&
         timeRemaining.value > 0
})

function calculateTimeRemaining() {
  if (!props.message?.created_at) return 0
  
  const createdAt = new Date(props.message.created_at).getTime()
  const deadline = createdAt + EDIT_TIME_LIMIT
  const remaining = Math.max(0, deadline - Date.now())
  
  return remaining
}

function formatTimeRemaining(ms) {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function updateTimeRemaining() {
  timeRemaining.value = calculateTimeRemaining()
}

async function handleSave() {
  if (!canSave.value) return
  
  loading.value = true
  error.value = ''
  
  try {
    const updatedMessage = await editMessage(props.message.message_id, {
      body: editedBody.value.trim()
    })
    
    notifySuccess('Повідомлення оновлено')
    emit('updated', updatedMessage)
    handleClose()
  } catch (err) {
    console.error('Failed to edit message:', err)
    
    if (err.response?.data?.error?.code === 'EDIT_TIME_EXPIRED') {
      error.value = 'Час для редагування вичерпано (15 хвилин)'
    } else if (err.response?.data?.error?.code === 'VALIDATION_ERROR') {
      error.value = 'Повідомлення не може бути порожнім'
    } else {
      error.value = err.response?.data?.error?.message || 'Помилка при редагуванні повідомлення'
    }
    
    notifyError(error.value)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    editedBody.value = props.message.body || ''
    error.value = ''
    updateTimeRemaining()
    
    // Start countdown timer
    intervalId = setInterval(updateTimeRemaining, 1000)
  } else {
    // Clear timer
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
})

onMounted(() => {
  if (props.isOpen) {
    updateTimeRemaining()
    intervalId = setInterval(updateTimeRemaining, 1000)
  }
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.close-btn:hover {
  color: #374151;
}

.modal-body {
  padding: 1.5rem;
}

.edit-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
}

.edit-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.time-remaining {
  margin-top: 0.75rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.time-expired {
  margin-top: 0.75rem;
  color: #ef4444;
  font-size: 0.875rem;
  font-weight: 500;
}

.error-message {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}
</style>
