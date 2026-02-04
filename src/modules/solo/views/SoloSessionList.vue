<template>
  <div class="solo-sessions">
    <!-- Header -->
    <header class="solo-sessions__header">
      <h1>{{ $t('solo.mySessions.title') }}</h1>
      <div class="solo-sessions__actions">
        <button class="btn btn-secondary" @click="createNew">
          <span class="icon">➕</span>
          {{ $t('solo.mySessions.createNew') }}
        </button>
        <button class="btn btn-primary" @click="createNewV2">
          <span class="icon">✨</span>
          {{ $t('solo.mySessions.createNewV2') }}
        </button>
      </div>
    </header>

    <!-- Filters -->
    <div class="solo-sessions__filters">
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="$t('solo.mySessions.search')"
        class="search-input"
      />
      <select v-model="sortBy" class="sort-select">
        <option value="updated">{{ $t('solo.mySessions.sortUpdated') }}</option>
        <option value="created">{{ $t('solo.mySessions.sortCreated') }}</option>
        <option value="name">{{ $t('solo.mySessions.sortName') }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="solo-sessions__loading">
      <span class="spinner">⏳</span>
      <p>{{ $t('common.loading') }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="sessions.length === 0" class="solo-sessions__empty">
      <span class="icon">📝</span>
      <p>{{ $t('solo.mySessions.empty') }}</p>
      <button class="btn btn-primary" @click="createNew">
        {{ $t('solo.mySessions.createFirst') }}
      </button>
    </div>

    <!-- Session grid -->
    <SessionGrid
      v-else
      :sessions="filteredSessions"
      @open="openSession"
      @delete="deleteSession"
      @duplicate="duplicateSession"
      @share="openShareModal"
    />

    <!-- Sharing modal -->
    <SharingModal
      v-if="sharingSession"
      :session="sharingSession"
      @close="sharingSession = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSoloStore } from '../store/soloStore'
import SessionGrid from '../components/sessions/SessionGrid.vue'
import SharingModal from '../components/sharing/SharingModal.vue'
import type { SoloSession } from '../types/solo'

const router = useRouter()
const soloStore = useSoloStore()

// State
const searchQuery = ref('')
const sortBy = ref<'updated' | 'created' | 'name'>('updated')
const sharingSession = ref<SoloSession | null>(null)

// Computed
const isLoading = computed(() => soloStore.isLoading)
const sessions = computed(() => soloStore.sessions)

const filteredSessions = computed(() => {
  let result = [...sessions.value]

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((s) => s.name.toLowerCase().includes(query))
  }

  // Sort
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'name':
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  return result
})

// Methods
async function createNew(): Promise<void> {
  const session = await soloStore.createSession({ name: 'Untitled' })
  router.push({ name: 'solo-workspace-edit', params: { id: session.id } })
}

async function createNewV2(): Promise<void> {
  const session = await soloStore.createSession({ name: 'Untitled', version: 'v2' })
  router.push({ name: 'solo-workspace-v2-edit', params: { id: session.id } })
}

function openSession(session: SoloSession): void {
  // Check if it's V2 session and route accordingly
  if (session.version === 'v2') {
    router.push({ name: 'solo-workspace-v2-edit', params: { id: session.id } })
  } else {
    router.push({ name: 'solo-workspace-edit', params: { id: session.id } })
  }
}

async function deleteSession(session: SoloSession): Promise<void> {
  if (confirm(`Delete "${session.name}"?`)) {
    await soloStore.deleteSession(session.id)
  }
}

async function duplicateSession(session: SoloSession): Promise<void> {
  await soloStore.duplicateSession(session.id)
}

function openShareModal(session: SoloSession): void {
  sharingSession.value = session
}

// Lifecycle
onMounted(() => {
  soloStore.fetchSessions()
})
</script>

<style scoped>
.solo-sessions {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.solo-sessions__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.solo-sessions__header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.solo-sessions__filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
  max-width: 300px;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
}

.sort-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
}

.solo-sessions__loading {
  text-align: center;
  padding: 4rem 2rem;
}

.solo-sessions__loading .spinner {
  font-size: 2rem;
  display: block;
  margin-bottom: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.solo-sessions__empty {
  text-align: center;
  padding: 4rem 2rem;
}

.solo-sessions__empty .icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
}

.solo-sessions__empty p {
  margin-bottom: 1.5rem;
  color: var(--text-secondary, #6b7280);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent-color, #3b82f6);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--secondary-color, #6b7280);
  color: white;
}

.btn-secondary:hover {
  opacity: 0.9;
}

.solo-sessions__actions {
  display: flex;
  gap: 0.75rem;
}
</style>
