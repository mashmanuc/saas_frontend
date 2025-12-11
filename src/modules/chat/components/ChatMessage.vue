<template>
  <div class="flex gap-3 text-sm" :class="isOwn ? 'flex-row-reverse text-right' : 'text-left'">
    <div class="w-10 h-10 rounded-full bg-surface-soft text-body flex items-center justify-center font-semibold">
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
        class="rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
        :class="isOwn ? 'bg-accent text-white rounded-br-sm' : 'bg-surface-soft text-body rounded-bl-sm'"
        v-html="renderedBody"
      ></div>
      <div v-if="readNames.length" class="text-[11px] text-muted">
        {{ readNames.join(', ') }} {{ readNames.length === 1 ? $t('chat.readSingle') : $t('chat.readMany') }}
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

const emit = defineEmits(['edit', 'delete'])

const bodyRef = ref(null)
const renderedBody = computed(() => renderMarkdown(props.message?.text || ''))
const isOwn = computed(() => String(props.message?.author?.id ?? props.message?.author_id) === String(props.currentUserId))
const authorName = computed(() => props.message?.author?.name || props.message?.author_name || props.message?.author?.email || '—')
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

const formattedTime = computed(() => dayjs(props.message?.created_at).format('HH:mm'))

const readNames = computed(() => {
  const entries = Object.values(props.readPointers || {})
  return entries.filter((entry) => entry?.messageId === props.message?.id).map((entry) => entry?.name || '—')
})

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
  color: rgba(7, 15, 30, 0.9);
}
.bg-surface-soft {
  background-color: rgba(7, 15, 30, 0.04);
}
.text-muted {
  color: rgba(7, 15, 30, 0.55);
}
.text-danger {
  color: #d63a3a;
}
.bg-accent {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
}
</style>
