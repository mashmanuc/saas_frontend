<template>
  <div class="user-billing-ops-panel">
    <div class="panel-header">
      <div class="header-left">
        <h3>{{ $t('staff.billingOps.title') }}</h3>
        <DevModeBadge />
      </div>
      <Button 
        v-if="!loading && snapshot"
        variant="primary"
        size="sm"
        :loading="refreshing"
        @click="refreshSnapshot"
      >
        {{ $t('staff.billingOps.refresh') }}
      </Button>
    </div>

    <div v-if="loading" class="loading-state">
      {{ $t('staff.billingOps.loading') }}
    </div>

    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <Button variant="primary" size="sm" @click="loadSnapshot">{{ $t('staff.billingOps.retry') }}</Button>
    </div>

    <!-- P0.2: Guard - перевірити user перед відображенням -->
    <div v-else-if="!user" class="error-state">
      <p class="error-message">{{ $t('staff.billingOps.snapshotMissing') }}</p>
      <Button variant="primary" size="sm" @click="loadSnapshot">{{ $t('staff.billingOps.retry') }}</Button>
    </div>

    <div v-else-if="snapshot" class="snapshot-content">
      <!-- User Info -->
      <section class="section user-info">
        <h4>{{ $t('staff.billingOps.userSection') }}</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">{{ $t('staff.billingOps.email') }}:</span>
            <span class="value">{{ user.email }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.billingOps.role') }}:</span>
            <span class="value">{{ user.role }}</span>
          </div>
        </div>
      </section>

      <!-- Entitlement -->
      <section v-if="entitlement" class="section entitlement-info">
        <h4>{{ $t('staff.billingOps.entitlementSection') }}</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">{{ $t('staff.billingOps.plan') }}:</span>
            <span class="value plan-badge" :class="`plan-${entitlement.plan_code.toLowerCase()}`">
              {{ entitlement.plan_code }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.billingOps.expires') }}:</span>
            <span class="value">{{ formatDate(entitlement.expires_at) }}</span>
          </div>
          <div class="info-item">
            <span class="label">{{ $t('staff.billingOps.features') }}:</span>
            <span class="value">{{ entitlement.features.length }}</span>
          </div>
        </div>
      </section>

      <!-- Subscription -->
      <section v-if="subscription" class="section subscription-info">
        <h4>{{ $t('staff.billingOps.subscriptionSection') }}</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">{{ $t('staff.billingOps.status') }}:</span>
            <span class="value status-badge" :class="`status-${subscription.status}`">
              {{ subscription.status || $t('staff.billingOps.none') }}
            </span>
          </div>
          <div class="info-item" v-if="subscription.plan_code">
            <span class="label">{{ $t('staff.billingOps.plan') }}:</span>
            <span class="value">{{ subscription.plan_code }}</span>
          </div>
          <div class="info-item" v-if="subscription.provider">
            <span class="label">{{ $t('staff.billingOps.provider') }}:</span>
            <span class="value">{{ subscription.provider }}</span>
          </div>
          <div class="info-item" v-if="subscription.current_period_start">
            <span class="label">{{ $t('staff.billingOps.periodStart') }}:</span>
            <span class="value">{{ formatDate(subscription.current_period_start) }}</span>
          </div>
          <div class="info-item" v-if="subscription.current_period_end">
            <span class="label">{{ $t('staff.billingOps.periodEnd') }}:</span>
            <span class="value">{{ formatDate(subscription.current_period_end) }}</span>
          </div>
          <div class="info-item" v-if="subscription.cancel_at_period_end">
            <span class="label">{{ $t('staff.billingOps.cancelAtPeriodEnd') }}:</span>
            <span class="value">{{ $t('staff.billingOps.yes') }}</span>
          </div>
        </div>
      </section>

      <!-- Checkout Sessions -->
      <section class="section checkout-sessions">
        <h4>{{ $t('staff.billingOps.sessionsSection') }}</h4>
        <div v-if="sessions.length === 0" class="empty-state">
          {{ $t('staff.billingOps.noSessions') }}
        </div>
        <div v-else class="sessions-table-wrapper">
          <table class="sessions-table">
            <thead>
              <tr>
                <th>{{ $t('staff.billingOps.orderId') }}</th>
                <th>{{ $t('staff.billingOps.status') }}</th>
                <th>{{ $t('staff.billingOps.provider') }}</th>
                <th>{{ $t('staff.billingOps.plan') }}</th>
                <th>{{ $t('staff.billingOps.pendingSince') }}</th>
                <th>{{ $t('staff.billingOps.pendingAge') }}</th>
                <th>{{ $t('staff.billingOps.created') }}</th>
                <th>{{ $t('staff.billingOps.actions') }}</th>
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
                    :title="$t('staff.billingOps.copyOrderId')"
                  >
                    <ClipboardCopy :size="14" />
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
                  <Button 
                    variant="primary"
                    size="sm"
                    :disabled="session.status === 'completed'"
                    @click="openPreviewModal(session.order_id)"
                  >
                    {{ $t('staff.billingOps.previewFinalize') }}
                  </Button>
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
import { useI18n } from 'vue-i18n'
import { ClipboardCopy } from 'lucide-vue-next'
import { getUserBillingSnapshot, type UserBillingSnapshotDto, type CheckoutSessionDto } from '../api/billingOpsApi'
import Button from '@/ui/Button.vue'
import FinalizeModal from './FinalizeModal.vue'
import DevModeBadge from './DevModeBadge.vue'
import { activeLocale } from '@/utils/i18nDate'

const { t } = useI18n()

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
  if (!dateStr) return t('staff.billingOps.never')
  const date = new Date(dateStr)
  return date.toLocaleDateString(activeLocale(), { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleString(activeLocale(), { 
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
  padding: var(--space-lg);
  background: var(--card-bg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 600;
}

.loading-state,
.error-state {
  padding: var(--space-xl);
  text-align: center;
}

.error-message {
  color: var(--danger-bg);
  margin-bottom: var(--space-md);
}

.section {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.section h4 {
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-sm);
}

.info-item {
  display: flex;
  gap: var(--space-xs);
}

.info-item .label {
  font-weight: 500;
  color: var(--text-secondary);
}

.info-item .value {
  color: var(--text-primary);
}

.plan-badge {
  display: inline-block;
  padding: 2px var(--space-xs);
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 600;
}

.plan-badge.plan-free {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.plan-badge.plan-pro {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.plan-badge.plan-business {
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  color: var(--info-bg);
}

.status-badge {
  display: inline-block;
  padding: 2px var(--space-xs);
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 600;
}

.status-badge.status-pending {
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  color: var(--warning-bg);
}

.status-badge.status-active,
.status-badge.status-completed {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
}

.status-badge.status-failed {
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  color: var(--danger-bg);
}

.status-badge.status-canceled,
.status-badge.status-none {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.empty-state {
  padding: var(--space-lg);
  text-align: center;
  color: var(--text-secondary);
}

.sessions-table-wrapper {
  overflow-x: auto;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.sessions-table th {
  background: var(--bg-secondary);
  padding: var(--space-xs);
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid var(--border-color);
}

.sessions-table td {
  padding: var(--space-xs);
  border-bottom: 1px solid var(--border-color);
}

.sessions-table tbody tr:hover {
  background: var(--bg-secondary);
}

.highlighted-row {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent) !important;
  animation: highlight-fade 3s ease-out;
}

@keyframes highlight-fade {
  0% { background: color-mix(in srgb, var(--success-bg) 25%, transparent); }
  100% { background: color-mix(in srgb, var(--success-bg) 15%, transparent); }
}

.order-id-cell {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.order-id {
  font-family: monospace;
  font-size: var(--text-xs);
  background: var(--bg-secondary);
  padding: 2px var(--space-2xs);
  border-radius: var(--radius-xs);
}

.btn-copy {
  padding: 2px var(--space-2xs);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  cursor: pointer;
  font-size: var(--text-xs);
}

.btn-copy:hover {
  background: var(--bg-secondary);
}

.text-muted {
  color: var(--text-secondary);
}

.pending-age {
  font-weight: 500;
  color: var(--warning-bg);
}

.actions-cell {
  text-align: right;
}
</style>
