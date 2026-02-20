<template>
  <div class="staff-reports-view">
    <div class="header">
      <h1>{{ $t('staff.reports.title') }}</h1>
      <div class="filters">
        <select 
          v-model="statusFilter" 
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

    <div v-if="staffStore.isLoading" class="loading">
      {{ $t('common.loading') }}
    </div>

    <div v-else-if="staffStore.reports.length === 0" class="empty-state">
      {{ $t('staff.reports.noReports') }}
    </div>

    <table v-else class="reports-table">
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
        <tr v-for="report in staffStore.reports" :key="report.id">
          <td>{{ report.reporter_name || report.reporter_id }}</td>
          <td>{{ report.target_name || report.target_id }}</td>
          <td>{{ $t(`staff.reports.category.${report.category}`) }}</td>
          <td>{{ formatDate(report.created_at) }}</td>
          <td>
            <span :class="`status-badge status-${report.status.toLowerCase()}`">
              {{ $t(`staff.reports.status${report.status}`) }}
            </span>
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
          </td>
        </tr>
      </tbody>
    </table>

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
import ReportDetailsModal from '../components/ReportDetailsModal.vue'

const staffStore = useStaffStore()
const statusFilter = ref<string>('')
const selectedReport = ref<StaffReport | null>(null)
const isModalOpen = ref(false)

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
  padding: var(--space-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
}

.header h1 {
  font-size: var(--text-2xl);
  font-weight: 600;
}

.filters select {
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  background: var(--card-bg);
  color: var(--text-primary);
}

.error-banner {
  padding: var(--space-md);
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger-bg) 30%, transparent);
  border-radius: var(--radius-sm);
  color: var(--danger-bg);
  margin-bottom: var(--space-md);
}

.loading,
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--text-secondary);
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.reports-table th,
.reports-table td {
  padding: var(--space-md);
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.reports-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-primary);
}

.reports-table tbody tr:hover {
  background: var(--bg-secondary);
}

.status-badge {
  display: inline-block;
  padding: var(--space-2xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 500;
}

.status-open {
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  color: var(--warning-bg);
}

.status-dismissed {
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  color: var(--info-bg);
}

.status-actioned {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
}
</style>
