<template>
  <div class="max-w-4xl mx-auto px-4 py-6">
    <header class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">💡 {{ $t('feedback.landing.title') }}</h1>
        <p class="text-sm text-slate-600 mt-1">{{ $t('feedback.landing.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <router-link
          to="/feedback/search"
          class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          🔎 {{ $t('feedback.landing.search') }}
        </router-link>
        <router-link
          to="/feedback/roadmap"
          class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          🗺️ {{ $t('feedback.landing.roadmap') }}
        </router-link>
        <router-link
          to="/feedback/new"
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + {{ $t('feedback.landing.newThread') }}
        </router-link>
      </div>
    </header>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="s in sorts"
        :key="s.value"
        type="button"
        :class="[
          'px-3 py-1 rounded-full text-sm transition',
          filter.sort === s.value
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
        ]"
        @click="applySort(s.value)"
      >
        {{ $t(s.label) }}
      </button>
      <select
        v-model="typeFilter"
        @change="applyFilter()"
        class="px-3 py-1 rounded-full text-sm border border-slate-300 bg-white"
      >
        <option value="">{{ $t('feedback.filter.allTypes') }}</option>
        <option v-for="t in TYPES" :key="t" :value="t">{{ $t(`feedback.type.${t}`) }}</option>
      </select>
      <select
        v-model="categoryFilter"
        @change="applyFilter()"
        class="px-3 py-1 rounded-full text-sm border border-slate-300 bg-white"
      >
        <option value="">{{ $t('feedback.filter.allCategories') }}</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ $t(`feedback.category.${c}`) }}</option>
      </select>
    </div>

    <!-- List -->
    <div v-if="store.listLoading" class="text-center py-10 text-slate-500">
      {{ $t('feedback.landing.loading') }}
    </div>
    <div v-else-if="store.listError" class="text-center py-10 text-rose-600">
      {{ store.listError }}
    </div>
    <div v-else-if="!store.listThreads.length" class="text-center py-10 text-slate-500">
      <p>{{ $t('feedback.landing.empty') }}</p>
      <router-link to="/feedback/new" class="text-blue-600 hover:underline mt-2 inline-block">
        {{ $t('feedback.landing.beFirst') }}
      </router-link>
    </div>
    <div v-else class="space-y-3">
      <ThreadCard
        v-for="t in store.listThreads"
        :key="t.id"
        :thread="t"
        @vote="onVote"
      />
    </div>

    <!-- Pagination -->
    <div v-if="store.listMeta.total > store.listMeta.page_size" class="flex justify-center gap-2 mt-6">
      <button
        v-for="p in totalPages"
        :key="p"
        type="button"
        :class="[
          'px-3 py-1 rounded text-sm',
          p === store.listMeta.page ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300',
        ]"
        @click="goPage(p)"
      >
        {{ p }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useFeedbackStore } from '../stores/feedbackStore'
import ThreadCard from '../components/ThreadCard.vue'

const store = useFeedbackStore()

// C2 (audit 2026-05-24): order = recent first (нові ідеї найвидніші для author),
// trending — secondary (sortable). У trending mode threads з priority_score=0
// падають у хвіст → автору здавалось, що його щойно створена ідея зникла.
const sorts = [
  { value: 'recent', label: 'feedback.sort.recent' },
  { value: 'trending', label: 'feedback.sort.trending' },
  { value: 'top', label: 'feedback.sort.top' },
]
const TYPES = ['feature_request', 'bug_report', 'improvement', 'review', 'discussion']
const CATEGORIES = ['ux', 'classroom', 'winterboard', 'performance', 'ai', 'marketplace', 'other']

const filter = reactive({ sort: 'recent', page: 1 })
const typeFilter = ref('')
const categoryFilter = ref('')

function applySort(sort) {
  filter.sort = sort
  filter.page = 1
  load()
}

function applyFilter() {
  filter.page = 1
  load()
}

function goPage(p) {
  filter.page = p
  load()
}

const totalPages = computed(() => {
  const total = store.listMeta.total || 0
  const size = store.listMeta.page_size || 20
  return Math.max(1, Math.ceil(total / size))
})

function load() {
  const params = { ...filter }
  if (typeFilter.value) params.type = typeFilter.value
  if (categoryFilter.value) params.category = categoryFilter.value
  store.loadList(params)
}

async function onVote(threadId) {
  try {
    await store.toggleVote(threadId)
  } catch (err) {
    console.error('vote failed', err)
  }
}

onMounted(() => load())
</script>
