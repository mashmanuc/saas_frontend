<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMatchStore } from '@/modules/matches/store/matchStore'
import { Search, Filter, RefreshCw } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const { t } = useI18n()
const matchStore = useMatchStore()

const filters = ref({
  status: '',
  tutor_id: '',
  student_id: ''
})

const loading = ref(false)

async function loadMatches() {
  loading.value = true
  try {
    await matchStore.fetchMatches(filters.value)
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  filters.value = {
    status: '',
    tutor_id: '',
    student_id: ''
  }
  loadMatches()
}

onMounted(() => {
  loadMatches()
})
</script>

<template>
  <div class="matches-console">
    <div class="header">
      <h2>{{ t('operator.matches.title') }}</h2>
      <Button variant="secondary" @click="loadMatches">
        <RefreshCw :size="18" />
        {{ t('common.refresh') }}
      </Button>
    </div>

    <div class="filters">
      <div class="filter-field">
        <label>{{ t('operator.matches.status') }}</label>
        <select v-model="filters.status" class="input">
          <option value="">{{ t('common.all') }}</option>
          <option value="invited">{{ t('matches.status.invited') }}</option>
          <option value="active">{{ t('matches.status.active') }}</option>
          <option value="archived">{{ t('matches.status.archived') }}</option>
        </select>
      </div>

      <div class="filter-field">
        <label>{{ t('operator.matches.tutorId') }}</label>
        <input v-model="filters.tutor_id" type="text" class="input" />
      </div>

      <div class="filter-field">
        <label>{{ t('operator.matches.studentId') }}</label>
        <input v-model="filters.student_id" type="text" class="input" />
      </div>

      <div class="filter-actions">
        <Button variant="secondary" @click="clearFilters">
          {{ t('common.clear') }}
        </Button>
        <Button variant="primary" @click="loadMatches">
          <Search :size="18" />
          {{ t('common.search') }}
        </Button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="matchStore.matches.length === 0" class="empty">
      {{ t('operator.matches.empty') }}
    </div>

    <div v-else class="matches-table">
      <table>
        <thead>
          <tr>
            <th>{{ t('operator.matches.matchId') }}</th>
            <th>{{ t('operator.matches.tutor') }}</th>
            <th>{{ t('operator.matches.student') }}</th>
            <th>{{ t('operator.matches.status') }}</th>
            <th>{{ t('operator.matches.lastActivity') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="match in matchStore.matches" :key="match.match_id">
            <td>{{ match.match_id }}</td>
            <td>{{ match.tutor_summary?.name }}</td>
            <td>{{ match.student_summary?.name }}</td>
            <td>
              <span :class="['status-badge', match.status]">
                {{ t(`matches.status.${match.status}`) }}
              </span>
            </td>
            <td>{{ match.last_activity_at }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.matches-console {
  padding: 1.5rem;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  background: var(--surface-input);
  color: var(--text-primary);
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
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

.loading,
.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.matches-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

thead {
  background: var(--surface-secondary);
}

th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

td {
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: var(--surface-hover);
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm, 4px);
  font-size: 0.8125rem;
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
</style>
