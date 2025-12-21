<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMatchStore } from '../store/matchStore'
import { Users, Clock, Archive, CheckCircle } from 'lucide-vue-next'

const props = defineProps<{
  role: 'tutor' | 'student'
}>()

const { t } = useI18n()
const router = useRouter()
const matchStore = useMatchStore()

const activeTab = ref<'invited' | 'active' | 'archived'>('invited')
const loading = ref(false)

const tabs = computed(() => [
  { key: 'invited', label: t('matches.tabs.invited'), icon: Clock },
  { key: 'active', label: t('matches.tabs.active'), icon: CheckCircle },
  { key: 'archived', label: t('matches.tabs.archived'), icon: Archive }
])

const filteredMatches = computed(() => {
  switch (activeTab.value) {
    case 'invited':
      return matchStore.invitedMatches
    case 'active':
      return matchStore.activeMatches
    case 'archived':
      return matchStore.archivedMatches
    default:
      return []
  }
})

async function loadMatches() {
  loading.value = true
  try {
    await matchStore.fetchMatches({ role: props.role, status: activeTab.value })
  } finally {
    loading.value = false
  }
}

function viewMatch(match: any) {
  router.push(`/matches/${match.match_id}`)
}

onMounted(() => {
  loadMatches()
})
</script>

<template>
  <div class="match-list">
    <div class="header">
      <h2>{{ t('matches.title') }}</h2>
    </div>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key; loadMatches()"
      >
        <component :is="tab.icon" :size="18" />
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="loading">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="filteredMatches.length === 0" class="empty">
      <Users :size="48" />
      <p>{{ t('matches.empty') }}</p>
    </div>

    <div v-else class="matches">
      <div
        v-for="match in filteredMatches"
        :key="match.match_id"
        class="match-card"
        @click="viewMatch(match)"
      >
        <div class="match-info">
          <h3>{{ role === 'tutor' ? match.student_summary?.name : match.tutor_summary?.name }}</h3>
          <p class="status">{{ t(`matches.status.${match.status}`) }}</p>
          <p class="activity">{{ t('matches.lastActivity', { time: match.last_activity_at }) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.match-list {
  padding: 1.5rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  color: var(--text-primary);
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.loading,
.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.matches {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.match-card {
  padding: 1.25rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.2s;
}

.match-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.match-info h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.status {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem 0;
}

.activity {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin: 0;
}
</style>
