<template>
  <div class="exp-panel" data-testid="experiments-panel">
    <!-- Create Button -->
    <div class="exp-toolbar">
      <button class="create-btn" @click="showCreateForm = !showCreateForm">
        {{ showCreateForm ? $t('staff.experiments.cancel') : $t('staff.experiments.create') }}
      </button>
    </div>

    <!-- Create Form -->
    <div v-if="showCreateForm" class="exp-create-form">
      <div class="form-row">
        <label>{{ $t('staff.experiments.fieldName') }}</label>
        <input v-model="form.name" type="text" class="form-input" />
      </div>
      <div class="form-row">
        <label>{{ $t('staff.experiments.fieldFlagName') }}</label>
        <input v-model="form.flag_name" type="text" class="form-input" placeholder="e.g. new_onboarding_flow" />
      </div>
      <div class="form-row">
        <label>{{ $t('staff.experiments.fieldHypothesis') }}</label>
        <textarea v-model="form.hypothesis" class="form-input" rows="2" />
      </div>
      <div class="form-row">
        <label>{{ $t('staff.experiments.fieldSuccessMetric') }}</label>
        <input v-model="form.success_metric" type="text" class="form-input" placeholder="e.g. profile.published" />
      </div>
      <div class="form-row">
        <label>{{ $t('staff.experiments.fieldTraffic') }}</label>
        <input v-model.number="form.traffic_percentage" type="number" min="1" max="100" class="form-input small" />
        <span class="form-hint">%</span>
      </div>
      <button class="submit-btn" :disabled="!form.name || !form.flag_name || !form.success_metric" @click="createExperiment">
        {{ $t('staff.experiments.submitCreate') }}
      </button>
      <p v-if="createError" class="form-error">{{ createError }}</p>
    </div>

    <!-- Filters -->
    <div class="exp-filters">
      <select v-model="filters.status" class="filter-select" @change="loadData">
        <option value="">{{ $t('staff.experiments.allStatuses') }}</option>
        <option value="draft">Draft</option>
        <option value="running">Running</option>
        <option value="paused">Paused</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="exp-loading">
      <div class="spinner" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="exp-error">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadData">{{ $t('staff.experiments.retry') }}</button>
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="exp-empty">
      <p>{{ $t('staff.experiments.noData') }}</p>
    </div>

    <!-- Experiments Table -->
    <div v-else class="exp-table-wrap">
      <table class="exp-table">
        <thead>
          <tr>
            <th>{{ $t('staff.experiments.colName') }}</th>
            <th>{{ $t('staff.experiments.colFlag') }}</th>
            <th>{{ $t('staff.experiments.colStatus') }}</th>
            <th class="text-right">{{ $t('staff.experiments.colTraffic') }}</th>
            <th class="text-right">{{ $t('staff.experiments.colAssigned') }}</th>
            <th>{{ $t('staff.experiments.colMetric') }}</th>
            <th>{{ $t('staff.experiments.colWinner') }}</th>
            <th>{{ $t('staff.experiments.colActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="exp in items" :key="exp.id">
            <td>
              <div class="exp-name">{{ exp.name }}</div>
              <div v-if="exp.hypothesis" class="exp-hypothesis">{{ exp.hypothesis }}</div>
            </td>
            <td><code class="flag-code">{{ exp.flag_name }}</code></td>
            <td>
              <span class="status-badge" :class="'status-' + exp.status">{{ exp.status }}</span>
            </td>
            <td class="text-right">{{ exp.traffic_percentage }}%</td>
            <td class="text-right">{{ exp.assignment_count }}</td>
            <td><code class="metric-code">{{ exp.success_metric }}</code></td>
            <td>
              <span v-if="exp.results?.winner" class="winner-badge">{{ exp.results.winner }}</span>
              <span v-else class="no-winner">—</span>
            </td>
            <td>
              <div class="action-btns">
                <button
                  v-if="exp.status === 'draft' || exp.status === 'paused'"
                  class="action-btn start"
                  @click="startExp(exp.id)"
                >▶</button>
                <button
                  v-if="exp.status === 'running'"
                  class="action-btn stop"
                  @click="stopExp(exp.id)"
                >⏹</button>
                <button
                  class="action-btn results"
                  @click="viewResults(exp)"
                >📊</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="exp-pagination">
        <button class="page-btn" :disabled="filters.page <= 1" @click="filters.page--; loadData()">&laquo;</button>
        <span class="page-info">{{ $t('staff.experiments.page') }} {{ filters.page }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="filters.page >= totalPages" @click="filters.page++; loadData()">&raquo;</button>
      </div>
    </div>

    <!-- Results Modal -->
    <div v-if="selectedExp" class="results-overlay" @click.self="selectedExp = null">
      <div class="results-modal">
        <div class="modal-header">
          <h3>{{ selectedExp.name }} — {{ $t('staff.experiments.resultsTitle') }}</h3>
          <button class="close-btn" @click="selectedExp = null">&times;</button>
        </div>
        <div v-if="resultsLoading" class="exp-loading"><div class="spinner" /></div>
        <div v-else-if="resultsData" class="modal-body">
          <div class="results-grid">
            <div v-for="(vr, vname) in resultsData.variants" :key="vname" class="variant-card" :class="{ winner: resultsData.winner === vname }">
              <div class="variant-name">{{ vname }}</div>
              <div class="variant-rate">{{ (vr.rate * 100).toFixed(1) }}%</div>
              <div class="variant-counts">{{ vr.converted }} / {{ vr.assigned }}</div>
            </div>
          </div>
          <div v-if="resultsData.chi_squared" class="chi-section">
            <span class="chi-label">χ² = {{ resultsData.chi_squared.statistic }}</span>
            <span class="chi-label">p = {{ resultsData.chi_squared.p_value }}</span>
            <span class="sig-badge" :class="resultsData.chi_squared.significant ? 'sig-yes' : 'sig-no'">
              {{ resultsData.chi_squared.significant ? $t('staff.experiments.significant') : $t('staff.experiments.notSignificant') }}
            </span>
          </div>
          <div v-if="resultsData.winner" class="winner-section">
            {{ $t('staff.experiments.winnerIs') }}: <strong>{{ resultsData.winner }}</strong>
          </div>
          <button class="recompute-btn" @click="fetchResults(selectedExp!, true)">{{ $t('staff.experiments.recompute') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import staffAnalyticsApi from '../api/staffAnalyticsApi'
import type { ExperimentItem, ExperimentResults } from '../api/staffAnalyticsApi'

const { t } = useI18n()

const loading = ref(false)
const error = ref<string | null>(null)
const items = ref<ExperimentItem[]>([])
const total = ref(0)

const filters = reactive({ status: '', page: 1, page_size: 20 })
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / filters.page_size)))

// Create form
const showCreateForm = ref(false)
const createError = ref<string | null>(null)
const form = reactive({
  name: '',
  flag_name: '',
  hypothesis: '',
  success_metric: '',
  traffic_percentage: 100,
})

// Results
const selectedExp = ref<ExperimentItem | null>(null)
const resultsLoading = ref(false)
const resultsData = ref<ExperimentResults | null>(null)

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await staffAnalyticsApi.getExperiments({
      status: filters.status || undefined,
      page: filters.page,
      page_size: filters.page_size,
    })
    items.value = res.results
    total.value = res.total
  } catch (e: any) {
    error.value = e?.message || 'Failed to load experiments'
  } finally {
    loading.value = false
  }
}

async function createExperiment() {
  createError.value = null
  try {
    await staffAnalyticsApi.createExperiment({
      name: form.name,
      flag_name: form.flag_name,
      hypothesis: form.hypothesis,
      success_metric: form.success_metric,
      traffic_percentage: form.traffic_percentage,
    })
    showCreateForm.value = false
    form.name = ''
    form.flag_name = ''
    form.hypothesis = ''
    form.success_metric = ''
    form.traffic_percentage = 100
    await loadData()
  } catch (e: any) {
    createError.value = e?.response?.data?.error || e?.message || 'Create failed'
  }
}

async function startExp(id: string) {
  try {
    await staffAnalyticsApi.startExperiment(id)
    await loadData()
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Start failed'
  }
}

async function stopExp(id: string) {
  try {
    await staffAnalyticsApi.stopExperiment(id)
    await loadData()
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Stop failed'
  }
}

async function viewResults(exp: ExperimentItem) {
  selectedExp.value = exp
  await fetchResults(exp, false)
}

async function fetchResults(exp: ExperimentItem, recompute: boolean) {
  resultsLoading.value = true
  resultsData.value = null
  try {
    resultsData.value = await staffAnalyticsApi.getExperimentResults(exp.id, recompute)
  } catch {
    resultsData.value = null
  } finally {
    resultsLoading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.exp-panel { display: flex; flex-direction: column; gap: 1rem; }

.exp-toolbar { display: flex; justify-content: flex-end; }

.create-btn {
  padding: 0.375rem 1rem;
  border: 1px solid var(--color-primary, #3b82f6);
  border-radius: 6px;
  background: var(--color-primary, #3b82f6);
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
}

.exp-create-form {
  background: var(--color-bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row { display: flex; align-items: center; gap: 0.5rem; }
.form-row label { min-width: 120px; font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary, #6b7280); }
.form-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 0.875rem;
}
.form-input.small { max-width: 80px; }
.form-hint { font-size: 0.8rem; color: var(--color-text-secondary, #6b7280); }
.form-error { color: var(--color-danger, #dc2626); font-size: 0.8rem; }

.submit-btn {
  align-self: flex-end;
  padding: 0.375rem 1rem;
  border: none;
  border-radius: 6px;
  background: var(--color-primary, #3b82f6);
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
}
.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.exp-filters { display: flex; gap: 0.5rem; }
.filter-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--color-bg, #fff);
}

.exp-loading { display: flex; justify-content: center; padding: 2rem; }
.spinner {
  width: 2rem; height: 2rem;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.exp-error { text-align: center; padding: 1.5rem; color: var(--color-danger, #dc2626); }
.retry-btn { margin-top: 0.5rem; padding: 0.375rem 1rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 6px; background: var(--color-bg, #fff); cursor: pointer; }
.exp-empty { text-align: center; padding: 2rem; color: var(--color-text-secondary, #6b7280); }

.exp-table-wrap { overflow-x: auto; }
.exp-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.exp-table th {
  text-align: left; padding: 0.5rem 0.75rem;
  border-bottom: 2px solid var(--color-border, #e5e7eb);
  font-weight: 600; font-size: 0.75rem;
  text-transform: uppercase; letter-spacing: 0.025em;
  color: var(--color-text-secondary, #6b7280); white-space: nowrap;
}
.exp-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-border-light, #f3f4f6); vertical-align: middle; }
.exp-table tbody tr:hover { background: var(--color-bg-hover, #f9fafb); }
.text-right { text-align: right; }

.exp-name { font-weight: 600; }
.exp-hypothesis { font-size: 0.75rem; color: var(--color-text-secondary, #9ca3af); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.flag-code, .metric-code {
  font-size: 0.75rem; padding: 0.125rem 0.375rem;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 4px; font-family: monospace;
}

.status-badge {
  display: inline-block; padding: 0.125rem 0.5rem;
  border-radius: 999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
}
.status-draft { background: #e5e7eb; color: #374151; }
.status-running { background: #dbeafe; color: #1e40af; }
.status-paused { background: #fef3c7; color: #92400e; }
.status-completed { background: #d1fae5; color: #065f46; }
.status-cancelled { background: #fee2e2; color: #991b1b; }

.winner-badge { background: #d1fae5; color: #065f46; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.no-winner { color: var(--color-text-secondary, #9ca3af); }

.action-btns { display: flex; gap: 0.25rem; }
.action-btn {
  padding: 0.25rem 0.5rem; border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px; background: var(--color-bg, #fff); cursor: pointer; font-size: 0.8rem;
}
.action-btn.start:hover { background: #dbeafe; }
.action-btn.stop:hover { background: #fee2e2; }
.action-btn.results:hover { background: #fef3c7; }

.exp-pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 0.75rem 0; }
.page-btn { padding: 0.25rem 0.75rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 6px; background: var(--color-bg, #fff); cursor: pointer; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 0.875rem; color: var(--color-text-secondary, #6b7280); }

/* Results Modal */
.results-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.results-modal {
  background: var(--color-bg, #fff); border-radius: 12px;
  padding: 1.5rem; min-width: 400px; max-width: 600px; width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.modal-header h3 { font-size: 1rem; font-weight: 700; }
.close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--color-text-secondary, #6b7280); }

.results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.variant-card {
  background: var(--color-bg-secondary, #f8f9fa); border-radius: 8px;
  padding: 0.75rem; text-align: center; border: 2px solid transparent;
}
.variant-card.winner { border-color: #059669; background: #ecfdf5; }
.variant-name { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-secondary, #6b7280); }
.variant-rate { font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0; }
.variant-counts { font-size: 0.75rem; color: var(--color-text-secondary, #9ca3af); }

.chi-section { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; }
.chi-label { font-size: 0.8rem; font-family: monospace; color: var(--color-text-secondary, #6b7280); }
.sig-badge { font-size: 0.75rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 999px; }
.sig-yes { background: #d1fae5; color: #065f46; }
.sig-no { background: #fee2e2; color: #991b1b; }

.winner-section { font-size: 0.9rem; margin-bottom: 0.75rem; }

.recompute-btn {
  padding: 0.375rem 1rem; border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px; background: var(--color-bg, #fff); cursor: pointer; font-size: 0.8rem;
}
</style>
