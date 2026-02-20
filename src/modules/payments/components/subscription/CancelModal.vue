<script setup lang="ts">
// F27: Cancel Modal Component
import { ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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
  <Modal
    :open="!!subscription"
    title="Cancel Subscription?"
    size="sm"
    @close="emit('close')"
  >
    <div class="cancel-body">
      <div class="modal-icon">
        <AlertTriangle :size="48" />
      </div>

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
    </div>

    <template #footer>
      <Button variant="secondary" @click="emit('close')">
        Keep Subscription
      </Button>
      <Button variant="danger" @click="handleConfirm">
        Cancel Subscription
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.cancel-body {
  text-align: center;
}

.modal-icon {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-md);
  color: var(--warning-bg);
}

.modal-description {
  margin: 0 0 var(--space-lg);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.cancel-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  text-align: left;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.option input[type='radio'] {
  margin-top: 4px;
  accent-color: var(--accent);
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-content strong {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.option-content span {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
</style>
