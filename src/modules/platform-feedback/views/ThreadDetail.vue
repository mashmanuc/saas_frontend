<template>
  <div class="max-w-3xl mx-auto px-4 py-6">
    <router-link to="/feedback" class="text-sm text-blue-600 hover:underline">
      ← {{ $t('feedback.detail.back') }}
    </router-link>

    <div v-if="store.detailLoading" class="text-center py-10 text-slate-500">
      {{ $t('feedback.detail.loading') }}
    </div>
    <div v-else-if="store.detailError" class="text-center py-10 text-rose-600">
      {{ store.detailError }}
    </div>
    <div v-else-if="thread" class="mt-4">
      <!-- Header -->
      <div class="flex gap-4 items-start">
        <VoteButton
          :voted="!!thread.voted_by_me"
          :count="thread.vote_count"
          :disabled="thread.is_locked || thread.is_hidden || thread.is_terminal"
          @toggle="onVote"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-2">
            <StatusBadge :status="thread.status" />
            <span class="text-xs text-slate-500">{{ $t(`feedback.type.${thread.type}`, thread.type) }}</span>
            <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {{ $t(`feedback.category.${thread.category}`, thread.category) }}
            </span>
            <span v-if="thread.is_locked" class="text-xs text-amber-700">🔒 {{ $t('feedback.detail.locked') }}</span>
          </div>
          <h1 class="text-2xl font-bold text-slate-900">{{ thread.title }}</h1>
          <div class="text-xs text-slate-500 mt-1">
            {{ thread.author?.display_name }} · {{ formatDate(thread.created_at) }}
          </div>
        </div>
        <button
          type="button"
          :class="[
            'px-3 py-1.5 rounded-lg text-sm border',
            thread.subscribed_by_me
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-white border-slate-300 text-slate-700 hover:border-blue-300',
          ]"
          @click="toggleSubscribe"
        >
          {{ thread.subscribed_by_me ? '✓ ' + $t('feedback.detail.subscribed') : $t('feedback.detail.subscribe') }}
        </button>
      </div>

      <!-- Duplicate banner -->
      <div v-if="thread.status === 'duplicate' && thread.duplicate_of" class="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
        {{ $t('feedback.detail.duplicateOf') }}
        <router-link
          :to="{ name: 'FeedbackThread', params: { id: thread.duplicate_of } }"
          class="font-medium text-blue-700 hover:underline"
        >
          #{{ thread.duplicate_of }}
        </router-link>
      </div>

      <!-- Description -->
      <div class="mt-4 p-4 bg-white border border-slate-200 rounded-xl">
        <p class="text-slate-800 whitespace-pre-wrap">{{ thread.description }}</p>
      </div>

      <!-- Staff response -->
      <div v-if="thread.staff_response" class="mt-4 p-4 bg-emerald-50 border border-emerald-300 rounded-xl">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm font-semibold text-emerald-900">✓ {{ $t('feedback.detail.staffResponse') }}</span>
          <span v-if="thread.staff_responded_at" class="text-xs text-emerald-700">
            {{ formatDate(thread.staff_responded_at) }}
          </span>
        </div>
        <p class="text-slate-800 whitespace-pre-wrap">{{ thread.staff_response }}</p>
      </div>

      <!-- Staff moderation panel -->
      <div v-if="thread.can_moderate" class="mt-4 p-4 bg-purple-50 border border-purple-300 rounded-xl">
        <h3 class="text-sm font-semibold text-purple-900 mb-2">🛡️ {{ $t('feedback.detail.staffPanel') }}</h3>
        <div class="flex flex-wrap gap-2 items-center">
          <select v-model="staffForm.status" class="px-2 py-1 text-sm border border-slate-300 rounded">
            <option v-for="s in STATUSES" :key="s" :value="s">{{ $t(`feedback.status.${s}`) }}</option>
          </select>
          <input
            v-if="staffForm.status === 'duplicate'"
            v-model.number="staffForm.duplicate_of_id"
            type="number"
            class="px-2 py-1 text-sm border border-slate-300 rounded w-24"
            :placeholder="$t('feedback.detail.canonicalId')"
          />
          <textarea
            v-model="staffForm.staff_response"
            rows="2"
            class="flex-1 min-w-[200px] px-2 py-1 text-sm border border-slate-300 rounded"
            :placeholder="$t('feedback.detail.staffResponsePlaceholder')"
          />
          <button
            type="button"
            class="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
            @click="applyStaffChange"
          >
            {{ $t('feedback.detail.apply') }}
          </button>
          <button type="button" class="px-3 py-1 text-sm border border-slate-300 rounded" @click="onToggleLock">
            {{ thread.is_locked ? $t('feedback.detail.unlock') : $t('feedback.detail.lock') }}
          </button>
          <button type="button" class="px-3 py-1 text-sm border border-slate-300 rounded" @click="onToggleHide">
            {{ thread.is_hidden ? $t('feedback.detail.unhide') : $t('feedback.detail.hide') }}
          </button>
        </div>
      </div>

      <!-- Comments -->
      <CommentList
        :thread="thread"
        :comments="store.commentsFor(thread.id)"
        @submit="onCreateComment"
        @delete="onDeleteComment"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFeedbackStore } from '../stores/feedbackStore'
import StatusBadge from '../components/StatusBadge.vue'
import VoteButton from '../components/VoteButton.vue'
import CommentList from '../components/CommentList.vue'
import { activeLocale } from '@/utils/i18nDate'

const STATUSES = [
  'open', 'under_review', 'planned', 'in_progress',
  'released', 'done', 'rejected', 'duplicate',
  'archived', 'needs_info',
]

const route = useRoute()
const store = useFeedbackStore()

const thread = computed(() => store.threadById(Number(route.params.id)))
const staffForm = reactive({ status: 'planned', staff_response: '', duplicate_of_id: null })

watch(
  () => route.params.id,
  (id) => {
    if (!id) return
    const tid = Number(id)
    store.loadDetail(tid).then(() => {
      const t = store.threadById(tid)
      if (t) {
        staffForm.status = t.status
        staffForm.staff_response = t.staff_response || ''
      }
    })
    store.loadComments(tid).catch(() => {})
  },
  { immediate: true },
)

async function onVote() {
  if (!thread.value) return
  try {
    await store.toggleVote(thread.value.id)
  } catch (err) {
    console.error(err)
  }
}

async function toggleSubscribe() {
  if (!thread.value) return
  if (thread.value.subscribed_by_me) {
    await store.unsubscribe(thread.value.id)
  } else {
    await store.subscribe(thread.value.id)
  }
}

async function onCreateComment(content) {
  if (!thread.value) return
  await store.createComment(thread.value.id, content)
}

async function onDeleteComment(commentId) {
  if (!thread.value) return
  await store.deleteComment(commentId, thread.value.id)
}

async function applyStaffChange() {
  if (!thread.value) return
  const payload = { status: staffForm.status, staff_response: staffForm.staff_response }
  if (staffForm.status === 'duplicate' && staffForm.duplicate_of_id) {
    payload.duplicate_of_id = staffForm.duplicate_of_id
  }
  await store.changeStatus(thread.value.id, payload)
}

async function onToggleLock() {
  if (!thread.value) return
  await store.toggleLock(thread.value.id)
}

async function onToggleHide() {
  if (!thread.value) return
  await store.toggleHide(thread.value.id)
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(activeLocale(), { dateStyle: 'short', timeStyle: 'short' })
  } catch (e) {
    return iso
  }
}
</script>
