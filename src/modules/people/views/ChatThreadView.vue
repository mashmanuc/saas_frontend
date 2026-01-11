<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <div class="bg-white border-b border-gray-200 px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <button
            @click="handleBack"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div v-if="activeThread">
            <h1 class="text-lg font-semibold text-gray-900">
              {{ otherParticipant?.firstName }} {{ otherParticipant?.lastName }}
            </h1>
            <p class="text-xs text-gray-500">Negotiation Chat</p>
          </div>
        </div>
        <div v-if="activeThread?.readOnly" class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Read-only
        </div>
      </div>
    </div>

    <div v-if="isLoading && !messages.length" class="flex-1 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <p class="text-sm text-red-600">{{ error }}</p>
        <button
          @click="loadMessages"
          class="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Try again
        </button>
      </div>
    </div>

    <div v-else ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="[
          'flex',
          isOwnMessage(message) ? 'justify-end' : 'justify-start'
        ]"
      >
        <div
          :class="[
            'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
            isOwnMessage(message)
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-900 border border-gray-200'
          ]"
        >
          <p class="text-sm">{{ message.body }}</p>
          <p
            :class="[
              'text-xs mt-1',
              isOwnMessage(message) ? 'text-blue-100' : 'text-gray-500'
            ]"
          >
            {{ formatTime(message.createdAt) }}
          </p>
        </div>
      </div>

      <div v-if="hasMore" class="text-center">
        <button
          @click="loadMore"
          :disabled="isLoading"
          class="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
        >
          Load more
        </button>
      </div>
    </div>

    <div v-if="!activeThread?.readOnly" class="bg-white border-t border-gray-200 px-4 py-3">
      <div class="flex items-end space-x-2">
        <textarea
          v-model="messageText"
          @keydown.enter.exact.prevent="handleSend"
          rows="1"
          placeholder="Type a message..."
          class="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          :disabled="isSending"
        ></textarea>
        <button
          @click="handleSend"
          :disabled="!canSend"
          class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNegotiationChatStore } from '@/stores/negotiationChatStore'
import type { ChatMessageDTO } from '@/types/inquiries'

const route = useRoute()
const router = useRouter()
const chatStore = useNegotiationChatStore()

const threadId = computed(() => route.params.threadId as string)
const messageText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const cursor = ref<string | undefined>(undefined)
const hasMore = ref(false)

const activeThread = computed(() => chatStore.activeThread)
const messages = computed(() => chatStore.messagesByThread[threadId.value] || [])
const isLoading = computed(() => chatStore.isLoading)
const isSending = computed(() => chatStore.isSending)
const error = computed(() => chatStore.error)

const canSend = computed(() => {
  return messageText.value.trim().length > 0 && !isSending.value && !activeThread.value?.readOnly
})

const otherParticipant = computed(() => {
  if (!activeThread.value) return null
  return activeThread.value.participants.find(p => p.id !== 'current')
})

onMounted(async () => {
  chatStore.setActiveThread(threadId.value)
  await loadMessages()
})

watch(messages, async () => {
  await nextTick()
  scrollToBottom()
}, { flush: 'post' })

async function loadMessages() {
  try {
    const response = await chatStore.fetchMessages(threadId.value)
    hasMore.value = response.hasMore
    cursor.value = response.cursor
  } catch (err) {
    console.error('Failed to load messages:', err)
  }
}

async function loadMore() {
  if (!cursor.value) return
  
  try {
    const response = await chatStore.fetchMessages(threadId.value, cursor.value)
    hasMore.value = response.hasMore
    cursor.value = response.cursor
  } catch (err) {
    console.error('Failed to load more messages:', err)
  }
}

async function handleSend() {
  if (!canSend.value) return

  const text = messageText.value.trim()
  messageText.value = ''

  try {
    await chatStore.sendMessage(threadId.value, text)
  } catch (err) {
    console.error('Failed to send message:', err)
    messageText.value = text
  }
}

function handleBack() {
  router.back()
}

function isOwnMessage(message: ChatMessageDTO): boolean {
  return message.sender.id === 'current'
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}
</script>
