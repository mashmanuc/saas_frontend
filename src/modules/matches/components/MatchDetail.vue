<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMatchStore } from '../store/matchStore'
import { CheckCircle, XCircle, Archive, User } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const { t } = useI18n()
const route = useRoute()
const matchStore = useMatchStore()

const matchId = computed(() => route.params.id as string)
const match = computed(() => matchStore.currentMatch)
const loading = ref(false)
const actionLoading = ref(false)

async function loadMatch() {
  loading.value = true
  try {
    const matches = await matchStore.fetchMatches({})
    const found = matches.results?.find((m: any) => m.match_id === matchId.value)
    if (found) {
      matchStore.setCurrentMatch(found)
    }
  } finally {
    loading.value = false
  }
}

async function acceptMatch() {
  actionLoading.value = true
  try {
    await matchStore.acceptMatch(matchId.value)
  } finally {
    actionLoading.value = false
  }
}

async function declineMatch() {
  actionLoading.value = true
  try {
    await matchStore.declineMatch(matchId.value)
  } finally {
    actionLoading.value = false
  }
}

async function archiveMatch() {
  actionLoading.value = true
  try {
    await matchStore.archiveMatch(matchId.value)
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  loadMatch()
})
</script>

<template>
  <div class="match-detail">
    <div v-if="loading" class="loading">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="match" class="content">
      <div class="header">
        <h2>{{ t('matches.detail.title') }}</h2>
        <span :class="['status-badge', match.status]">
          {{ t(`matches.status.${match.status}`) }}
        </span>
      </div>

      <div class="profiles">
        <div class="profile-card">
          <User :size="24" />
          <h3>{{ t('matches.detail.tutor') }}</h3>
          <p>{{ match.tutor_summary?.name }}</p>
        </div>

        <div class="profile-card">
          <User :size="24" />
          <h3>{{ t('matches.detail.student') }}</h3>
          <p>{{ match.student_summary?.name }}</p>
        </div>
      </div>

      <div v-if="match.status === 'invited'" class="actions">
        <Button variant="primary" :disabled="actionLoading" @click="acceptMatch">
          <CheckCircle :size="18" />
          {{ t('matches.actions.accept') }}
        </Button>
        <Button variant="outline" :disabled="actionLoading" @click="declineMatch">
          <XCircle :size="18" />
          {{ t('matches.actions.decline') }}
        </Button>
      </div>

      <div v-if="match.status === 'active'" class="actions">
        <Button variant="outline" :disabled="actionLoading" @click="archiveMatch">
          <Archive :size="18" />
          {{ t('matches.actions.archive') }}
        </Button>
      </div>

      <div class="timeline">
        <h3>{{ t('matches.detail.timeline') }}</h3>
        <p class="activity">{{ t('matches.lastActivity', { time: match.last_activity_at }) }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.match-detail {
  padding: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm, 4px);
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.invited {
  background: var(--warning-bg, #fef3c7);
  color: var(--warning, #f59e0b);
}

.status-badge.active {
  background: var(--success-bg, #d1fae5);
  color: var(--success, #10b981);
}

.status-badge.archived {
  background: var(--surface-secondary);
  color: var(--text-secondary);
}

.profiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.profile-card {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

.profile-card h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem 0;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.profile-card p {
  font-size: 1.125rem;
  font-weight: 500;
  margin: 0;
  color: var(--text-primary);
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.timeline {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

.timeline h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.activity {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}
</style>
