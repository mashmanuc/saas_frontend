<template>
  <div class="max-w-4xl mx-auto space-y-4">
    <Card>
      <div class="flex items-center justify-between mb-4">
        <Heading :level="2">
          {{ $t('chat.title') }}
        </Heading>
        <Button variant="ghost" size="sm" @click="goBack">
          {{ $t('common.back') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="text-center space-y-2">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p class="text-sm text-muted">{{ $t('loader.loading') }}</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="py-8 text-center space-y-4">
        <p class="text-danger">{{ error }}</p>
        <Button variant="secondary" size="sm" @click="retry">
          {{ $t('common.retry') }}
        </Button>
      </div>

      <!-- Chat Interface -->
      <div v-else-if="thread" class="space-y-4">
        <!-- Thread Info -->
        <div class="pb-4 border-b border-default">
          <p class="text-sm text-muted">
            {{ $t('chat.threadInfo', { kind: thread.kind }) }}
          </p>
          <p v-if="!isWritable" class="text-xs text-warning mt-1">
            {{ $t('chat.readOnly') }}
          </p>
        </div>

        <!-- Messages List -->
        <div class="space-y-3 max-h-96 overflow-y-auto" ref="messagesContainer">
          <div
            v-for="message in messages"
            :key="message.id"
            class="flex"
            :class="isOwnMessage(message) ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[70%] rounded-2xl px-4 py-2"
              :class="
                isOwnMessage(message)
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-default'
              "
            >
              <p class="text-xs font-medium mb-1" :class="isOwnMessage(message) ? 'text-white/80' : 'text-muted'">
                {{ message.sender_name || message.sender_email }}
              </p>
              <p class="text-sm whitespace-pre-wrap">{{ message.body }}</p>
              <p class="text-xs mt-1" :class="isOwnMessage(message) ? 'text-white/60' : 'text-muted'">
                {{ formatTime(message.created_at) }}
              </p>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="messages.length === 0" class="text-center py-8 text-muted">
            <p>{{ $t('chat.noMessages') }}</p>
          </div>
        </div>

        <!-- Message Input -->
        <div v-if="isWritable" class="pt-4 border-t border-default">
          <form @submit.prevent="handleSendMessage" class="space-y-3">
            <textarea
              v-model="messageText"
              :placeholder="$t('chat.messagePlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-default bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-accent"
              rows="3"
              :disabled="isSending"
              @keydown.enter.exact.prevent="handleSendMessage"
            ></textarea>
            <div class="flex justify-between items-center">
              <p class="text-xs text-muted">
                {{ $t('chat.pressEnterToSend') }}
              </p>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                :disabled="!messageText.trim() || isSending"
              >
                {{ isSending ? $t('chat.sending') : $t('chat.send') }}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import {
  listThreads,
  getThreadMessages,
  sendMessage,
  type ChatThread,
  type ChatMessage,
} from '../api/chatApi'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

const tutorId = computed(() => route.params.tutorId as string)
const isLoading = ref(true)
const error = ref<string | null>(null)
const thread = ref<ChatThread | null>(null)
const messages = ref<ChatMessage[]>([])
const isWritable = ref(true)
const messageText = ref('')
const isSending = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

const currentUserId = computed(() => authStore.user?.id)

function isOwnMessage(message: ChatMessage): boolean {
  return message.sender_id === currentUserId.value
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    }).format(date)
  } catch {
    return dateStr
  }
}

function goBack() {
  router.push('/dashboard').catch(() => {})
}

async function loadThread() {
  isLoading.value = true
  error.value = null

  try {
    // Get all threads and find one for this tutor
    // In MVP, we assume one thread per tutor relation
    const { threads } = await listThreads()
    
    if (threads.length === 0) {
      error.value = t('chat.noThreadFound')
      return
    }

    // For E2E: use first available thread
    // In production: match by tutor_id from inquiry/relation data
    thread.value = threads[0]

    // Load messages
    await loadMessages()
  } catch (err: any) {
    console.error('Failed to load thread:', err)
    error.value = err.response?.data?.error?.message || t('chat.loadError')
  } finally {
    isLoading.value = false
  }
}

async function loadMessages() {
  if (!thread.value) return

  try {
    const response = await getThreadMessages(thread.value.id)
    messages.value = response.messages
    isWritable.value = response.is_writable

    // Scroll to bottom
    await nextTick()
    scrollToBottom()
  } catch (err: any) {
    console.error('Failed to load messages:', err)
    error.value = err.response?.data?.error?.message || t('chat.loadMessagesError')
  }
}

async function handleSendMessage() {
  if (!messageText.value.trim() || !thread.value || isSending.value) return

  isSending.value = true
  const text = messageText.value.trim()
  const clientMessageId = crypto.randomUUID()

  try {
    const message = await sendMessage(thread.value.id, {
      body: text,
      client_message_id: clientMessageId,
    })

    messages.value.push(message)
    messageText.value = ''

    // Scroll to bottom
    await nextTick()
    scrollToBottom()
  } catch (err: any) {
    console.error('Failed to send message:', err)
    error.value = err.response?.data?.error?.message || t('chat.sendError')
  } finally {
    isSending.value = false
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function retry() {
  loadThread()
}

onMounted(() => {
  loadThread()
})
</script>
