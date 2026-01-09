<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMatchStore } from '@/modules/matches/store/matchStore'
import { User, MessageCircle, Calendar } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const matchStore = useMatchStore()

const loading = ref(false)
const activeMatch = computed(() => matchStore.activeMatches[0] || null)

async function loadMyTutor() {
  loading.value = true
  try {
    await matchStore.fetchMatches({ role: 'student', status: 'active' })
  } finally {
    loading.value = false
  }
}

function openChat() {
  if (activeMatch.value) {
    router.push(`/matches/${activeMatch.value.match_id}`)
  }
}

function bookLesson() {
  if (activeMatch.value) {
    router.push(`/matches/${activeMatch.value.match_id}/booking`)
  }
}

onMounted(() => {
  loadMyTutor()
})
</script>

<template>
  <div class="my-tutor-widget">
    <h3>{{ t('studentDashboard.myTutor.title') }}</h3>

    <div v-if="loading" class="loading">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="!activeMatch" class="empty">
      <User :size="48" />
      <p>{{ t('studentDashboard.myTutor.noTutor') }}</p>
      <button class="btn btn-primary" @click="router.push('/marketplace')">
        {{ t('studentDashboard.myTutor.findTutor') }}
      </button>
    </div>

    <div v-else class="tutor-info">
      <div class="tutor-header">
        <div class="avatar">
          <User :size="32" />
        </div>
        <div class="info">
          <h4>{{ activeMatch.tutor_summary?.name }}</h4>
          <p>{{ activeMatch.tutor_summary?.bio }}</p>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" @click="openChat">
          <MessageCircle :size="18" />
          {{ t('studentDashboard.myTutor.message') }}
        </button>
        <button class="btn btn-primary" @click="bookLesson">
          <Calendar :size="18" />
          {{ t('studentDashboard.myTutor.bookLesson') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-tutor-widget {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

.my-tutor-widget h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  color: var(--text-primary);
}

.loading,
.empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty p {
  margin: 0;
  font-size: 0.9375rem;
}

.tutor-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tutor-header {
  display: flex;
  gap: 1rem;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--surface-secondary);
  border-radius: 50%;
  flex-shrink: 0;
}

.info {
  flex: 1;
}

.info h4 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.info p {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}
</style>
