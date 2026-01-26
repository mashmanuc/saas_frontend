<template>
  <div class="user-billing-ops-panel">
    <div class="panel-header">
      <div class="header-left">
        <h3>Billing Operations</h3>
        <DevModeBadge />
      </div>
      <button 
        v-if="!loading && snapshot"
        @click="refreshSnapshot" 
        class="btn-refresh"
        :disabled="refreshing"
      >
        <span v-if="!refreshing">🔄 Refresh</span>
        <span v-else>⏳ Refreshing...</span>
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      Loading billing snapshot...
    </div>

    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="loadSnapshot" class="btn-retry">Retry</button>
    </div>

    <!-- P0.2: Guard - перевірити user перед відображенням -->
    <div v-else-if="!user" class="error-state">
      <p class="error-message">Snapshot user missing</p>
      <button @click="loadSnapshot" class="btn-retry">Retry</button>
    </div>

    <div v-else-if="snapshot" class="snapshot-content">
      <!-- User Info -->
      <section class="section user-info">
        <h4>User</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Email:</span>
            <span class="value">{{ user.email }}</span>
          </div>
          <div class="info-item">
            <span class="label">Role:</span>
            <span class="value">{{ user.role }}</span>
          </div>
        </div>
      </section>

      <!-- Entitlement -->
      <section v-if="entitlement" class="section entitlement-info">
        <h4>Entitlement</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Plan:</span>
            <span class="value plan-badge" :class="`plan-${entitlement.plan_code.toLowerCase()}`">
              {{ entitlement.plan_code }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">Expires:</span>
            <span class="value">{{ formatDate(entitlement.expires_at) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Features:</span>
            <span class="value">{{ entitlement.features.length }} features</span>
          </div>
        </div>
      </section>

      <!-- Subscription -->
      <section v-if="subscription" class="section subscription-info">
        <h4>Subscription</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value status-badge" :class="`status-${subscription.status}`">
              {{ subscription.status || 'none' }}
            </span>
          </div>
          <div class="info-item" v-if="subscription.plan_code">
            <span class="label">Plan:</span>
            <span class="value">{{ subscription.plan_code }}</span>
          </div>
          <div class="info-item" v-if="subscription.provider">
            <span class="label">Provider:</span>
            <span class="value">{{ subscription.provider }}</span>
          </div>
          <div class="info-item" v-if="subscription.current_period_start">
            <span class="label">Period Start:</span>
            <span class="value">{{ formatDate(subscription.current_period_start) }}</span>
          </div>
          <div class="info-item" v-if="subscription.current_period_end">
            <span class="label">Period End:</span>
            <span class="value">{{ formatDate(subscription.current_period_end) }}</span>
          </div>
          <div class="info-item" v-if="subscription.cancel_at_period_end">
            <span class="label">Cancel at period end:</span>
            <span class="value">Yes</span>
          </div>
        </div>
      </section>

      <!-- Checkout Sessions -->
      <section class="section checkout-sessions">
        <h4>Checkout Sessions (Last 10)</h4>
        <div v-if="sessions.length === 0" class="empty-state">
          No checkout sessions found
        </div>
        <div v-else class="sessions-table-wrapper">
          <table class="sessions-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Plan</th>
                <th>Pending Since</th>
                <th>Pending Age</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="session in sessions" 
                :key="session.id"
                :class="{ 'highlighted-row': highlightedSessionId === session.id }"
              >
                <td class="order-id-cell">
                  <code class="order-id">{{ session.order_id }}</code>
                  <button 
                    @click="copyOrderId(session.order_id)" 
                    class="btn-copy"
                    title="Copy order ID"
                  >
                    📋
                  </button>
                </td>
                <td>
                  <span class="status-badge" :class="`status-${session.status}`">
                    {{ session.status }}
                  </span>
                </td>
                <td>{{ session.provider }}</td>
                <td>
                  <span v-if="session.pending_plan_code" class="plan-code">
                    {{ session.pending_plan_code }}
                  </span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>
                  <span v-if="session.pending_since">
                    {{ formatDateTime(session.pending_since) }}
                  </span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>
                  <span v-if="session.pending_age_seconds !== null" class="pending-age">
                    {{ formatPendingAge(session.pending_age_seconds) }}
                  </span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>{{ formatDateTime(session.created_at) }}</td>
                <td class="actions-cell">
                  <button 
                    @click="openPreviewModal(session.order_id)"
                    class="btn-preview"
                    :disabled="session.status === 'completed'"
                  >
                    Preview Finalize
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Preview/Confirm Modal -->
    <FinalizeModal
      v-if="showModal"
      :order-id="selectedOrderId"
      @close="closeModal"
      @finalized="handleFinalized"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUserBillingSnapshot, type UserBillingSnapshotDto, type CheckoutSessionDto } from '../api/billingOpsApi'
import FinalizeModal from './FinalizeModal.vue'
import DevModeBadge from './DevModeBadge.vue'

const props = defineProps<{
  userId: string | number
}>()

// SSOT: Single Source of Truth for state
const snapshot = ref<UserBillingSnapshotDto | null>(null)
const loading = ref<boolean>(false)
const refreshing = ref<boolean>(false)
const error = ref<string | null>(null)
const showModal = ref(false)
const selectedOrderId = ref<string>('')
const highlightedSessionId = ref<string | null>(null)

// P0.1 + P0.2: SSOT computed - заборонити прямі звернення до snapshot полів у template
const sessions = computed<CheckoutSessionDto[]>(() => snapshot.value?.checkout_sessions ?? [])
const user = computed(() => snapshot.value?.user ?? null)
const entitlement = computed(() => snapshot.value?.entitlement ?? null)
const subscription = computed(() => snapshot.value?.subscription ?? null)

// P0.1 + P1.1: Нормалізація відповіді + timeout
async function loadSnapshot() {
  loading.value = true
  error.value = null
  
  console.log('[BillingOps:Telemetry] snapshot_load_started', { user_id: props.userId })
  
  // P1.1: Timeout 10s для запобігання вічного спінера
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout (10s)')), 10000)
  })
  
  try {
    // P0.3: getUserBillingSnapshot вже повертає нормалізований snapshot (normalizeSnapshot)
    snapshot.value = await Promise.race([
      getUserBillingSnapshot(props.userId),
      timeoutPromise
    ])
    
    console.log('[BillingOps:Telemetry] snapshot_loaded', { 
      user_id: props.userId,
      checkout_sessions_count: sessions.value.length,
      entitlement_plan: entitlement.value?.plan_code,
      subscription_status: subscription.value?.status
    })
  } catch (err: any) {
    const errorMessage = err.message || 'Failed to load billing snapshot'
    error.value = errorMessage
    
    // P0.2: Детальне логування помилки
    console.error('[BillingOps:Telemetry] snapshot_load_error', { 
      user_id: props.userId,
      error: errorMessage,
      error_type: err.name,
      status: err.response?.status,
      response_data: err.response?.data
    })
  } finally {
    loading.value = false
  }
}

