<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessageStore } from '../store/messageStore'
import { Send, Paperclip, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  matchId: string
}>()

const { t } = useI18n()
const messageStore = useMessageStore()

const messageText = ref('')
const attachments = ref<File[]>([])
const messagesContainer = ref<HTMLElement | null>(null)
const uploading = ref(false)

const messages = computed(() => messageStore.getMatchMessages(props.matchId))
const canSend = computed(() => messageText.value.trim() || attachments.value.length > 0)

async function loadMessages() {
  await messageStore.fetchMessages(props.matchId)
  await nextTick()
  scrollToBottom()
}

async function sendMessage() {
  if (!canSend.value) return

  const attachmentKeys = []
  
  if (attachments.value.length > 0) {
    uploading.value = true
    try {
      for (const file of attachments.value) {
        const key = await messageStore.uploadAttachment(file)
        attachmentKeys.push(key)
      }
    } catch (err) {
      console.error('Upload failed:', err)
      return
    } finally {
      uploading.value = false
    }
  }

  try {
    await messageStore.sendMessage(props.matchId, {
      text: messageText.value.trim() || undefined,
      attachments: attachmentKeys.length > 0 ? attachmentKeys : undefined
    })
    messageText.value = ''
    attachments.value = []
    await nextTick()
    scrollToBottom()
  } catch (err) {
    console.error('Send failed:', err)
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    attachments.value = Array.from(target.files)
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

onMounted(() => {
  loadMessages()
})
</script>

<template>
  <div class="conversation-view">
    <div class="banner">
      <AlertCircle :size="18" />
      <p>{{ t('matches.messaging.banner') }}</p>
    </div>

    <div ref="messagesContainer" class="messages">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.sender_role]"
      >
        <div class="message-content">
          <p v-if="message.text">{{ message.text }}</p>
          <div v-if="message.attachments?.length" class="attachments">
            <span v-for="(att, idx) in message.attachments" :key="idx" class="attachment">
              {{ att }}
            </span>
          </div>
          <span class="timestamp">{{ message.created_at }}</span>
        </div>
      </div>
    </div>

    <div class="input-area">
      <div v-if="attachments.length > 0" class="selected-files">
        <span v-for="(file, idx) in attachments" :key="idx" class="file">
          {{ file.name }}
        </span>
      </div>

      <div class="input-row">
        <label class="attach-btn">
          <Paperclip :size="20" />
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            @change="handleFileSelect"
          />
        </label>

        <input
          v-model="messageText"
          type="text"
          :placeholder="t('matches.messaging.placeholder')"
          @keydown.enter="sendMessage"
        />

        <button
          class="send-btn"
          :disabled="!canSend || uploading"
          @click="sendMessage"
        >
          <Send :size="20" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conversation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-card);
}

.banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--info-bg, #dbeafe);
  color: var(--info, #3b82f6);
  border-bottom: 1px solid var(--info-border, #93c5fd);
}

.banner p {
  margin: 0;
  font-size: 0.875rem;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  max-width: 70%;
}

.message.tutor {
  align-self: flex-end;
}

.message.student {
  align-self: flex-start;
}

.message-content {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md, 8px);
  background: var(--surface-secondary);
}

.message.tutor .message-content {
  background: var(--primary);
  color: white;
}

.message-content p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.attachments {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.attachment {
  font-size: 0.8125rem;
  opacity: 0.9;
}

.timestamp {
  font-size: 0.75rem;
  opacity: 0.7;
}

.input-area {
  border-top: 1px solid var(--border-color);
  padding: 1rem;
}

.selected-files {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.file {
  padding: 0.25rem 0.5rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-sm, 4px);
  font-size: 0.8125rem;
}

.input-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.attach-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--surface-secondary);
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: background 0.2s;
}

.attach-btn:hover {
  background: var(--surface-hover);
}

.attach-btn input {
  display: none;
}

.input-row input[type="text"] {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  background: var(--surface-input);
  color: var(--text-primary);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
