<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      @keydown.esc="handleClose"
    >
      <!-- Overlay -->
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm"
        @click="handleClose"
      />

      <!-- Modal -->
      <div
        class="chat-modal-content relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-default bg-white shadow-2xl"
      >
        <!-- Modal header -->
        <div class="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div class="flex items-center gap-3 min-w-0">
            <h2 class="truncate text-base font-semibold text-body">
              {{ studentName }}
            </h2>
            <span class="shrink-0 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              {{ $t('dashboard.tutor.cta.chatWithStudent') }}
            </span>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg p-2 text-muted transition hover:bg-surface-soft hover:text-body"
            :aria-label="$t('common.close')"
            @click="handleClose"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden">
          <!-- Loading -->
          <div v-if="loading" class="flex items-center justify-center py-16">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>

          <!-- Error -->
          <div v-else-if="error" class="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <p class="text-sm font-medium text-red-700">{{ error }}</p>
            <button
              type="button"
              class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
              @click="loadThread"
            >
              {{ $t('common.retry') }}
            </button>
          </div>

          <!-- Chat window -->
          <NegotiationChatWindow
            v-else-if="threadId"
            :thread-id="threadId"
            :current-user-id="currentUserId"
            :other-user-name="studentName"
            class="chat-modal-window"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useChatThreadsStore } from '@/stores/chatThreadsStore'
import { useContactAccessStore } from '@/stores/contactAccessStore'
import { useRelationsStore } from '@/stores/relationsStore'
import NegotiationChatWindow from '@/modules/negotiation/components/NegotiationChatWindow.vue'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  studentId: { type: Number, default: null }, // For tutor: ID студента
  tutorId: { type: Number, default: null }, // For student: ID тьютора
  relationId: { type: [String, Number], default: null },
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const authStore = useAuthStore()
const chatThreadsStore = useChatThreadsStore()
const contactAccessStore = useContactAccessStore()
const relationsStore = useRelationsStore()

const threadId = ref(null)
const loading = ref(false)
const error = ref(null)
const studentName = ref('')

const currentUserId = computed(() => authStore.user?.id)

async function loadThread() {
  // Phase 1 v0.87: Підтримка обох режимів
  const isStudentMode = Boolean(props.tutorId)
  const isTutorMode = Boolean(props.studentId)
  
  if (!isStudentMode && !isTutorMode) {
    const isStudent = !props.studentId && props.tutorId
    error.value = isStudent 
      ? t('chat.errors.tutorRelationNotFound') 
      : t('chat.errors.studentRelationNotFound')
    return
  }

  loading.value = true
  error.value = null
  threadId.value = null

  try {
    let relId = props.relationId
    let relation = null
    let otherUserId = null
    
    if (isTutorMode) {
      // Tutor mode: шукаємо студента
      otherUserId = props.studentId
      const relations = relationsStore.tutorRelations || []
      relation = relations.find(r => r.student?.id === props.studentId)
      
      if (relation?.student) {
        const s = relation.student
        const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
        studentName.value = fullName || s.email || t('common.unknown')
      }
      
      // Перевірка доступу для тьютора
      let hasAccess = contactAccessStore.canOpenChat(props.studentId)
      if (!hasAccess) {
        console.log('[ChatModal] Local cache says no access, checking API...')
        try {
          hasAccess = await contactAccessStore.checkContactAccessAPI(props.studentId)
        } catch (apiError) {
          console.error('[ChatModal] API check failed:', apiError)
        }
      }
      if (!hasAccess) {
        error.value = t('chat.errors.contactAccessRequired')
        return
      }
    } else {
      // Student mode: шукаємо тьютора
      otherUserId = props.tutorId
      const relations = relationsStore.studentRelations || []
      relation = relations.find(r => r.tutor?.id === props.tutorId)
      
      if (relation?.tutor) {
        const tut = relation.tutor
        const fullName = [tut.first_name, tut.last_name].filter(Boolean).join(' ').trim()
        studentName.value = fullName || tut.email || t('common.unknown')
      }
      
      // Студенту не потрібна перевірка contact access
    }

    if (!relation && !relId) {
      const isStudent = !props.studentId && props.tutorId
      error.value = isStudent 
        ? t('chat.errors.tutorRelationNotFound') 
        : t('chat.errors.studentRelationNotFound')
      return
    }

    // Ensure thread
    if (!relId) {
      relId = relation?.id || relation?.relation_id
    }
    threadId.value = await chatThreadsStore.ensureThread(otherUserId, relId)
  } catch (err) {
    console.error('[ChatModal] loadThread error:', err)
    error.value = err.response?.data?.error?.message || t('chat.errors.threadCreationFailed')
  } finally {
    loading.value = false
  }
}

function handleClose() {
  // Позначити прочитаними при закритті
  if (threadId.value) {
    chatThreadsStore.markThreadRead(threadId.value)
    chatThreadsStore.fetchUnreadSummary()
  }
  // Очистити стан
  threadId.value = null
  error.value = null
  studentName.value = ''
  emit('close')
}

// Блокуємо скрол body при відкритому модалі
watch(() => props.isOpen, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    loadThread()
  } else {
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
.chat-modal-content {
  max-height: calc(100vh - 2rem);
  animation: chatModalSlideUp 200ms ease-out;
}

/* Перевизначити max-height NegotiationChatWindow для модалки */
.chat-modal-window {
  max-height: none;
  height: calc(100vh - 8rem);
}

@keyframes chatModalSlideUp {
  from {
    opacity: 0;
    transform: translateY(1rem) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
