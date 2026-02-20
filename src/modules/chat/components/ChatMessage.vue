<template>
  <div class="flex gap-3 text-sm" :class="isOwn ? 'flex-row-reverse text-right' : 'text-left'">
    <div
      class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white"
      :style="{ backgroundColor: avatarColor }"
    >
      {{ initials }}
    </div>
    <div class="flex-1 space-y-1">
      <div class="flex items-center justify-between text-xs text-muted">
        <span class="font-semibold text-body">{{ authorName }}</span>
        <span>
          {{ formattedTime }}
          <span v-if="message.edited_at" class="italic ml-1">({{ $t('chat.edited') }})</span>
        </span>
      </div>
      <div
        ref="bodyRef"
        class="rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm message-bubble"
        :class="isOwn ? 'bg-accent text-white rounded-br-sm' : 'bg-surface-soft text-body rounded-bl-sm'"
        v-html="renderedBody"
      ></div>
      <div v-if="readNames.length" class="text-[11px] text-muted">
        {{ readNames.join(', ') }} {{ readNames.length === 1 ? $t('chat.readSingle') : $t('chat.readMany') }}
      </div>
      <div v-if="showStatusRow" class="message-status text-[11px]" :class="isOwn ? 'justify-end' : 'justify-start'">
        <span class="status-pill" :class="`status-pill--${message.status || 'delivered'}`">
          {{ statusLabel }}
        </span>
        <button
          v-if="canRetry"
          type="button"
          class="retry-link"
          @click="$emit('retry', message)"
        >
          {{ $t('chat.actions.retry') }}
        </button>
      </div>
      <div v-if="message.status === 'error'" class="text-[11px] text-danger">
        {{ message.errorMessage || $t('chat.errors.failedToSend') }}
      </div>
    </div>
    <div v-if="isOwn" class="flex flex-col items-end gap-1 text-[11px] text-muted">
      <button class="hover:text-body transition" @click="$emit('edit', message)">{{ $t('chat.actions.edit') }}</button>
      <button class="hover:text-danger transition" @click="$emit('delete', message)">{{ $t('chat.actions.delete') }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { renderMarkdown } from '../../../utils/markdown'
import { renderMath } from '../../../utils/mathjax'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
  currentUserId: {
    type: [String, Number],
    required: true,
  },
  readPointers: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['edit', 'delete', 'retry'])

const bodyRef = ref(null)
const renderedBody = computed(() => renderMarkdown(props.message?.text || ''))
const isOwn = computed(() => String(props.message?.author?.id ?? props.message?.author_id) === String(props.currentUserId))
const authorName = computed(() => props.message?.author?.name || props.message?.author_name || props.message?.author?.email || '—')

// Google-style colors for avatars
const AVATAR_COLORS = [
  '#1A73E8', // Blue
  '#D93025', // Red
  '#188038', // Green
  '#F9AB00', // Yellow
  '#9334E6', // Purple
  '#0097A7', // Cyan
  '#F57C00', // Orange
  '#7B1FA2', // Magenta
  '#388E3C', // Teal
  '#1976D2', // Light Blue
  '#D84315', // Deep Orange
  '#00796B', // Mint
]

const initials = computed(() => {
  const name = authorName.value || ''
  const parts = name.split(' ').filter(Boolean)
  if (!parts.length && props.message?.author?.email) {
    return props.message.author.email.slice(0, 2).toUpperCase()
  }
  return parts
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('')
})

const avatarColor = computed(() => {
  const authorId = props.message?.author?.id || props.message?.author_id || authorName.value
  const seed = String(authorId)
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
})

const formattedTime = computed(() => dayjs(props.message?.created_at).format('HH:mm'))

const readNames = computed(() => {
  const entries = Object.values(props.readPointers || {})
  return entries.filter((entry) => entry?.messageId === props.message?.id).map((entry) => entry?.name || '—')
})

const { t } = useI18n()

const statusLabel = computed(() => {
  const status = props.message?.status || 'delivered'
  return t(`chat.messageStatus.${status}`, t('chat.messageStatus.delivered'))
})

const showStatusRow = computed(() => isOwn.value || props.message?.status === 'error')
const canRetry = computed(() => props.message?.status === 'error')

watch(
  () => props.message?.text,
  () => {
    nextTick(() => renderMath(bodyRef.value))
  },
)

onMounted(() => {
  renderMath(bodyRef.value)
})
</script>

<style scoped>
.text-body {
  color: var(--text-primary, rgba(7, 15, 30, 0.9));
}
.bg-surface-soft {
  background-color: var(--bg-secondary, rgba(7, 15, 30, 0.04));
}
.text-muted {
  color: var(--text-secondary, rgba(7, 15, 30, 0.55));
}
.text-danger {
  color: var(--danger, #d63a3a);
}
.bg-accent {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
}
.message-status {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: rgba(7, 15, 30, 0.6);
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.6rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  background-color: rgba(7, 15, 30, 0.08);
}
.status-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background-color: currentColor;
}
.status-pill--sending {
  color: var(--accent, #2563eb);
  background-color: color-mix(in srgb, var(--accent, #2563eb) 12%, transparent);
}
.status-pill--delivered {
  color: var(--success, #059669);
  background-color: color-mix(in srgb, var(--success, #059669) 12%, transparent);
}
.status-pill--error {
  color: var(--danger, #dc2626);
  background-color: color-mix(in srgb, var(--danger, #dc2626) 12%, transparent);
}
.retry-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--danger, #dc2626);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
}
.retry-link:hover {
  opacity: 0.8;
}
</style>
