<template>
  <div class="tutor-activity-page" data-test="tutor-activity-page">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.tutorActivity.title') }}</h1>
      <p class="help-text">{{ $t('staff.tutorActivity.helpText') }}</p>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <input
        v-model="filters.query"
        type="text"
        :placeholder="$t('staff.tutorActivity.filters.searchPlaceholder')"
        class="filter-input"
        data-test="query-filter"
        @input="debouncedLoadTutors"
      />
      <select
        v-model="filters.status"
        class="filter-select"
        data-test="status-filter"
        @change="loadTutors"
      >
        <option value="">{{ $t('staff.tutorActivity.filters.allStatuses') }}</option>
        <option value="ACTIVE">{{ $t('staff.tutorActivity.states.active') }}</option>
        <option value="INACTIVE_SOFT">{{ $t('staff.tutorActivity.states.inactive') }}</option>
      </select>
    </div>

    <div v-if="loading && !tutors.length" class="loading-state" data-test="loading-state">
      <p class="muted-text">{{ $t('staff.tutorActivity.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state" data-test="error-state">
      <p class="error-text">{{ error }}</p>
      <button class="retry-btn" @click="loadTutors">{{ $t('common.retry') }}</button>
    </div>

    <div v-else-if="tutors.length" class="table-wrapper" data-test="tutors-table-container">
      <table class="data-table" data-test="tutors-table">
        <thead>
          <tr>
            <th>{{ $t('staff.tutorActivity.table.tutorId') }}</th>
            <th>{{ $t('staff.tutorActivity.table.tutor') }}</th>
            <th>{{ $t('staff.tutorActivity.table.status') }}</th>
            <th class="col-center">{{ $t('staff.tutorActivity.table.eligible') }}</th>
            <th class="col-center">{{ $t('staff.tutorActivity.table.responses') }}</th>
            <th>{{ $t('staff.tutorActivity.table.exemptionReason') }}</th>
            <th class="col-center">{{ $t('staff.tutorActivity.table.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tutor in tutors"
            :key="tutor.tutor_id"
            :data-test="`tutor-row-${tutor.tutor_id}`"
          >
            <td class="cell-id">{{ tutor.tutor_id }}</td>
            <td>
              <div class="tutor-name">{{ tutor.full_name }}</div>
              <div class="tutor-email">{{ tutor.email }}</div>
            </td>
            <td>
              <div class="status-cell">
                <span
                  class="status-badge"
                  :class="getUserFriendlyStatusClass(getUserFriendlyStatus(tutor.activity_status, tutor.activity_reason))"
                  :title="getActivityReasonTooltip(tutor.activity_reason)"
                >
                  {{ getUserFriendlyStatusLabel(getUserFriendlyStatus(tutor.activity_status, tutor.activity_reason)) }}
                </span>
                <span
                  v-if="tutor.activity_reason"
                  class="info-icon"
                  :title="getActivityReasonTooltip(tutor.activity_reason)"
                >
                  <Info :size="14" />
                </span>
              </div>
            </td>
            <td class="col-center">
              <span v-if="tutor.eligible" class="eligible-check">✓</span>
              <span v-else class="muted-text">—</span>
            </td>
            <td class="col-center">{{ tutor.reactions_count_current_month }}</td>
            <td>
              <span v-if="tutor.exemption_reason" class="exemption-text">{{ tutor.exemption_reason }}</span>
              <span v-else class="muted-text">—</span>
            </td>
            <td class="col-center">
              <button
                class="grant-btn"
                :data-test="`grant-exemption-btn-${tutor.tutor_id}`"
                @click="openGrantModal(tutor)"
              >
                {{ $t('staff.tutorActivity.table.grantExemption') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination-bar">
        <span class="pagination-info">
          {{ $t('staff.tutorActivity.pagination.showing', { count: tutors.length, total: totalTutors }) }}
        </span>
        <div class="pagination-btns">
          <button
            class="page-btn"
            :disabled="pagination.offset === 0"
            data-test="prev-page-btn"
            @click="previousPage"
          >
            {{ $t('common.previous') }}
          </button>
          <button
            class="page-btn"
            :disabled="pagination.offset + pagination.limit >= totalTutors"
            data-test="next-page-btn"
            @click="nextPage"
          >
            {{ $t('common.next') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state" data-test="tutors-empty">
      <p class="muted-text">{{ $t('staff.tutorActivity.empty') }}</p>
    </div>

    <GrantExemptionModal
      :is-open="isModalOpen"
      :tutor="selectedTutor"
      @close="closeGrantModal"
      @success="handleGrantSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info } from 'lucide-vue-next'
import staffApi from '../api/staffApi'
import type { TutorActivityListItem } from '../api/staffApi'
import GrantExemptionModal from '../components/GrantExemptionModal.vue'

const { t } = useI18n()

const tutors = ref<TutorActivityListItem[]>([])
const totalTutors = ref(0)
const loading = ref(false)
const error = ref('')

const filters = ref({
  query: '',
  status: '',
})

const pagination = ref({
  limit: 50,
  offset: 0,
})

const isModalOpen = ref(false)
const selectedTutor = ref<TutorActivityListItem | null>(null)

async function loadTutors() {
  loading.value = true
  error.value = ''

  try {
    const params: any = {
      limit: pagination.value.limit,
      offset: pagination.value.offset,
    }
    
    if (filters.value.query) {
      params.query = filters.value.query
    }
    
    if (filters.value.status) {
      params.status = filters.value.status
    }
    
    const response = await staffApi.getTutorActivityList(params)
    tutors.value = response.results
    totalTutors.value = response.count
  } catch (err: any) {
    if (err.response?.status === 401) {
      error.value = t('staff.tutorActivity.errors.unauthorized')
    } else if (err.response?.status === 403) {
      error.value = t('staff.tutorActivity.errors.forbidden')
    } else {
      error.value = t('staff.tutorActivity.errors.loadFailed')
    }
  } finally {
    loading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedLoadTutors() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pagination.value.offset = 0
    loadTutors()
  }, 300)
}

function previousPage() {
  if (pagination.value.offset > 0) {
    pagination.value.offset = Math.max(0, pagination.value.offset - pagination.value.limit)
    loadTutors()
  }
}

function nextPage() {
  if (pagination.value.offset + pagination.value.limit < totalTutors.value) {
    pagination.value.offset += pagination.value.limit
    loadTutors()
  }
}

function getStatusClass(status: string): string {
  if (status === 'ACTIVE') return 'bg-green-100 text-green-800'
  if (status === 'INACTIVE_SOFT') return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-800'
}

function getStatusLabel(status: string): string {
  if (status === 'ACTIVE') return t('staff.tutorActivity.states.active')
  if (status === 'INACTIVE_SOFT') return t('staff.tutorActivity.states.inactive')
  return status
}

function getUserFriendlyStatus(activityStatus: string, activityReason: string): string {
  // v0.93: Map backend status + reason to user-friendly states
  if (activityReason === 'EXEMPTED') return 'EXEMPTED'
  if (activityReason === 'NO_REACTIONS_THIS_MONTH') return 'AT_RISK'
  if (activityStatus === 'INACTIVE_SOFT') return 'INACTIVE'
  if (activityStatus === 'ACTIVE') return 'ACTIVE'
  return 'ACTIVE'
}

function getUserFriendlyStatusClass(friendlyStatus: string): string {
  if (friendlyStatus === 'ACTIVE') return 'status-active'
  if (friendlyStatus === 'INACTIVE') return 'status-inactive'
  if (friendlyStatus === 'EXEMPTED') return 'status-exempted'
  if (friendlyStatus === 'AT_RISK') return 'status-at-risk'
  return 'status-default'
}

function getUserFriendlyStatusLabel(friendlyStatus: string): string {
  if (friendlyStatus === 'ACTIVE') return t('staff.tutorActivity.states.active')
  if (friendlyStatus === 'INACTIVE') return t('staff.tutorActivity.states.inactive')
  if (friendlyStatus === 'EXEMPTED') return t('staff.tutorActivity.states.exempted')
  if (friendlyStatus === 'AT_RISK') return t('staff.tutorActivity.states.atRisk')
  return friendlyStatus
}

function getActivityReasonTooltip(reason: string): string {
  const tooltips: Record<string, string> = {
    'NO_REACTIONS_THIS_MONTH': t('staff.tutorActivity.reasons.noReactions'),
    'TRIAL_ACTIVE': t('staff.tutorActivity.reasons.trialActive'),
    'EXEMPTED': t('staff.tutorActivity.reasons.exempted'),
    'NOT_APPLICABLE': t('staff.tutorActivity.reasons.notApplicable'),
    'ACTIVE': t('staff.tutorActivity.reasons.active'),
  }
  return tooltips[reason] || reason
}

function openGrantModal(tutor: TutorActivityListItem) {
  selectedTutor.value = tutor
  isModalOpen.value = true
}

function closeGrantModal() {
  isModalOpen.value = false
  selectedTutor.value = null
}

async function handleGrantSuccess() {
  await loadTutors()
}

onMounted(() => {
  loadTutors()
})
</script>

<style scoped>
.tutor-activity-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.help-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.filters-bar {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.filter-input {
  flex: 1;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
}

.filter-input:focus {
  outline: none;
  border-color: var(--accent);
}

.filter-select {
  width: 200px;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
}

.filter-select:focus {
  outline: none;
  border-color: var(--accent);
}

.loading-state,
.empty-state {
  padding: var(--space-2xl);
  text-align: center;
}

.error-state {
  padding: var(--space-xl);
  text-align: center;
  background: color-mix(in srgb, #ef4444 8%, transparent);
  border: 1px solid color-mix(in srgb, #ef4444 20%, transparent);
  border-radius: var(--radius-md);
}

.error-text {
  color: #ef4444;
  margin-bottom: var(--space-md);
}

.retry-btn {
  padding: var(--space-xs) var(--space-md);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  font-family: inherit;
}

.retry-btn:hover {
  opacity: 0.9;
}

.muted-text {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.table-wrapper {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.data-table th {
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  font-weight: 600;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

.data-table th.col-center {
  text-align: center;
}

.data-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: middle;
}

.data-table td.col-center {
  text-align: center;
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.cell-id {
  font-family: monospace;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.tutor-name {
  font-weight: 500;
  color: var(--text-primary);
}

.tutor-email {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: 1px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
}

.status-active   { background: color-mix(in srgb, #22c55e 15%, transparent); color: #166534; }
.status-inactive { background: color-mix(in srgb, #eab308 15%, transparent); color: #854d0e; }
.status-exempted { background: color-mix(in srgb, #a855f7 15%, transparent); color: #6b21a8; }
.status-at-risk  { background: color-mix(in srgb, #f97316 15%, transparent); color: #9a3412; }
.status-default  { background: var(--bg-secondary); color: var(--text-secondary); }

.info-icon {
  color: var(--text-secondary);
  cursor: help;
  display: flex;
  align-items: center;
}

.eligible-check {
  color: #ca8a04;
  font-weight: 700;
}

.exemption-text {
  color: #7c3aed;
  font-size: var(--text-xs);
}

.grant-btn {
  padding: 4px 10px;
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition-base);
  white-space: nowrap;
}

.grant-btn:hover {
  background: #6d28d9;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.pagination-info {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.pagination-btns {
  display: flex;
  gap: var(--space-xs);
}

.page-btn {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-xs);
  cursor: pointer;
  font-family: inherit;
  transition: all var(--transition-base);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
}
</style>
