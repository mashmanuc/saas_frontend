<script setup lang="ts">
// F27: Cancel Modal Component
import { ref } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
import type { Subscription } from '../../api/payments'

const props = defineProps<{
  subscription: Subscription | null
}>()

const emit = defineEmits<{
  confirm: [atPeriodEnd: boolean]
  close: []
}>()

const cancelImmediately = ref(false)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function handleConfirm() {
  emit('confirm', !cancelImmediately.value)
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal">
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>

        <div class="modal-icon">
          <AlertTriangle :size="48" />
        </div>

        <h2>Cancel Subscription?</h2>

        <p class="modal-description">
          Are you sure you want to cancel your subscription? You'll lose access
          to premium features.
        </p>

        <div v-if="subscription" class="cancel-options">
          <label class="option">
            <input
              type="radio"
              name="cancel-type"
              :checked="!cancelImmediately"
              @change="cancelImmediately = false"
            />
            <div class="option-content">
              <strong>Cancel at period end</strong>
              <span>
                Keep access until {{ formatDate(subscription.current_period_end) }}
              </span>
            </div>
          </label>

          <label class="option">
            <input
              type="radio"
              name="cancel-type"
              :checked="cancelImmediately"
              @change="cancelImmediately = true"
            />
            <div class="option-content">
              <strong>Cancel immediately</strong>
              <span>Lose access right away (no refund)</span>
            </div>
          </label>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="emit('close')">
            Keep Subscription
          </button>
          <button class="btn btn-danger" @click="handleConfirm">
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  padding: 16px;
}

.modal {
  position: relative;
  width: 100%;
  max-width: 440px;
  padding: 32px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  text-align: center;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
}

.close-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.modal-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--color-warning, #f59e0b);
}

.modal h2 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
}

.modal-description {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

/* Cancel Options */
.cancel-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  text-align: left;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  cursor: pointer;
}

.option input[type='radio'] {
  margin-top: 4px;
  accent-color: var(--color-primary, #3b82f6);
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-content strong {
  font-size: 14px;
  color: var(--color-text-primary, #111827);
}

.option-content span {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

/* Actions */
.modal-actions {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary {
  background: var(--color-bg-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-danger {
  background: var(--color-danger, #ef4444);
  border: none;
  color: white;
}

.btn-danger:hover {
  background: var(--color-danger-dark, #dc2626);
}
</style>
