<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>Manual Finalize: {{ orderId }}</h3>
        <button @click="close" class="btn-close">✕</button>
      </div>

      <div class="modal-body">
        <!-- Loading Preview -->
        <div v-if="loadingPreview" class="loading-state">
          Loading preview...
        </div>

        <!-- Preview Error -->
        <div v-else-if="previewError" class="error-state">
          <p class="error-message">{{ previewError }}</p>
          <button @click="loadPreview" class="btn-retry">Retry</button>
        </div>

        <!-- Preview Content -->
        <div v-else-if="preview" class="preview-content">
          <!-- Blocked Reason -->
          <div v-if="!preview.can_finalize" class="alert alert-warning">
            <strong>Cannot finalize:</strong> {{ getBlockedReasonText(preview.blocked_reason) }}
          </div>

          <!-- Preview Info -->
          <div class="preview-section">
            <h4>Preview</h4>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Order ID:</span>
                <code class="value">{{ preview.order_id }}</code>
              </div>
              
              <div class="info-item" v-if="preview.checkout_session">
                <span class="label">Session Status:</span>
                <span class="value">
                  <span class="status-badge" :class="`status-${preview.checkout_session.status}`">
                    {{ preview.checkout_session.status }}
                  </span>
                </span>
              </div>
              
              <div class="info-item" v-if="preview.pending_age_seconds !== null">
                <span class="label">Pending Age:</span>
                <span class="value pending-age">{{ formatPendingAge(preview.pending_age_seconds) }}</span>
              </div>
              
              <div class="info-item" v-if="preview.plan_to_activate">
                <span class="label">Plan to Activate:</span>
                <span class="value plan-badge" :class="`plan-${preview.plan_to_activate.toLowerCase()}`">
                  {{ preview.plan_to_activate }}
                </span>
              </div>
            </div>
          </div>

          <!-- Current State -->
          <div class="preview-section">
            <h4>Current State (Before Finalize)</h4>
            
            <div class="state-grid">
              <div class="state-column">
                <h5>Entitlement</h5>
                <div class="info-item">
                  <span class="label">Plan:</span>
                  <span class="value">{{ preview.entitlement_before.plan_code }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Features:</span>
                  <span class="value">{{ preview.entitlement_before.features.length }} features</span>
                </div>
              </div>
              
              <div class="state-column" v-if="preview.subscription_before">
                <h5>Subscription</h5>
                <div class="info-item">
                  <span class="label">Status:</span>
                  <span class="value">{{ preview.subscription_before.status }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Plan:</span>
                  <span class="value">{{ preview.subscription_before.plan_code }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Provider:</span>
                  <span class="value">{{ preview.subscription_before.provider }}</span>
                </div>
              </div>
              <div class="state-column" v-else>
                <h5>Subscription</h5>
                <p class="text-muted">No active subscription</p>
              </div>
            </div>
          </div>

          <!-- Reason Input -->
          <div class="preview-section">
            <h4>Reason for Manual Finalize <span class="required">*</span></h4>
            <textarea
              v-model="reason"
              placeholder="Enter reason for manual finalize (minimum 5 characters)..."
              class="reason-input"
              :disabled="!preview.can_finalize || confirming"
              rows="3"
            ></textarea>
            <div v-if="reasonError" class="field-error">{{ reasonError }}</div>
            <div class="field-hint">
              Minimum 5 characters. This will be logged in audit trail.
            </div>
          </div>

          <!-- Confirm Result -->
          <div v-if="confirmResult" class="confirm-result">
            <div 
              class="alert" 
              :class="{
                'alert-success': confirmResult.result === 'activated',
                'alert-info': confirmResult.result === 'already_completed',
                'alert-danger': confirmResult.result === 'failed' || confirmResult.result === 'invalid_state',
                'alert-warning': confirmResult.result === 'not_found' || confirmResult.result === 'invalid_reason'
              }"
            >
              <strong>Result:</strong> {{ getResultText(confirmResult.result) }}
              <div v-if="confirmResult.plan_activated" class="result-detail">
                Plan activated: <strong>{{ confirmResult.plan_activated }}</strong>
              </div>
              <div v-if="confirmResult.subscription_status" class="result-detail">
                Subscription status: <strong>{{ confirmResult.subscription_status }}</strong>
              </div>
              <div v-if="confirmResult.entitlement_plan_code" class="result-detail">
                Entitlement plan: <strong>{{ confirmResult.entitlement_plan_code }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="close" class="btn btn-secondary">
          {{ confirmResult ? 'Close' : 'Cancel' }}
        </button>
        <button 
          v-if="!confirmResult"
          @click="confirmFinalize"
          class="btn btn-primary"
          :disabled="!canConfirm"
          :title="getConfirmTooltip()"
        >
          <span v-if="!confirming">Confirm Finalize</span>
          <span v-else>⏳ Processing...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  previewFinalize, 
  confirmFinalize as apiConfirmFinalize,
  type PreviewFinalizeDto,
  type ConfirmFinalizeDto
} from '../api/billingOpsApi'

const props = defineProps<{
  orderId: string
}>()

const emit = defineEmits<{
  close: []
  finalized: [data: { orderId: string; sessionId?: string }]
}>()

const preview = ref<PreviewFinalizeDto | null>(null)
const loadingPreview = ref(false)
const previewError = ref<string | null>(null)

const reason = ref('')
const reasonError = ref<string | null>(null)

const confirming = ref(false)
const confirmResult = ref<ConfirmFinalizeDto | null>(null)

const canConfirm = computed(() => {
  if (!preview.value || !preview.value.can_finalize) return false
  if (confirming.value) return false
  if (confirmResult.value) return false
  
  const trimmedReason = reason.value.trim()
  return trimmedReason.length >= 5
})

async function loadPreview() {
  loadingPreview.value = true
  previewError.value = null
  
  console.log('[BillingOps:Telemetry] preview_modal_opened', { order_id: props.orderId })
  
  try {
    preview.value = await previewFinalize(props.orderId)
    console.log('[BillingOps:Telemetry] preview_loaded', { 
      order_id: props.orderId,
      can_finalize: preview.value.can_finalize,
      blocked_reason: preview.value.blocked_reason,
      plan_to_activate: preview.value.plan_to_activate
    })
  } catch (err: any) {
    previewError.value = err.message || 'Failed to load preview'
    console.error('[BillingOps:Telemetry] preview_error', { 
      order_id: props.orderId,
      error: err.message 
    })
  } finally {
    loadingPreview.value = false
  }
}

async function confirmFinalize() {
  if (!canConfirm.value) return
  
  reasonError.value = null
  
  const trimmedReason = reason.value.trim()
  if (trimmedReason.length < 5) {
    reasonError.value = 'Reason must be at least 5 characters'
    console.log('[BillingOps:Telemetry] confirm_validation_failed', { 
      order_id: props.orderId,
      reason: 'reason_too_short'
    })
    return
  }
  
  confirming.value = true
  
  console.log('[BillingOps:Telemetry] confirm_finalize_started', { 
    order_id: props.orderId,
    reason_length: trimmedReason.length
  })
  
  try {
    confirmResult.value = await apiConfirmFinalize(props.orderId, trimmedReason)
    
    console.log('[BillingOps:Telemetry] confirm_finalize_completed', { 
      order_id: props.orderId,
      result: confirmResult.value.result,
      plan_activated: confirmResult.value.plan_activated,
      subscription_status: confirmResult.value.subscription_status
    })
    
    // Emit finalized event for parent to refresh
    if (confirmResult.value.result === 'activated' || confirmResult.value.result === 'already_completed') {
      const sessionId = preview.value?.checkout_session?.id
      emit('finalized', { orderId: props.orderId, sessionId })
    }
  } catch (err: any) {
    reasonError.value = err.message || 'Failed to confirm finalize'
    console.error('[BillingOps:Telemetry] confirm_finalize_error', { 
      order_id: props.orderId,
      error: err.message,
      error_code: err.code
    })
  } finally {
    confirming.value = false
  }
}

function close() {
  console.log('[BillingOps:Telemetry] modal_closed', { 
    order_id: props.orderId,
    had_result: !!confirmResult.value,
    result: confirmResult.value?.result
  })
  emit('close')
}

function getBlockedReasonText(reason: string | null): string {
  switch (reason) {
    case 'not_found':
      return 'Checkout session not found'
    case 'invalid_state':
      return 'Checkout session is in invalid state (failed or canceled)'
    case 'already_completed':
      return 'Checkout session already completed'
    default:
      return reason || 'Unknown reason'
  }
}

function getResultText(result: string): string {
  switch (result) {
    case 'activated':
      return 'Successfully activated subscription'
    case 'already_completed':
      return 'Already completed (idempotent)'
    case 'failed':
      return 'Failed to finalize'
    case 'invalid_state':
      return 'Invalid checkout session state'
    case 'not_found':
      return 'Checkout session not found'
    case 'invalid_reason':
      return 'Invalid reason provided'
    default:
      return result
  }
}

function getConfirmTooltip(): string {
  if (!preview.value) return 'Loading preview...'
  if (!preview.value.can_finalize) {
    return `Cannot finalize: ${getBlockedReasonText(preview.value.blocked_reason)}`
  }
  if (reason.value.trim().length < 5) {
    return 'Reason must be at least 5 characters'
  }
  return 'Confirm manual finalize'
}

function formatPendingAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return `${days}d ${hours}h`
}

onMounted(() => {
  loadPreview()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
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

.preview-section {
  margin-bottom: 24px;
}

.preview-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.preview-section h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.alert {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.alert-warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.alert-success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.alert-info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.alert-danger {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.state-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.state-column {
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
}

.text-muted {
  color: #999;
  font-style: italic;
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

.pending-age {
  font-weight: 600;
  color: #ff9800;
}

.required {
  color: #f44336;
}

.reason-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
}

.reason-input:focus {
  outline: none;
  border-color: #2196F3;
}

.reason-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.field-error {
  color: #f44336;
  font-size: 12px;
  margin-top: 4px;
}

.field-hint {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}

.confirm-result {
  margin-top: 16px;
}

.result-detail {
  margin-top: 8px;
  font-size: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
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
</style>
