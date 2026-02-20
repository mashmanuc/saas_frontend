<template>
  <Modal
    :open="true"
    :title="`Manual Finalize: ${orderId}`"
    size="lg"
    @close="close"
  >
    <div class="modal-body-content">
        <!-- Loading Preview -->
        <div v-if="loadingPreview" class="loading-state">
          Loading preview...
        </div>

        <!-- Preview Error -->
        <div v-else-if="previewError" class="error-state">
          <p class="error-message">{{ previewError }}</p>
          <Button variant="primary" size="sm" @click="loadPreview">Retry</Button>
        </div>

        <!-- Preview Content -->
        <div v-else-if="hasPreview" class="preview-content">
          <!-- Blocked Reason -->
          <div v-if="!canFinalize" class="alert alert-warning">
            <strong>Cannot finalize:</strong> {{ getBlockedReasonText(preview?.blocked_reason) }}
          </div>

          <!-- Preview Info -->
          <div class="preview-section">
            <h4>Preview</h4>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Order ID:</span>
                <code class="value">{{ preview?.order_id }}</code>
              </div>
              
              <div class="info-item" v-if="preview?.checkout_session">
                <span class="label">Session Status:</span>
                <span class="value">
                  <span class="status-badge" :class="`status-${preview.checkout_session.status}`">
                    {{ preview.checkout_session.status }}
                  </span>
                </span>
              </div>
              
              <div class="info-item" v-if="preview?.pending_age_seconds !== null">
                <span class="label">Pending Age:</span>
                <span class="value pending-age">{{ formatPendingAge(preview.pending_age_seconds) }}</span>
              </div>
              
              <div class="info-item" v-if="preview?.plan_to_activate">
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
              <div class="state-column" v-if="preview?.entitlement_before">
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
              <div class="state-column" v-else>
                <h5>Entitlement</h5>
                <p class="text-muted">No entitlement data</p>
              </div>
              
              <div class="state-column" v-if="preview?.subscription_before">
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
              :disabled="!canFinalize || confirming"
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

    <template #footer>
      <Button variant="secondary" @click="close">
        {{ confirmResult ? 'Close' : 'Cancel' }}
      </Button>
      <Button 
        v-if="!confirmResult"
        variant="primary"
        :disabled="!canConfirm"
        :loading="confirming"
        :title="getConfirmTooltip()"
        @click="confirmFinalize"
      >
        Confirm Finalize
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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

// P0.6: SSOT computed - заборонити прямі звернення до preview.can_finalize у template
const canFinalize = computed(() => preview.value?.can_finalize ?? false)
const hasPreview = computed(() => !!preview.value)

const canConfirm = computed(() => {
  if (!hasPreview.value || !canFinalize.value) return false
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
.modal-body-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
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

.preview-section {
  margin-bottom: var(--space-lg);
}

.preview-section h4 {
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.preview-section h5 {
  margin: 0 0 var(--space-xs) 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.alert {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.alert-warning {
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  color: var(--warning-bg);
  border: 1px solid color-mix(in srgb, var(--warning-bg) 30%, transparent);
}

.alert-success {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
  border: 1px solid color-mix(in srgb, var(--success-bg) 30%, transparent);
}

.alert-info {
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  color: var(--info-bg);
  border: 1px solid color-mix(in srgb, var(--info-bg) 30%, transparent);
}

.alert-danger {
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  color: var(--danger-bg);
  border: 1px solid color-mix(in srgb, var(--danger-bg) 30%, transparent);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.state-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.state-column {
  padding: var(--space-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.text-muted {
  color: var(--text-secondary);
  font-style: italic;
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

.status-badge.status-completed {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
}

.status-badge.status-failed {
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  color: var(--danger-bg);
}

.status-badge.status-canceled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.pending-age {
  font-weight: 600;
  color: var(--warning-bg);
}

.required {
  color: var(--danger-bg);
}

.reason-input {
  width: 100%;
  padding: var(--space-xs);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-sm);
  resize: vertical;
  background: var(--card-bg);
  color: var(--text-primary);
}

.reason-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.reason-input:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.field-error {
  color: var(--danger-bg);
  font-size: var(--text-xs);
  margin-top: var(--space-2xs);
}

.field-hint {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  margin-top: var(--space-2xs);
}

.confirm-result {
  margin-top: var(--space-md);
}

.result-detail {
  margin-top: var(--space-xs);
  font-size: var(--text-sm);
}
</style>
