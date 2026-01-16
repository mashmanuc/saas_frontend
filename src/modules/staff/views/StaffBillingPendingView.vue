<template>
  <div class="staff-billing-pending">
    <div class="header">
      <h1>{{ $t('staff.billingPending.title') }}</h1>
      <p class="subtitle">{{ $t('staff.billingPending.subtitle') }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('staff.billingPending.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <h3>{{ $t('staff.billingPending.errorTitle') }}</h3>
        <p class="error-message">{{ errorMessage }}</p>
        <div class="error-actions">
          <button @click="retry" class="btn btn-primary">
            {{ $t('common.retry') }}
          </button>
          <button v-if="isUnauthorized" @click="logout" class="btn btn-secondary">
            {{ $t('auth.logout') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Ready State -->
    <div v-else class="content">
      <!-- Search/Filter Section -->
      <div class="filters-section">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('staff.billingPending.searchPlaceholder')"
            class="search-input"
          />
        </div>
        <div class="filter-options">
          <label class="checkbox-label">
            <input v-model="showOnlyStale" type="checkbox" />
            {{ $t('staff.billingPending.showOnlyStale') }}
          </label>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredSessions.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>{{ $t('staff.billingPending.emptyTitle') }}</h3>
        <p>{{ $t('staff.billingPending.emptyDescription') }}</p>
      </div>

      <!-- Pending Sessions List -->
      <div v-else class="sessions-list">
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          class="session-card"
          :class="{ 'stale': isStale(session) }"
        >
          <div class="session-header">
            <div class="session-info">
              <span class="user-email">{{ session.user_email }}</span>
              <span class="order-id">{{ session.order_id }}</span>
            </div>
            <span class="status-badge" :class="`status-${session.status}`">
              {{ session.status }}
            </span>
          </div>

          <div class="session-details">
            <div class="detail-row">
              <span class="label">{{ $t('staff.billingPending.plan') }}:</span>
              <span class="value">{{ session.pending_plan_code || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('staff.billingPending.pendingSince') }}:</span>
              <span class="value">{{ formatDateTime(session.pending_since) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('staff.billingPending.pendingAge') }}:</span>
              <span class="value pending-age" :class="{ 'stale': isStale(session) }">
                {{ formatPendingAge(session.pending_age_seconds) }}
              </span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('staff.billingPending.provider') }}:</span>
              <span class="value">{{ session.provider }}</span>
            </div>
          </div>

          <div class="session-actions">
            <button
              @click="openUserSnapshot(session.user_id)"
              class="btn btn-secondary btn-sm"
            >
              {{ $t('staff.billingPending.openUser') }}
            </button>
            <button
              @click="openFinalizeModal(session.order_id)"
              class="btn btn-primary btn-sm"
              :disabled="session.status === 'completed'"
            >
              {{ $t('staff.billingPending.finalize') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Finalize Modal -->
    <FinalizeModal
      v-if="showFinalizeModal"
      :order-id="selectedOrderId"
      @close="closeFinalizeModal"
      @finalized="handleFinalized"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'
import FinalizeModal from '../components/FinalizeModal.vue'
import apiClient from '@/utils/apiClient'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(true)
const error = ref(null)
const pendingSessions = ref([])
const searchQuery = ref('')
const showOnlyStale = ref(false)
const showFinalizeModal = ref(false)
const selectedOrderId = ref('')

const STALE_THRESHOLD_SECONDS = 3600

const errorMessage = computed(() => {
  if (!error.value) return ''
  
  if (error.value.status === 401) {
    return 'Unauthorized. Please log in again.'
  }
  if (error.value.status === 403) {
    return 'Access denied. You do not have permission to view this page.'
  }
  if (error.value.status === 404) {
    return 'Resource not found.'
  }
  if (error.value.code === 'ECONNABORTED' || error.value.message?.includes('timeout')) {
    return 'Request timeout. Please check your connection and try again.'
  }
  
  return error.value.message || 'An unknown error occurred.'
})

const isUnauthorized = computed(() => error.value?.status === 401)

const filteredSessions = computed(() => {
  let sessions = pendingSessions.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    sessions = sessions.filter(s =>
      s.user_email?.toLowerCase().includes(query) ||
      s.order_id?.toLowerCase().includes(query)
    )
  }

  if (showOnlyStale.value) {
    sessions = sessions.filter(s => isStale(s))
  }

  return sessions
})

function isStale(session) {
  return session.pending_age_seconds && session.pending_age_seconds > STALE_THRESHOLD_SECONDS
}

async function loadPendingSessions() {
  isLoading.value = true
  error.value = null

  console.log('[StaffBillingPending] Loading pending sessions')

  try {
    const response = await apiClient.get('/v1/staff/billing/pending/', {
      timeout: 15000
    })
    
    pendingSessions.value = response.data.sessions || []
    
    console.log('[StaffBillingPending] Loaded sessions:', {
      count: pendingSessions.value.length
    })
  } catch (err) {
    console.error('[StaffBillingPending] Load error:', err)
    error.value = {
      status: err.response?.status,
      code: err.code,
      message: err.response?.data?.detail || err.message
    }
  } finally {
    isLoading.value = false
  }
}

function retry() {
  loadPendingSessions()
}

function logout() {
  authStore.logout()
  router.push('/auth/login')
}

function openUserSnapshot(userId) {
  router.push(`/staff/users/${userId}`)
}

function openFinalizeModal(orderId) {
  console.log('[StaffBillingPending] Opening finalize modal:', orderId)
  selectedOrderId.value = orderId
  showFinalizeModal.value = true
}

function closeFinalizeModal() {
  showFinalizeModal.value = false
  selectedOrderId.value = ''
}

function handleFinalized(data) {
  console.log('[StaffBillingPending] Finalize success:', data)
  closeFinalizeModal()
  loadPendingSessions()
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatPendingAge(seconds) {
  if (!seconds) return '—'
  
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

onMounted(() => {
  loadPendingSessions()
})
</script>

<style scoped>
.staff-billing-pending {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  margin-bottom: 32px;
}

.header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #1a1a1a;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2196F3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  color: #666;
  font-size: 14px;
}

.error-state {
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.error-card {
  background: #fff;
  border: 1px solid #f44336;
  border-radius: 8px;
  padding: 32px;
  max-width: 500px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-card h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #1a1a1a;
}

.error-message {
  color: #666;
  font-size: 14px;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.filters-section {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 250px;
}

.search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #2196F3;
}

.filter-options {
  display: flex;
  gap: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #1a1a1a;
}

.empty-state p {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.sessions-list {
  display: grid;
  gap: 16px;
}

.session-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  transition: box-shadow 0.2s;
}

.session-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.session-card.stale {
  border-left: 4px solid #ff9800;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-email {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.order-id {
  font-size: 12px;
  font-family: monospace;
  color: #666;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.status-completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.status-failed {
  background: #f8d7da;
  color: #721c24;
}

.session-details {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.detail-row .label {
  font-weight: 500;
  color: #666;
  min-width: 120px;
}

.detail-row .value {
  color: #1a1a1a;
}

.pending-age {
  font-weight: 600;
}

.pending-age.stale {
  color: #ff9800;
}

.session-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}
</style>
