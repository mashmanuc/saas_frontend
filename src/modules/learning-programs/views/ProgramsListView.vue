<template>
  <div class="lpl" data-testid="lp-list">
    <header class="lpl__head">
      <div>
        <h1 class="lpl__title">{{ t('learningPrograms.list.title') }}</h1>
        <p class="lpl__sub">{{ t('learningPrograms.list.subtitle') }}</p>
      </div>
      <Button data-testid="lp-new" @click="createOpen = true">{{ t('learningPrograms.list.new') }}</Button>
    </header>

    <div class="lpl__filters">
      <input
        v-model="query"
        class="lpl__search"
        type="search"
        maxlength="80"
        :placeholder="t('learningPrograms.list.search')"
        data-testid="lp-search"
      />
      <div class="lpl__tabs" role="tablist">
        <button
          v-for="s in STATUSES"
          :key="s"
          type="button"
          role="tab"
          class="lpl__tab"
          :class="{ 'lpl__tab--on': status === s }"
          :aria-selected="status === s"
          @click="status = s"
        >{{ t(`learningPrograms.status.${s}`) }}</button>
      </div>
    </div>

    <p v-if="loading" class="lpl__muted">{{ t('loader.loading') }}</p>
    <p v-else-if="failed" class="lpl__error" role="alert">{{ t('learningPrograms.errors.load') }}</p>
    <EmptyState v-else-if="!rows.length" :title="t('learningPrograms.list.empty')">
      <Button @click="createOpen = true">{{ t('learningPrograms.list.new') }}</Button>
    </EmptyState>
    <ul v-else class="lpl__grid">
      <li v-for="p in rows" :key="p.id">
        <RouterLink :to="{ name: 'learning-program', params: { id: p.id } }" class="lpl__card" data-testid="lp-card">
          <div class="lpl__row">
            <span class="lpl__learner">{{ p.target.learner?.display_name ?? t('learningPrograms.list.group') }}</span>
            <Badge v-if="p.attention.length" variant="warning">{{ t('learningPrograms.list.attention') }}</Badge>
          </div>
          <div class="lpl__name">{{ p.title }}</div>
          <div class="lpl__now">
            <span class="lpl__k">{{ t('learningPrograms.list.now') }}</span>
            {{ p.current?.title ?? t('learningPrograms.list.finished') }}
          </div>
          <div v-if="p.next_session" class="lpl__next">
            <span class="lpl__k">{{ t('learningPrograms.list.nextSession') }}</span>
            {{ formatWhen(p.next_session.starts_at) }}
          </div>
        </RouterLink>
      </li>
    </ul>

    <CreateProgramDialog :open="createOpen" @close="createOpen = false" @created="onCreated" />
  </div>
</template>

<script setup lang="ts">
/**
 * «Програми» (ТЗ §5.1): лише власні програми; учень, назва, поточне заняття, наступна подія розкладу,
 * позначка «потрібна увага». Пошук і фільтр стану — на сервері (ті самі параметри зберігаються при гортанні).
 */
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import EmptyState from '@/ui/EmptyState.vue'
import CreateProgramDialog from '../components/CreateProgramDialog.vue'
import { learningProgramsApi, type ProgramDetail, type ProgramListItem } from '../api/learningProgramsApi'

const STATUSES = ['active', 'paused', 'done'] as const
const { t, locale } = useI18n({ useScope: 'global' })
const router = useRouter()

const rows = ref<ProgramListItem[]>([])
const loading = ref(true)
const failed = ref(false)
const query = ref('')
const status = ref<(typeof STATUSES)[number]>('active')
const createOpen = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  failed.value = false
  try {
    const page = await learningProgramsApi.list({ status: status.value, q: query.value.trim() || undefined })
    if (mine === seq) rows.value = page.results
  } catch {
    if (mine === seq) failed.value = true
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch(status, load)
watch(query, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(load, 300)
})
onMounted(load)

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(locale.value === 'uk' ? 'uk-UA' : 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function onCreated(p: ProgramDetail) {
  createOpen.value = false
  router.push({ name: 'learning-program', params: { id: p.id } })
}
</script>

<style scoped>
.lpl { display: flex; flex-direction: column; gap: 20px; }
.lpl__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.lpl__title { margin: 0; font-size: var(--text-2xl); color: var(--text-primary); }
.lpl__sub { margin: 4px 0 0; color: var(--text-secondary); }
.lpl__filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.lpl__search {
  flex: 1 1 240px; min-width: 0; padding: 10px 12px; border: 1px solid var(--border-color);
  border-radius: var(--radius-md); background: var(--card-bg); color: var(--text-primary);
}
.lpl__tabs { display: flex; gap: 4px; }
.lpl__tab {
  padding: 8px 14px; border-radius: var(--radius-full); border: 1px solid var(--border-color);
  background: var(--card-bg); color: var(--text-secondary); cursor: pointer;
}
.lpl__tab--on { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
.lpl__muted { color: var(--text-secondary); }
.lpl__error { color: var(--ui-color-danger); }
.lpl__grid {
  list-style: none; margin: 0; padding: 0; display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}
.lpl__card {
  display: flex; flex-direction: column; gap: 8px; padding: 16px; border-radius: var(--radius-lg);
  border: 1px solid var(--border-color); background: var(--surface-card, var(--card-bg));
  color: inherit; text-decoration: none; transition: border-color 0.15s;
}
.lpl__card:hover { border-color: var(--accent); }
.lpl__row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.lpl__learner { font-weight: 700; color: var(--text-primary); }
.lpl__name { color: var(--text-secondary); font-size: var(--text-sm); }
.lpl__now, .lpl__next { font-size: var(--text-sm); color: var(--text-primary); }
.lpl__k { display: block; font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
</style>
