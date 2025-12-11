<template>
  <section class="rounded-3xl border border-default bg-white shadow-theme flex flex-col h-full">
    <header class="border-b border-border-subtle px-6 py-4 flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">{{ $t('chat.header.subtitle') }}</p>
        <h2 class="text-lg font-semibold text-body">{{ $t('chat.header.title') }}</h2>
      </div>
      <div class="text-xs text-muted flex flex-col items-end gap-1">
        <span v-if="chatStatus === 'offline'" class="text-danger">{{ $t('chat.status.offline') }}</span>
        <span v-else>{{ $t('chat.status.connected') }}</span>
        <span v-if="typingDisplay" class="text-accent font-medium">{{ typingDisplay }}</span>
      </div>
    </header>

    <div class="flex-1 overflow-hidden flex flex-col">
      <div class="flex items-center justify-center border-b border-border-subtle bg-surface-soft py-2 text-xs">
        <button
          class="uppercase tracking-wide font-semibold text-muted hover:text-body transition disabled:opacity-50"
          :disabled="!hasMore || loadingHistory"
          @click="loadMore"
        >
          {{ loadingHistory ? $t('chat.loader.loadingHistory') : $t('chat.loader.loadMore') }}
        </button>
      </div>
      <div ref="listRef" class="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-chat-pattern">
        <p v-if="!sortedMessages.length && !loadingHistory" class="text-center text-sm text-muted">
          {{ $t('chat.empty') }}
        </p>
        <TransitionGroup name="fade-up" tag="div" class="space-y-4">
          <ChatMessage
            v-for="message in sortedMessages"
            :key="message.id"
            :message="message"
            :current-user-id="currentUserId"
            :read-pointers="readPointers"
            @edit="startEdit"
            @delete="requestDelete"
          />
        </TransitionGroup>
        <div v-if="typingDisplay" class="text-sm text-muted">{{ typingDisplay }}</div>
      </div>
    </div>

    <footer class="border-t border-border-subtle px-6 py-4 space-y-2">
      <div v-if="isEditing" class="rounded-xl border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning flex items-center justify-between gap-3">
        <span>{{ $t('chat.editing') }}</span>
        <button class="text-muted hover:text-body" @click="cancelEdit">{{ $t('chat.actions.cancelEdit') }}</button>
      </div>
      <textarea
        v-model="draft"
        class="w-full rounded-2xl border border-border-subtle bg-surface-soft px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none h-24"
        :placeholder="$t('chat.input.placeholder')"
        @keydown.enter.exact.prevent="handleSend"
        @input="handleTyping"
      ></textarea>
      <div class="flex items-center justify-between text-xs text-muted">
        <span>{{ $t('chat.input.hint') }}</span>
        <div class="flex items-center gap-2">
          <button class="text-muted hover:text-body" @click="handleSend" :disabled="sending">
            {{ sending ? $t('chat.input.sending') : $t('chat.input.send') }}
          </button>
        </div>
      </div>
    </footer>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../../../stores/chatStore'
import { useAuthStore } from '../../auth/store/authStore'
import ChatMessage from './ChatMessage.vue'
import { useRealtimeStore } from '../../../stores/realtimeStore'

const props = defineProps({
  lessonId: {
    type: [String, Number],
    required: true,
  },
})

const chatStore = useChatStore()
const authStore = useAuthStore()
const realtimeStore = useRealtimeStore()
const { t } = useI18n()

const listRef = ref(null)
const draft = ref('')
const editingMessage = ref(null)
const lastTypingSent = ref(0)

const currentUserId = computed(() => authStore.user?.id)
const sortedMessages = computed(() => chatStore.sortedMessages)
const hasMore = computed(() => chatStore.hasMore)
const readPointers = computed(() => chatStore.readPointers)
const typingDisplay = computed(() => {
  const typing = chatStore.typingList.filter((entry) => String(entry.id) !== String(currentUserId.value))
  if (!typing.length) return ''
  if (typing.length === 1) {
    return t('chat.typing.single', { name: typing[0].name || t('chat.typing.unknown') })
  }
  return t('chat.typing.many', { count: typing.length })
})
const chatStatus = computed(() => (realtimeStore.offline ? 'offline' : realtimeStore.status))
const loadingHistory = computed(() => chatStore.loading)
const sending = computed(() => chatStore.sending)
const isEditing = computed(() => Boolean(editingMessage.value))

onMounted(() => {
  if (props.lessonId) {
    chatStore.initLesson(props.lessonId)
  }
})

watch(
  () => props.lessonId,
  (lessonId) => {
    if (lessonId) {
      chatStore.initLesson(lessonId)
    }
  },
  { immediate: true },
)

watch(
  () => sortedMessages.value.length,
  async () => {
    await nextTick()
    autoScroll()
    markLastAsRead()
  },
)

function autoScroll() {
  const el = listRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function markLastAsRead() {
  const lastMessage = [...sortedMessages.value].reverse().find((message) => String(message.author?.id ?? message.author_id) !== String(currentUserId.value))
  if (lastMessage) {
    chatStore.markAsRead(lastMessage.id)
  }
}

function loadMore() {
  chatStore.fetchHistory()
}

function handleTyping() {
  const now = Date.now()
  if (now - lastTypingSent.value > 2000) {
    chatStore.sendTyping()
    lastTypingSent.value = now
  }
}

async function handleSend() {
  if (!draft.value.trim()) return
  if (isEditing.value) {
    await chatStore.editMessage(editingMessage.value.id, draft.value)
    editingMessage.value = null
  } else {
    await chatStore.sendMessage({ text: draft.value })
  }
  draft.value = ''
}

function startEdit(message) {
  if (String(message.author?.id ?? message.author_id) !== String(currentUserId.value)) return
  editingMessage.value = message
  draft.value = message.text || ''
}

function cancelEdit() {
  editingMessage.value = null
  draft.value = ''
}

function requestDelete(message) {
  if (!confirm(t('chat.confirm.delete'))) return
  chatStore.deleteMessage(message.id)
}

onBeforeUnmount(() => {
  chatStore.dispose()
})
</script>

<style scoped>
.border-default {
  border-color: rgba(7, 15, 30, 0.08);
}
.border-border-subtle {
  border-color: rgba(7, 15, 30, 0.05);
}
.bg-surface-soft {
  background-color: rgba(7, 15, 30, 0.04);
}
.text-muted {
  color: rgba(7, 15, 30, 0.55);
}
.text-body {
  color: rgba(7, 15, 30, 0.9);
}
.text-accent {
  color: #4f46e5;
}
.text-danger {
  color: #d63a3a;
}
.bg-chat-pattern {
  background-image: radial-gradient(circle at 1px 1px, rgba(7, 15, 30, 0.04) 1px, transparent 0);
  background-size: 28px 28px;
}
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.2s ease;
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
