<template>
  <!-- 2026-09-23: власний <PageShell> прибрано. Маршрути чату лежать у гілці
       `path: '/'` з `component: PageShell` (router/index.js) — оболонка вже є, і
       друга давала ДВІ шапки, а вміст сторінки не було видно взагалі. Ці два
       екрани були єдиними в застосунку з власною оболонкою. -->
  <div class="chat-list-page">
    <header class="page-header">
      <Heading :level="1">Повідомлення</Heading>
      <p style="color: var(--text-secondary);">
        Ваші активні чати з репетиторами та учнями
      </p>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-container">
      <LoadingSpinner size="md" />
    </div>

    <!-- Error -->
    <Alert
      v-else-if="error"
      variant="danger"
      title="Помилка"
      :description="error"
      class="mb-4"
    >
      <Button variant="outline" size="sm" @click="loadThreads">
        Спробувати знову
      </Button>
    </Alert>

    <!-- Empty state -->
    <EmptyState
      v-else-if="threads.length === 0"
      title="Немає активних чатів"
      description="Ваші чати з'являться тут після початку переговорів з репетитором або учнем."
      icon="💬"
    />

    <!-- Thread list -->
    <div v-else class="thread-list">
      <Card
        v-for="thread in threads"
        :key="thread.id"
        class="thread-card"
        @click="openThread(thread.id)"
      >
        <div class="thread-content">
          <div class="thread-avatar">
            <Avatar :text="getOtherUserName(thread)" size="md" />
          </div>
          <div class="thread-info">
            <div class="thread-header">
              <span class="thread-name">{{ getOtherUserName(thread) }}</span>
              <Badge variant="primary" class="thread-badge">
                Переговори
              </Badge>
            </div>
            <p class="thread-preview">
              {{ thread.lastMessagePreview || 'Немає повідомлень' }}
            </p>
          </div>
          <div v-if="thread.unreadCount" class="thread-unread">
            <span class="unread-badge">{{ thread.unreadCount }}</span>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'
import Heading from '@/ui/Heading.vue'
import Card from '@/ui/Card.vue'
import Avatar from '@/ui/Avatar.vue'
import Badge from '@/ui/Badge.vue'
import Alert from '@/ui/Alert.vue'
import Button from '@/ui/Button.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import EmptyState from '@/ui/EmptyState.vue'
import negotiationChatApi from '@/api/negotiationChat'
import type { NegotiationThreadDTO } from '@/types/inquiries'

interface ThreadWithUnread extends NegotiationThreadDTO {
  unreadCount?: number
}

const router = useRouter()
const authStore = useAuthStore()

// State
const threads = ref<ThreadWithUnread[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Load threads
async function loadThreads(): Promise<void> {
  isLoading.value = true
  error.value = null

  try {
    const fetchedThreads = await negotiationChatApi.fetchThreads()
    threads.value = fetchedThreads
  } catch (err: any) {
    console.error('[ChatListView] loadThreads error:', err)
    error.value = err.message || 'Не вдалося завантажити чати'
  } finally {
    isLoading.value = false
  }
}

// Get other user name from thread
function getOtherUserName(thread: NegotiationThreadDTO): string {
  const currentUserId = authStore.user?.id
  const other = thread.participants?.find(
    (p) => String(p.id) !== String(currentUserId)
  )
  if (other) {
    return `${other.firstName} ${other.lastName}`.trim() || 'Користувач'
  }
  return 'Користувач'
}

// Navigate to thread
function openThread(threadId: string): void {
  router.push({ name: 'chat-thread', params: { threadId } })
}

// Lifecycle
onMounted(() => {
  loadThreads()
})
</script>

<style scoped>
.chat-list-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page-header {
  margin-bottom: 2rem;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.thread-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.thread-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.thread-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.thread-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.thread-avatar {
  flex-shrink: 0;
}

.thread-info {
  flex: 1;
  min-width: 0;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.thread-name {
  font-weight: 600;
  color: var(--text-primary);
}

.thread-badge {
  flex-shrink: 0;
}

.thread-preview {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-unread {
  flex-shrink: 0;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: var(--accent, #2563eb);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
