<template>
  <div class="min-h-screen bg-surface-soft">
    <div class="mx-auto max-w-5xl px-4 py-6">
      <!-- Header -->
      <div class="mb-4 flex items-center gap-4">
        <button
          type="button"
          class="rounded-full p-2 text-muted transition hover:bg-surface hover:text-body"
          @click="handleBack"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="flex-1">
          <h1 class="text-xl font-semibold text-body">
            {{ studentName }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('chat.title') }}
          </p>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p class="text-sm font-medium text-red-800">{{ error }}</p>
        <button
          type="button"
          class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          @click="handleRetry"
        >
          {{ $t('common.retry') }}
        </button>
      </div>

      <!-- Chat window -->
      <div v-else-if="threadId" class="rounded-2xl border border-default bg-surface shadow-lg">
        <NegotiationChatWindow
          :thread-id="threadId"
          @focus="handleChatFocus"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useChatThreadsStore } from '@/stores/chatThreadsStore'
import { useContactAccessStore } from '@/stores/contactAccessStore'
import { useRelationsStore } from '@/stores/relationsStore'
import { notifyError } from '@/utils/notify'
import NegotiationChatWindow from '@/modules/negotiation/components/NegotiationChatWindow.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const chatThreadsStore = useChatThreadsStore()
const contactAccessStore = useContactAccessStore()
const relationsStore = useRelationsStore()

const studentId = computed(() => parseInt(route.params.studentId))
const threadId = ref(null)
const loading = ref(true)
const error = ref(null)
const studentName = ref('')

async function loadThread() {
  loading.value = true
  error.value = null

  try {
    // Get relation for this student
    const relations = relationsStore.tutorRelations || []
    const relation = relations.find(r => r.student?.id === studentId.value)

    if (!relation) {
      error.value = t('chat.errors.relationNotFound')
      return
    }

    // Get student name
    studentName.value = relation.student?.full_name || relation.student?.email || t('common.unknown')

    // Check ContactAccess
    if (!contactAccessStore.canOpenChat(studentId.value)) {
      error.value = t('chat.errors.contactAccessRequired')
      return
    }

    // Ensure thread exists
    const relationId = relation.id || relation.relation_id
    threadId.value = await chatThreadsStore.ensureThread(studentId.value, relationId)
  } catch (err) {
    console.error('[ChatWithStudentView] Failed to load thread:', err)
    error.value = err.response?.data?.error?.message || t('chat.errors.threadCreationFailed')
    notifyError(error.value)
  } finally {
    loading.value = false
  }
}

function handleChatFocus() {
  // Mark thread as read when user focuses on chat
  if (threadId.value) {
    chatThreadsStore.markThreadRead(threadId.value)
  }
}

function handleBack() {
  router.push({ name: 'dashboard-tutor' }).catch(() => {})
}

function handleRetry() {
  loadThread()
}

watch(() => route.params.studentId, () => {
  if (route.name === 'chat-student') {
    loadThread()
  }
})

onMounted(() => {
  loadThread()
})
</script>
