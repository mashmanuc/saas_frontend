<template>
  <article
    class="flex gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition cursor-pointer"
    @click="$router.push({ name: 'FeedbackThread', params: { id: thread.id } })"
  >
    <VoteButton
      :voted="!!thread.voted_by_me"
      :count="thread.vote_count"
      :disabled="thread.is_locked || thread.is_hidden || thread.is_terminal"
      @toggle="$emit('vote', thread.id)"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1 flex-wrap">
        <StatusBadge :status="thread.status" />
        <span class="text-xs text-slate-500">{{ $t(`feedback.type.${thread.type}`, thread.type) }}</span>
        <span v-if="thread.category" class="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
          {{ $t(`feedback.category.${thread.category}`, thread.category) }}
        </span>
        <span v-if="thread.is_locked" class="text-xs text-amber-700">🔒</span>
      </div>
      <h3 class="font-medium text-slate-900 truncate">{{ thread.title }}</h3>
      <p class="text-sm text-slate-600 mt-1 line-clamp-2">{{ thread.description_preview }}</p>
      <div class="flex items-center gap-3 mt-2 text-xs text-slate-500">
        <span v-if="thread.author">
          {{ thread.author.display_name || `User#${thread.author.id}` }}
        </span>
        <span>·</span>
        <span>💬 {{ thread.comment_count }}</span>
        <span v-if="thread.staff_response" class="text-emerald-700 ml-2">
          ✓ {{ $t('feedback.staffResponded') }}
        </span>
      </div>
    </div>
  </article>
</template>

<script setup>
import StatusBadge from './StatusBadge.vue'
import VoteButton from './VoteButton.vue'

defineProps({
  thread: { type: Object, required: true },
})
defineEmits(['vote'])
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
