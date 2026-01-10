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
            <button 
              v-if="report.status === 'OPEN'"
              @click="openReportDetails(report)"
              class="btn-view"
              :aria-label="$t('staff.reports.viewDetails')"
            >
              {{ $t('staff.reports.view') }}
            </button>
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
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
}

.filters select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.error-banner {
  padding: 1rem;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  margin-bottom: 1rem;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.reports-table th,
.reports-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.reports-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.reports-table tbody tr:hover {
  background-color: #f8f9fa;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-open {
  background-color: #fff3cd;
  color: #856404;
}

.status-dismissed {
  background-color: #d1ecf1;
  color: #0c5460;
}

.status-actioned {
  background-color: #d4edda;
  color: #155724;
}

.btn-view {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-view:hover {
  background-color: #0056b3;
}

.btn-view:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style>
