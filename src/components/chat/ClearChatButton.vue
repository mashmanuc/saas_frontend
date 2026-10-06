<template>
  <button 
    class="clear-chat-btn"
    @click="handleClearChat"
    :disabled="loading"
    :title="$t('chat.clearHistory')"
  >
    <span v-if="!loading">🗑️ {{ $t('chat.clearHistory') }}</span>
    <span v-else>{{ $t('common.loading') }}...</span>
  </button>
</template>

<script setup>
import { ref } from 'vue'
import { clearChatHistory } from '@/api/messageEdit'
import { notifySuccess, notifyError } from '@/utils/notify'

const props = defineProps({
  threadId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['cleared'])

const loading = ref(false)

async function handleClearChat() {
  const confirmed = confirm('Ви впевнені, що хочете очистити всю історію чату? Цю дію не можна скасувати.')
  if (!confirmed) return
  
  loading.value = true
  
  try {
    const result = await clearChatHistory(props.threadId, {
      clear_mode: 'symmetric'
    })
    
    notifySuccess(`Видалено ${result.deleted_count} повідомлень`)
    emit('cleared', result)
  } catch (err) {
    console.error('Failed to clear chat history:', err)
    
    const errorMessage = err.response?.data?.error?.message || 'Помилка при очищенні історії чату'
    notifyError(errorMessage)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.clear-chat-btn {
  padding: 0.5rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.875rem;
}

.clear-chat-btn:hover:not(:disabled) {
  background: #dc2626;
}

.clear-chat-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Темна тема (Б-156, фаза 2): ті самі селектори, що вище, — кольори токенами теми.
   Згенеровано з правил цього файлу; світла й класична не змінюються. ── */
[data-theme="dark"] .clear-chat-btn {
  background: var(--color-danger);
  color: var(--color-on-accent);
}
[data-theme="dark"] .clear-chat-btn:hover:not(:disabled) {
  background: var(--color-danger);
}
</style>
