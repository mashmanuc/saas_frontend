<template>
  <div class="staff-reports-view" data-testid="staff-reports">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.reports.title') }}</h1>
      <div class="filters">
        <select
          v-model="statusFilter"
          class="filter-select"
          @change="loadReportsWithFilter"
          :aria-label="$t('staff.reports.filterByStatus')"
        >
          <option value="">{{ $t('staff.reports.allStatuses') }}</option>
          <option value="OPEN">{{ $t('staff.reports.statusOpen') }}</option>
          <option value="DISMISSED">{{ $t('staff.reports.statusDismissed') }}</option>
          <option value="ACTIONED">{{ $t('staff.reports.statusActioned') }}</option>
        </select>
      </div>
    </div>

    <div v-if="staffStore.loadReportsError" class="error-banner" role="alert">
      {{ staffStore.loadReportsError }}
    </div>

    <Card>
      <div v-if="staffStore.isLoading" class="loading-state">
        <LoadingSpinner />
      </div>

      <div v-else-if="staffStore.reports.length === 0" class="empty-state">
        <EmptyState :title="$t('staff.reports.noReports')" />
      </div>

      <div v-else>
        <table class="reports-table">
          <thead>
            <tr>
              <th>{{ $t('staff.reports.reporter') }}</th>
              <th>{{ $t('staff.reports.target') }}</th>
              <th>{{ $t('staff.reports.categoryLabel') }}</th>
              <th>{{ $t('staff.reports.created') }}</th>
              <th>{{ $t('staff.reports.status') }}</th>
              <th>{{ $t('staff.reports.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="report in staffStore.reports"
              :key="report.id"
              class="report-row"
            >
              <td>
                <span class="cell-name">{{ report.reporter_name || report.reporter_id }}</span>
              </td>
              <td>
                <router-link
                  v-if="report.target_id"
                  :to="`/staff/users/${report.target_id}`"
                  class="cell-link"
                >
                  {{ report.target_name || report.target_id }}
                </router-link>
                <span v-else>—</span>
              </td>
              <td>
                <Badge variant="muted" size="sm">
                  {{ $t(`staff.reports.category.${report.category}`) }}
                </Badge>
              </td>
              <td class="cell-muted">{{ formatDate(report.created_at) }}</td>
              <td>
                <Badge :variant="statusBadgeVariant(report.status)" size="sm">
                  {{ $t(`staff.reports.status${report.status}`) }}
                </Badge>
              </td>
              <td>
                <Button
                  v-if="report.status === 'OPEN'"
                  variant="primary"
                  size="sm"
                  :aria-label="$t('staff.reports.viewDetails')"
                  @click="openReportDetails(report)"
                >
                  {{ $t('staff.reports.view') }}
                </Button>
                <span v-else class="cell-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="table-footer">
          <span class="table-count">
            {{ staffStore.reports.length }} / {{ staffStore.reportsTotal }}
          </span>
        </div>
      </div>
    </Card>

    <ReportDetailsModal
      v-if="selectedReport"
      :report="selectedReport"
      :is-open="isModalOpen"
      @close="closeModal"
      @resolve="handleResolve"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStaffStore } from '@/stores/staffStore'
import { ReportStatus, type StaffReport } from '@/types/staff'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import EmptyState from '@/ui/EmptyState.vue'
import ReportDetailsModal from '../components/ReportDetailsModal.vue'

const staffStore = useStaffStore()
const statusFilter = ref<string>('')
const selectedReport = ref<StaffReport | null>(null)
const isModalOpen = ref(false)

function statusBadgeVariant(status: string) {
  if (status === 'OPEN') return 'warning'
  if (status === 'ACTIONED') return 'success'
  return 'muted'
}

onMounted(async () => {
  await loadReportsWithFilter()
})

async function loadReportsWithFilter() {
  const params = statusFilter.value 
    ? { status: statusFilter.value as ReportStatus, limit: 50 }
    : { limit: 50 }
  
  try {
    await staffStore.loadReports(params)
  } catch (error) {
    console.error('Failed to load reports:', error)
  }
}

function openReportDetails(report: StaffReport) {
  selectedReport.value = report
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  selectedReport.value = null
}

async function handleResolve(status: 'DISMISSED' | 'ACTIONED', note?: string) {
  if (!selectedReport.value) return

  try {
    await staffStore.resolveReport(selectedReport.value.id, { status, note })
    closeModal()
    await loadReportsWithFilter()
  } catch (error) {
    console.error('Failed to resolve report:', error)
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.staff-reports-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.filter-select {
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
}

.error-banner {
  padding: var(--space-md);
  background: color-mix(in srgb, var(--danger-bg, #ef4444) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger-bg, #ef4444) 25%, transparent);
  border-radius: var(--radius-md);
  color: var(--danger-bg, #ef4444);
}

.loading-state,
.empty-state {
  padding: var(--space-xl);
  text-align: center;
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
}

.reports-table th {
  text-align: left;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.reports-table td {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.report-row {
  transition: background var(--transition-base);
}

.report-row:hover {
  background: var(--bg-secondary);
}

.cell-name {
  font-weight: 500;
}

.cell-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.cell-link:hover {
  text-decoration: underline;
}

.cell-muted {
  color: var(--text-secondary);
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--border-color);
}

.table-count {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .reports-table th,
  .reports-table td {
    padding: var(--space-xs);
    font-size: var(--text-xs);
  }
}
</style>
