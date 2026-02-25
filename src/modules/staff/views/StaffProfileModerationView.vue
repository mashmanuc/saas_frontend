<template>
  <div class="staff-profile-moderation" data-test="profile-moderation-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ $t('staff.profileModeration.title') }}</h1>
        <p class="help-text">{{ $t('staff.profileModeration.helpText') }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <select
        v-model="statusFilter"
        class="filter-select"
        @change="loadProfiles"
      >
        <option value="">{{ $t('staff.profileModeration.allStatuses') }}</option>
        <option value="PENDING">{{ $t('staff.profileModeration.statusPending') }}</option>
        <option value="APPROVED">{{ $t('staff.profileModeration.statusApproved') }}</option>
        <option value="REJECTED">{{ $t('staff.profileModeration.statusRejected') }}</option>
        <option value="SUSPENDED">{{ $t('staff.profileModeration.statusSuspended') }}</option>
        <option value="DRAFT">{{ $t('staff.profileModeration.statusDraft') }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
      <p>{{ $t('staff.profileModeration.loading') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <Button variant="primary" size="sm" @click="loadProfiles">{{ $t('common.retry') }}</Button>
    </div>

    <!-- Empty -->
    <div v-else-if="profiles.length === 0" class="empty-state">
      <p>{{ $t('staff.profileModeration.empty') }}</p>
    </div>

    <!-- Table -->
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ $t('staff.profileModeration.table.tutor') }}</th>
            <th>{{ $t('staff.profileModeration.table.email') }}</th>
            <th>{{ $t('staff.profileModeration.table.subjects') }}</th>
            <th>{{ $t('staff.profileModeration.table.status') }}</th>
            <th>{{ $t('staff.profileModeration.table.createdAt') }}</th>
            <th>{{ $t('staff.profileModeration.table.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="profile in profiles" :key="profile.id">
            <td class="cell-name">
              <span class="name-text">{{ profile.first_name }} {{ profile.last_name }}</span>
              <span class="id-text">#{{ profile.id }}</span>
            </td>
            <td>{{ profile.user_email }}</td>
            <td>
              <span v-if="profile.subjects && profile.subjects.length" class="subjects-list">
                {{ profile.subjects.slice(0, 3).join(', ') }}
                <span v-if="profile.subjects.length > 3" class="more">+{{ profile.subjects.length - 3 }}</span>
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <Badge :variant="statusVariant(profile.status)" size="sm">
                {{ statusLabel(profile.status) }}
              </Badge>
            </td>
            <td>{{ formatDate(profile.created_at) }}</td>
            <td class="cell-actions">
              <Button
                v-if="profile.status === 'PENDING' || profile.status === 'DRAFT'"
                variant="primary"
                size="sm"
                :disabled="actionLoading"
                @click="handleApprove(profile)"
              >
                {{ $t('staff.profileModeration.approve') }}
              </Button>
              <Button
                v-if="profile.status === 'PENDING' || profile.status === 'DRAFT'"
                variant="danger"
                size="sm"
                :disabled="actionLoading"
                @click="openRejectModal(profile)"
              >
                {{ $t('staff.profileModeration.reject') }}
              </Button>
              <router-link
                :to="`/staff/users/${profile.user_id}`"
                class="view-link"
              >
                {{ $t('staff.profileModeration.viewProfile') }}
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Reject Modal -->
    <div v-if="rejectModal.open" class="modal-overlay" @click.self="closeRejectModal">
      <div class="modal-content">
        <h3 class="modal-title">{{ $t('staff.profileModeration.rejectModal.title') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ $t('staff.profileModeration.rejectModal.reasonLabel') }}</label>
          <textarea
            v-model="rejectModal.reason"
            class="form-textarea"
            :placeholder="$t('staff.profileModeration.rejectModal.reasonPlaceholder')"
            rows="4"
          />
        </div>
        <div class="modal-actions">
          <Button variant="default" size="sm" @click="closeRejectModal">
            {{ $t('staff.profileModeration.rejectModal.cancel') }}
          </Button>
          <Button
            variant="danger"
            size="sm"
            :disabled="!rejectModal.reason.trim() || actionLoading"
            @click="handleReject"
          >
            {{ $t('staff.profileModeration.rejectModal.confirm') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAdminProfiles, approveProfile, rejectProfile } from '../api/profileModerationApi'
import type { AdminProfile } from '../api/profileModerationApi'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const { t } = useI18n()

const profiles = ref<AdminProfile[]>([])
const loading = ref(false)
const error = ref('')
const actionLoading = ref(false)
const statusFilter = ref('')

const rejectModal = ref({
  open: false,
  profile: null as AdminProfile | null,
  reason: '',
})

async function loadProfiles() {
  loading.value = true
  error.value = ''
  try {
    const params: any = {}
    if (statusFilter.value) params.status = statusFilter.value
    profiles.value = await getAdminProfiles(params)
  } catch (err: any) {
    error.value = err.message || t('staff.profileModeration.error')
  } finally {
    loading.value = false
  }
}

async function handleApprove(profile: AdminProfile) {
  const name = `${profile.first_name} ${profile.last_name}`.trim()
  const confirmed = confirm(t('staff.profileModeration.approveConfirm', { name }))
  if (!confirmed) return

  actionLoading.value = true
  try {
    await approveProfile(profile.id)
    await loadProfiles()
  } catch (err: any) {
    alert(t('staff.profileModeration.error'))
  } finally {
    actionLoading.value = false
  }
}

function openRejectModal(profile: AdminProfile) {
  rejectModal.value = { open: true, profile, reason: '' }
}

function closeRejectModal() {
  rejectModal.value = { open: false, profile: null, reason: '' }
}

async function handleReject() {
  if (!rejectModal.value.profile || !rejectModal.value.reason.trim()) return

  actionLoading.value = true
  try {
    await rejectProfile(rejectModal.value.profile.id, {
      reason: rejectModal.value.reason.trim(),
    })
    closeRejectModal()
    await loadProfiles()
  } catch (err: any) {
    alert(t('staff.profileModeration.error'))
  } finally {
    actionLoading.value = false
  }
}

function statusVariant(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    SUSPENDED: 'danger',
    DRAFT: 'muted',
  }
  return map[status] || 'default'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: t('staff.profileModeration.statusPending'),
    APPROVED: t('staff.profileModeration.statusApproved'),
    REJECTED: t('staff.profileModeration.statusRejected'),
    SUSPENDED: t('staff.profileModeration.statusSuspended'),
    DRAFT: t('staff.profileModeration.statusDraft'),
  }
  return map[status] || status
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
  loadProfiles()
})
</script>

<style scoped>
.staff-profile-moderation {
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

.subjects-list .more {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.text-muted {
  color: var(--text-secondary);
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
