<template>
  <div class="max-w-3xl mx-auto px-4 py-6">
    <router-link to="/feedback" class="text-sm text-blue-600 hover:underline">
      ← {{ $t('feedback.search.back') }}
    </router-link>
    <h1 class="text-2xl font-bold text-slate-900 mt-2 mb-4">
      🔎 {{ $t('feedback.search.title') }}
    </h1>

    <div class="flex gap-2 mb-4">
      <input
        v-model="query"
        type="text"
        :placeholder="$t('feedback.search.placeholder')"
        class="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        maxlength="200"
        @keyup.enter="run"
      />
      <select v-model="typeFilter" class="px-3 py-2 border border-slate-300 rounded-lg">
        <option value="">{{ $t('feedback.filter.allTypes') }}</option>
        <option v-for="t in TYPES" :key="t" :value="t">{{ $t(`feedback.type.${t}`) }}</option>
      </select>
      <button
        type="button"
        :disabled="loading || query.trim().length < 3"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700"
        @click="run"
      >
        {{ $t('feedback.search.go') }}
      </button>
    </div>

    <p v-if="loading" class="text-center py-6 text-slate-500">
      {{ $t('feedback.search.loading') }}
    </p>
    <p v-else-if="searched && !results.length" class="text-center py-10 text-slate-500">
      {{ $t('feedback.search.empty') }}
    </p>
    <div v-else class="space-y-3">
      <ThreadCard
        v-for="t in results"
        :key="t.id"
        :thread="t"
        @vote="onVote"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useFeedbackStore } from '../stores/feedbackStore'
import api from '../api/feedbackApi'
import ThreadCard from '../components/ThreadCard.vue'

const TYPES = ['feature_request', 'bug_report', 'improvement', 'review', 'discussion']

const store = useFeedbackStore()
const query = ref('')
const typeFilter = ref('')
const loading = ref(false)
const results = ref([])
const searched = ref(false)

async function run() {
  if (query.value.trim().length < 3) return
  loading.value = true
  searched.value = true
  try {
    const { data } = await api.fullSearch(query.value, {
      type: typeFilter.value || undefined,
      limit: 30,
    })
    // Upsert у store cache to keep optimistic vote updates in sync
    data.forEach((t) => store._upsertThread(t))
    results.value = data
  } catch (err) {
    console.error('search failed', err)
    results.value = []
  } finally {
    loading.value = false
  }
}

async function onVote(threadId) {
  try {
    await store.toggleVote(threadId)
    // Mirror back до results array (для immediate re-render)
    const cached = store.threadById(threadId)
    if (cached) {
      const idx = results.value.findIndex((r) => r.id === threadId)
      if (idx >= 0) results.value.splice(idx, 1, cached)
    }
  } catch (e) {
    // Error toast handled by store.voteError
  }
}
</script>