async function refreshSnapshot() {
  refreshing.value = true
  error.value = null
  
  console.log('[BillingOps:Telemetry] snapshot_refresh_started', { user_id: props.userId })
  
  // P1.1: Timeout для refresh
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Refresh timeout (10s)')), 10000)
  })
  
  try {
    // P0.3: getUserBillingSnapshot вже повертає нормалізований snapshot
    snapshot.value = await Promise.race([
      getUserBillingSnapshot(props.userId),
      timeoutPromise
    ])
    
    console.log('[BillingOps:Telemetry] snapshot_refreshed', { 
      user_id: props.userId,
      checkout_sessions_count: sessions.value.length
    })
  } catch (err: any) {
    const errorMessage = err.message || 'Failed to refresh billing snapshot'
    error.value = errorMessage
    
    console.error('[BillingOps:Telemetry] snapshot_refresh_error', { 
      user_id: props.userId,
      error: errorMessage,
      error_type: err.name,
      status: err.response?.status
    })
  } finally {
    refreshing.value = false
  }
}

function copyOrderId(orderId: string) {
  console.log('[BillingOps:Telemetry] order_id_copied', { order_id: orderId })
  
  navigator.clipboard.writeText(orderId).then(() => {
    console.log('[BillingOps] Order ID copied to clipboard')
  }).catch(err => {
    console.error('[BillingOps:Telemetry] copy_failed', { 
      order_id: orderId,
      error: err.message 
    })
  })
}

function openPreviewModal(orderId: string) {
  console.log('[BillingOps:Telemetry] preview_button_clicked', { 
    order_id: orderId,
    user_id: props.userId
  })
  
  selectedOrderId.value = orderId
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedOrderId.value = ''
}

function handleFinalized(data: { orderId: string; sessionId?: string }) {
  console.log('[BillingOps:Telemetry] finalize_success_handled', { 
    order_id: data.orderId,
    session_id: data.sessionId,
    user_id: props.userId
  })
  
  // Highlight the finalized row
  if (data.sessionId) {
    highlightedSessionId.value = data.sessionId
    setTimeout(() => {
      highlightedSessionId.value = null
    }, 3000)
  }
  
  // Refresh snapshot
  refreshSnapshot()
  
  // Close modal
  closeModal()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleDateString('uk-UA', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

function formatDateTime(dateStr: string | null): string {
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

function formatPendingAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

onMounted(() => {
  loadSnapshot()
})
</script>

<style scoped>
.user-billing-ops-panel {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.btn-refresh {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-refresh:hover:not(:disabled) {
  background: #45a049;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state,
.error-state {
  padding: 40px;
  text-align: center;
}

.error-message {
  color: #f44336;
  margin-bottom: 16px;
}

.btn-retry {
  padding: 8px 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 6px;
}

.section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  gap: 8px;
}

.info-item .label {
  font-weight: 500;
  color: #666;
}

.info-item .value {
  color: #333;
}

.plan-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.plan-badge.plan-free {
  background: #e0e0e0;
  color: #666;
}

.plan-badge.plan-pro {
  background: #e3f2fd;
  color: #1976d2;
}

.plan-badge.plan-business {
  background: #f3e5f5;
  color: #7b1fa2;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.status-active {
  background: #d4edda;
  color: #155724;
}

.status-badge.status-completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.status-failed {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.status-canceled {
  background: #e0e0e0;
  color: #666;
}

.status-badge.status-none {
  background: #e0e0e0;
  color: #666;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #999;
}

.sessions-table-wrapper {
  overflow-x: auto;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.sessions-table th {
  background: #f5f5f5;
  padding: 10px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
}

.sessions-table td {
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.sessions-table tbody tr:hover {
  background: #fafafa;
}

.highlighted-row {
  background: #e8f5e9 !important;
  animation: highlight-fade 3s ease-out;
}

@keyframes highlight-fade {
  0% { background: #c8e6c9; }
  100% { background: #e8f5e9; }
}

.order-id-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-id {
  font-family: monospace;
  font-size: 12px;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
}

.btn-copy {
  padding: 2px 6px;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-copy:hover {
  background: #f5f5f5;
}

.text-muted {
  color: #999;
}

.pending-age {
  font-weight: 500;
  color: #ff9800;
}

.actions-cell {
  text-align: right;
}

.btn-preview {
  padding: 6px 12px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-preview:hover:not(:disabled) {
  background: #1976d2;
}

.btn-preview:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
