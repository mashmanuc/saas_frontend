<template>
  <div
    class="flex gap-3 text-sm"
    :class="isOwn ? 'flex-row-reverse' : ''"
  >
    <!-- Avatar -->
    <Avatar :text="senderName" size="sm" />

    <!-- Message content -->
    <div class="flex-1 max-w-[75%]" :class="isOwn ? 'text-right' : 'text-left'">
      <!-- Header: name + time -->
      <div class="flex items-center gap-2 mb-1 text-xs" :class="isOwn ? 'justify-end' : ''">
        <span class="font-medium" style="color: var(--text-primary);">{{ senderName }}</span>
        <span style="color: var(--text-secondary);">{{ formattedTime }}</span>
      </div>

      <!-- Bubble -->
      <div
        class="inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
        :class="bubbleClasses"
      >
        {{ message.body }}
      </div>

      <!-- Read status -->
      <div v-if="isOwn" class="mt-1 text-[11px]" style="color: var(--text-secondary);">
        <span v-if="isRead">Прочитано</span>
        <span v-else>Доставлено</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '@/ui/Avatar.vue'
import type { ChatMessageDTO } from '@/types/inquiries'

const props = defineProps<{
  message: ChatMessageDTO
  currentUserId: number
}>()

// Support both new API format (sender_id) and legacy (sender.id)
const senderId = computed(() => props.message.sender_id ?? props.message.sender?.id)
const isOwn = computed(() => senderId.value === props.currentUserId)

const senderName = computed(() => {
  if (props.message.sender_name) return props.message.sender_name
  if (props.message.sender) {
    return `${props.message.sender.firstName} ${props.message.sender.lastName}`.trim() || 'User'
  }
  return 'User'
})

const formattedTime = computed(() => {
  const timestamp = props.message.created_at ?? props.message.createdAt
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
})

const isRead = computed(() => props.message.is_read ?? false)

const bubbleClasses = computed(() => {
  if (isOwn.value) {
    return 'bg-accent text-white rounded-br-sm'
  }
  return 'bg-surface-soft rounded-bl-sm'
})
</script>

<style scoped>
.bg-accent {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
}
.bg-surface-soft {
  background-color: var(--surface-soft, rgba(7, 15, 30, 0.04));
  color: var(--text-primary, rgba(7, 15, 30, 0.9));
}
</style>
