<template>
  <Card class="negotiation-chat h-full flex flex-col" padding="none">
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

    <div
      ref="messagesContainerRef"
      class="chat-messages flex-1 overflow-y-auto"
      @scroll="handleScroll"
    >
      <div v-if="store.isLoading" class="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>

      <EmptyState
        v-else-if="messages.length === 0"
        title="Немає повідомлень"
        description="Почніть розмову першим!"
      />

      <div v-else class="space-y-4">
        <NegotiationChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :current-user-id="currentUserId"
        />
      </div>
    </div>

    <Alert
      v-if="store.error"
      variant="danger"
      title="Помилка"
      :description="store.error"
      class="mx-4 mb-2"
    />

    <NegotiationChatInput
      ref="inputRef"
      :disabled="!isWritable"
      :sending="store.isSending"
      placeholder="Напишіть повідомлення..."
      @send="handleSend"
    />
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useNegotiationChatStore } from '@/stores/negotiationChatStore'
import { wsIsConnected } from '@/composables/useChatWebSocket'
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

const store = useNegotiationChatStore()

const messages = computed(() => store.currentMessages)
const isWritable = computed(() => !(store.activeThread?.readOnly ?? false))
const unreadCount = computed(() => 
  messages.value.filter(m => !m.is_read && m.sender_id !== props.currentUserId).length
)

const messagesContainerRef = ref<HTMLElement | null>(null)
const inputRef = ref<InstanceType<typeof NegotiationChatInput> | null>(null)
const isAtBottom = ref(true)
const historyLoaded = ref(false)

function scrollToBottomIfNeeded(): void {
  if (!isAtBottom.value) return
  nextTick(() => {
    const container = messagesContainerRef.value
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
    }
  })
}

function handleScroll(): void {
  const container = messagesContainerRef.value
  if (!container) return
  const threshold = 100
  isAtBottom.value = container.scrollHeight - container.scrollTop <= container.clientHeight + threshold
}

async function handleSend(text: string): Promise<void> {
  if (!props.threadId || !text.trim()) return
  
  const success = await store.sendMessage(props.threadId, text.trim())
  if (success) {
    scrollToBottomIfNeeded()
  }
}

const previousLength = ref(0)
watch(
  () => messages.value.length,
  (newLength) => {
    if (newLength > previousLength.value) {
      previousLength.value = newLength
      scrollToBottomIfNeeded()
    }
  }
)

onMounted(() => {
  store.setActiveThread(props.threadId)
  
  if (!historyLoaded.value) {
    store.fetchMessages(props.threadId)
    historyLoaded.value = true
  }
  
  nextTick(() => {
    const container = messagesContainerRef.value
    if (container) container.scrollTop = container.scrollHeight
  })
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
  background-color: var(--surface-soft, #f8fafc);
}
</style>
