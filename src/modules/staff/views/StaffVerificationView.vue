<template>
  <div class="staff-verification" data-test="verification-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ $t('staff.verification.title') }}</h1>
        <p class="help-text">{{ $t('staff.verification.helpText') }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <select
        v-model="statusFilter"
        class="filter-select"
        @change="loadVerifications"
      >
        <option value="">{{ $t('staff.verification.allStatuses') }}</option>
        <option value="PENDING">{{ $t('staff.verification.statusPending') }}</option>
        <option value="APPROVED">{{ $t('staff.verification.statusApproved') }}</option>
        <option value="REJECTED">{{ $t('staff.verification.statusRejected') }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
      <p>{{ $t('staff.verification.loading') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <Button variant="primary" size="sm" @click="loadVerifications">{{ $t('common.retry') }}</Button>
    </div>

    <!-- Empty -->
    <div v-else-if="verifications.length === 0" class="empty-state">
      <p>{{ $t('staff.verification.empty') }}</p>
    </div>

    <!-- Table -->
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ $t('staff.verification.table.tutor') }}</th>
            <th>{{ $t('staff.verification.table.email') }}</th>
            <th>{{ $t('staff.verification.table.type') }}</th>
            <th>{{ $t('staff.verification.table.submittedAt') }}</th>
            <th>{{ $t('staff.verification.table.status') }}</th>
            <th>{{ $t('staff.verification.table.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in verifications" :key="item.id">
            <td class="cell-name">
              <span class="name-text">{{ item.first_name }} {{ item.last_name }}</span>
              <span class="id-text">#{{ item.user_id }}</span>
            </td>
            <td>{{ item.user_email }}</td>
            <td>{{ item.verification_type || '—' }}</td>
            <td>{{ formatDate(item.submitted_at) }}</td>
            <td>
              <Badge :variant="statusVariant(item.status)" size="sm">
                {{ statusLabel(item.status) }}
              </Badge>
            </td>
            <td class="cell-actions">
              <Button
                v-if="item.status === 'PENDING' || item.status === 'pending'"
                variant="primary"
                size="sm"
                :disabled="actionLoading"
                @click="handleApprove(item)"
              >
                {{ $t('staff.verification.approve') }}
              </Button>
              <Button
                v-if="item.status === 'PENDING' || item.status === 'pending'"
                variant="danger"
                size="sm"
                :disabled="actionLoading"
                @click="openRejectModal(item)"
              >
                {{ $t('staff.verification.reject') }}
              </Button>
              <router-link
                :to="`/staff/users/${item.user_id}`"
                class="view-link"
              >
                {{ $t('staff.verification.viewDocuments') }}
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Reject Modal -->
    <div v-if="rejectModal.open" class="modal-overlay" @click.self="closeRejectModal">
      <div class="modal-content">
        <h3 class="modal-title">{{ $t('staff.verification.rejectModal.title') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ $t('staff.verification.rejectModal.reasonLabel') }}</label>
          <textarea
            v-model="rejectModal.reason"
            class="form-textarea"
            :placeholder="$t('staff.verification.rejectModal.reasonPlaceholder')"
            rows="4"
          />
        </div>
        <div class="modal-actions">
          <Button variant="default" size="sm" @click="closeRejectModal">
            {{ $t('staff.verification.rejectModal.cancel') }}
          </Button>
          <Button
            variant="danger"
            size="sm"
            :disabled="!rejectModal.reason.trim() || actionLoading"
            @click="handleReject"
          >
            {{ $t('staff.verification.rejectModal.confirm') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getMarketplaceVerifications,
  reviewMarketplaceVerification,
} from '../api/verificationApi'
import type { VerificationItem } from '../api/verificationApi'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const { t } = useI18n()

const verifications = ref<VerificationItem[]>([])
const loading = ref(false)
const error = ref('')
const actionLoading = ref(false)
const statusFilter = ref('')

const rejectModal = ref({
  open: false,
  item: null as VerificationItem | null,
  reason: '',
})

async function loadVerifications() {
  loading.value = true
  error.value = ''
  try {
    const params: any = {}
    if (statusFilter.value) params.status = statusFilter.value
    verifications.value = await getMarketplaceVerifications(params)
  } catch (err: any) {
    error.value = err.message || t('staff.verification.error')
  } finally {
    loading.value = false
  }
}

async function handleApprove(item: VerificationItem) {
  const name = `${item.first_name} ${item.last_name}`.trim()
  const confirmed = confirm(t('staff.verification.approveConfirm', { name }))
  if (!confirmed) return

  actionLoading.value = true
  try {
    await reviewMarketplaceVerification(item.id, { status: 'APPROVED' })
    await loadVerifications()
  } catch (err: any) {
    alert(t('staff.verification.error'))
  } finally {
    actionLoading.value = false
  }
}

function openRejectModal(item: VerificationItem) {
  rejectModal.value = { open: true, item, reason: '' }
}

function closeRejectModal() {
  rejectModal.value = { open: false, item: null, reason: '' }
}

async function handleReject() {
  if (!rejectModal.value.item || !rejectModal.value.reason.trim()) return

  actionLoading.value = true
  try {
    await reviewMarketplaceVerification(rejectModal.value.item.id, {
      status: 'REJECTED',
      notes: rejectModal.value.reason.trim(),
    })
    closeRejectModal()
    await loadVerifications()
  } catch (err: any) {
    alert(t('staff.verification.error'))
  } finally {
    actionLoading.value = false
  }
}

function statusVariant(status: string): string {
  const s = status.toUpperCase()
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
  }
  return map[s] || 'default'
}

function statusLabel(status: string): string {
  const s = status.toUpperCase()
  const map: Record<string, string> = {
    PENDING: t('staff.verification.statusPending'),
    APPROVED: t('staff.verification.statusApproved'),
    REJECTED: t('staff.verification.statusRejected'),
  }
  return map[s] || status
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

onMounted(() => {
  loadVerifications()
})
</script>

<style scoped>
.staff-verification {
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
  gap: var(--space-sm);
}

.filter-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--text-secondary);
}

.error-message {
  color: var(--danger-bg, #ef4444);
  margin-bottom: var(--space-md);
}

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
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
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
}

.data-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.cell-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-text {
  font-weight: 500;
}

.id-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: monospace;
}

.cell-actions {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
}

.view-link {
  font-size: var(--text-xs);
  color: var(--accent);
  text-decoration: none;
}

.view-link:hover {
  text-decoration: underline;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.modal-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-lg) 0;
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.form-textarea {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  resize: vertical;
  font-family: inherit;
}

.modal-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}
</style>
