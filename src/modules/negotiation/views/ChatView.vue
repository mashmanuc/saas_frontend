<template>
  <PageShell>
    <div class="chat-page">
      <!-- Loading state -->
      <div v-if="isLoading" class="loading-container">
        <LoadingSpinner size="lg" />
        <p class="mt-4" style="color: var(--text-secondary);">
          Завантаження чату...
        </p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="error-container">
        <Alert
          variant="danger"
          title="Помилка завантаження"
          :description="error"
        >
          <Button variant="outline" size="sm" @click="loadThread">
            Спробувати знову
          </Button>
        </Alert>
      </div>

      <!-- Chat loaded -->
      <div v-else-if="thread" class="chat-container">
        <!-- Back navigation -->
        <div class="chat-nav">
          <Button variant="ghost" size="sm" @click="goBack">
            <template #iconLeft>
              <span>&larr;</span>
            </template>
            Назад
          </Button>
          <Badge v-if="thread.kind === 'contact'" variant="success">
            Контакт
          </Badge>
          <Badge v-else variant="primary">
            Переговори
          </Badge>
        </div>

        <!-- Chat window -->
        <NegotiationChatWindow
          :thread-id="threadId"
          :current-user-id="currentUserId"
          :other-user-name="otherUserName"
        />
      </div>

      <!-- Thread not found -->
      <div v-else class="not-found-container">
        <EmptyState
          title="Чат не знайдено"
          description="Цей чат не існує або у вас немає доступу до нього."
        >
          <Button variant="primary" @click="goBack">
            Повернутися назад
          </Button>
        </EmptyState>
      </div>
    </div>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'
import PageShell from '@/ui/PageShell.vue'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import Alert from '@/ui/Alert.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import EmptyState from '@/ui/EmptyState.vue'
import { NegotiationChatWindow } from '../components'
import negotiationChatApi from '@/api/negotiationChat'

interface ThreadInfo {
  thread_id: string
  kind: 'negotiation' | 'contact'
  inquiry_id?: string
  relation_id?: number
  student_id?: number
  is_writable: boolean
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// State
const thread = ref<ThreadInfo | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const otherUserName = ref('Співрозмовник')

// Computed
const threadId = computed(() => route.params.threadId as string)
const currentUserId = computed(() => authStore.user?.id)

// Load thread info
async function loadThread(): Promise<void> {
  if (!threadId.value) {
    error.value = 'Thread ID не вказано'
    isLoading.value = false
    return
  }

  isLoading.value = true
  error.value = null

  try {
    // Fetch thread info via messages endpoint (it returns thread metadata)
    const response = await negotiationChatApi.fetchMessages(threadId.value, undefined, 1)

    // For now, create minimal thread object from response
    thread.value = {
      thread_id: threadId.value,
      kind: 'negotiation', // Will be enhanced when we have thread details endpoint
      is_writable: response.is_writable
    }

    // Try to get other user name from first message
    if (response.messages.length > 0) {
      const firstMsg = response.messages[0]
      const senderName = firstMsg.sender_name || firstMsg.sender?.firstName
      if (senderName && firstMsg.sender_id !== currentUserId.value) {
        otherUserName.value = senderName
      }
    }
  } catch (err: any) {
    console.error('[ChatView] loadThread error:', err)
    error.value = err.message || 'Не вдалося завантажити чат'
    thread.value = null
  } finally {
    isLoading.value = false
  }
}

// Navigation
function goBack(): void {
  if (window.history.length > 2) {
    router.back()
  } else {
    // Default fallback
    router.push({ name: 'dashboard' })
  }
}

// Lifecycle
onMounted(() => {
  loadThread()
})
</script>

<style scoped>
.chat-page {
  min-height: calc(100vh - 120px);
  padding: 1.5rem;
}

.loading-container,
.error-container,
.not-found-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.chat-container {
  max-width: 900px;
  margin: 0 auto;
}

.chat-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .chat-page {
    padding: 1rem;
  }
}
</style>
