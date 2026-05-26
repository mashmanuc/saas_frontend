<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <header class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">🗺️ {{ $t('feedback.roadmap.title') }}</h1>
        <p class="text-sm text-slate-600 mt-1">{{ $t('feedback.roadmap.subtitle') }}</p>
      </div>
      <router-link to="/feedback" class="text-sm text-blue-600 hover:underline">
        ← {{ $t('feedback.roadmap.backToFeedback') }}
      </router-link>
    </header>

    <div v-if="loading" class="text-center py-10 text-slate-500">{{ $t('feedback.roadmap.loading') }}</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <RoadmapColumn
        :title="$t('feedback.roadmap.planned')"
        :empty-text="$t('feedback.roadmap.empty.planned')"
        accent="amber"
        :items="groups.planned"
        @vote="onVote"
      />
      <RoadmapColumn
        :title="$t('feedback.roadmap.in_progress')"
        :empty-text="$t('feedback.roadmap.empty.in_progress')"
        accent="blue"
        :items="groups.in_progress"
        @vote="onVote"
      />
      <RoadmapColumn
        :title="$t('feedback.roadmap.released')"
        :empty-text="$t('feedback.roadmap.empty.released')"
        accent="emerald"
        :items="groups.released"
        @vote="onVote"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { useFeedbackStore } from '../stores/feedbackStore'
import ThreadCard from '../components/ThreadCard.vue'

const store = useFeedbackStore()
const loading = ref(false)

const groups = computed(() => {
  const planned = []
  const in_progress = []
  const released = []
  for (const t of store.listThreads) {
    if (t.status === 'planned') planned.push(t)
    else if (t.status === 'in_progress') in_progress.push(t)
    else if (t.status === 'released') released.push(t)
  }
  return { planned, in_progress, released }
})

async function load() {
  loading.value = true
  try {
    // Single query: усі 3 статуси
    await store.loadList({
      sort: 'top',
      status: ['planned', 'in_progress', 'released'],
      page_size: 50,
    })
  } finally {
    loading.value = false
  }
}

async function onVote(threadId) {
  await store.toggleVote(threadId)
}

onMounted(load)

// Inline RoadmapColumn component
const RoadmapColumn = {
  props: { title: String, emptyText: String, items: Array, accent: String },
  emits: ['vote'],
  setup(props, { emit }) {
    return () => h(
      'section',
      { class: 'bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[400px]' },
      [
        h('h2', { class: `text-sm font-semibold mb-3 text-${props.accent}-700` }, props.title),
        props.items?.length
          ? h('div', { class: 'space-y-2' },
              props.items.map((t) =>
                h(ThreadCard, { key: t.id, thread: t, onVote: (id) => emit('vote', id) }),
              ),
            )
          : h('p', { class: 'text-sm text-slate-500 italic text-center py-10' }, props.emptyText),
      ],
    )
  },
}
</script>
