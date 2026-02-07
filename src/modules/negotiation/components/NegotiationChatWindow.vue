<template>
  <Card class="negotiation-chat h-full flex flex-col" padding="none">
    <!-- Header -->
    <header class="chat-header">
      <div class="flex items-center gap-3">
        <Avatar :text="otherUserName" size="md" />
        <div>
          <h3 class="font-semibold" style="color: var(--text-primary);">
            {{ otherUserName }}
          </h3>
          <p class="text-xs" style="color: var(--text-secondary);">
            {{ isWritable ? 'Активний чат' : 'Тільки читання' }}
          </p>
        </div>
      </div>
      <Badge v-if="unreadCount > 0" variant="primary">
        {{ unreadCount }} нових
      </Badge>
    </header>

    <!-- Messages list -->
    <div
      ref="messagesContainerRef"
      class="chat-messages flex-1 overflow-y-auto"
      @scroll="handleScroll"
    >
      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>

      <!-- Empty state -->
      <EmptyState
        v-else-if="messages.length === 0"
        title="Немає повідомлень"
        description="Почніть розмову першим!"
      />

      <!-- Messages - без TransitionGroup для уникнення "дьоргання" -->
      <div
        v-else
        class="space-y-4"
      >
        <NegotiationChatMessage
          v-for="message in messages"
          :key="message.message_id || message.id"
          v-memo="[message.message_id, message.is_read, message.body]"
          :message="message"
          :current-user-id="currentUserId"
        />
      </div>
    </div>

    <!-- Error -->
    <Alert
      v-if="error"
      variant="danger"
      title="Помилка"
      :description="error"
      class="mx-4 mb-2"
    />

    <!-- Input (окремий компонент - НЕ перерендерюється при оновленні messages!) -->
    <NegotiationChatInput
      ref="inputRef"
      :disabled="!isWritable"
      :sending="isSending"
      placeholder="Напишіть повідомлення..."
      @send="handleSend"
    />
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatPolling } from '@/composables/useChatPolling'
import Card from '@/ui/Card.vue'
import Avatar from '@/ui/Avatar.vue'
import Badge from '@/ui/Badge.vue'
import Alert from '@/ui/Alert.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import EmptyState from '@/ui/EmptyState.vue'
import NegotiationChatMessage from './NegotiationChatMessage.vue'
import NegotiationChatInput from './NegotiationChatInput.vue'

const props = defineProps<{
  threadId: string
  currentUserId: number
  otherUserName: string
}>()

// ✅ SMART POLLING
const {
  messages,
  isLoading,
  isSending,
  isWritable,
  error,
  unreadCount,
  sendMessage,
  markAllAsRead
} = useChatPolling(
  computed(() => props.threadId),
  computed(() => props.currentUserId)
)

const messagesContainerRef = ref<HTMLElement | null>(null)
const inputRef = ref<InstanceType<typeof NegotiationChatInput> | null>(null)
const isAtBottom = ref(true)

// ✅ Auto-scroll тільки якщо user внизу (без анімації для уникнення "дьоргання")
function scrollToBottomIfNeeded(): void {
  if (!isAtBottom.value) return

  nextTick(() => {
    const container = messagesContainerRef.value
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'auto' // ⚠️ Змінено з 'smooth' на 'auto'
      })
    }
  })
}

function handleScroll(): void {
  const container = messagesContainerRef.value
  if (!container) return

  const threshold = 100
  isAtBottom.value =
    container.scrollHeight - container.scrollTop <= container.clientHeight + threshold
}

// ✅ SEND MESSAGE
async function handleSend(text: string): Promise<void> {
  const result = await sendMessage(text)
  if (result) {
    scrollToBottomIfNeeded()
  }
}

// Watch for new messages -> scroll (тільки якщо кількість змінилася)
const previousLength = ref(0)
watch(
  () => messages.value.length,
  (newLength) => {
    if (newLength !== previousLength.value && newLength > previousLength.value) {
      previousLength.value = newLength
      scrollToBottomIfNeeded()
    }
  }
)

// Mark as read when window is visible
onMounted(() => {
  // Initial scroll to bottom
  nextTick(() => {
    const container = messagesContainerRef.value
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })

  // Mark messages as read
  markAllAsRead()
})
</script>

<style scoped>
.negotiation-chat {
  display: flex;
  flex-direction: column;
  min-height: 400px;
  max-height: 80vh;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle, rgba(7, 15, 30, 0.08));
}

.chat-messages {
  padding: 1.5rem;
  /* ⚠️ Видалено radial-gradient background для уникнення перерахунку */
  background-color: var(--surface-soft, #f8fafc);
}

/* ⚠️ CSS transitions видалено для уникнення "дьоргання" */
</style>
