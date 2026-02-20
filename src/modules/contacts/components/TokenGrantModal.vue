<template>
  <Modal :open="isOpen" @close="close" class="token-grant-modal">
    <template #header>
      <h3>{{ $t('contacts.grant.title') }}</h3>
    </template>
    
    <template #default>
      <div class="grant-form">
        <div class="form-group">
          <label for="grant-amount">
            {{ $t('contacts.grant.amount') }}
          </label>
          <input
            id="grant-amount"
            v-model.number="form.amount"
            type="number"
            min="1"
            max="1000"
            class="form-input"
            :class="{ 'error': errors.amount }"
            :placeholder="$t('contacts.grant.amountPlaceholder')"
          />
          <span v-if="errors.amount" class="error-text">{{ errors.amount }}</span>
        </div>
        
        <div class="form-group">
          <label for="grant-reason">
            {{ $t('contacts.grant.reason') }}
          </label>
          <Textarea
            v-model="form.reason"
            :rows="3"
            :placeholder="$t('contacts.grant.reasonPlaceholder')"
            :error="errors.reason || undefined"
          />
          <span v-if="errors.reason" class="error-text">{{ errors.reason }}</span>
          <span class="help-text">{{ $t('contacts.grant.reasonHelp') }}</span>
        </div>
        
        <div class="form-group">
          <label for="grant-subscription">
            {{ $t('contacts.grant.subscription') }} ({{ $t('common.optional') }})
          </label>
          <input
            id="grant-subscription"
            v-model.number="form.subscriptionId"
            type="number"
            class="form-input"
            :placeholder="$t('contacts.grant.subscriptionPlaceholder')"
          />
        </div>
        
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="modal-actions">
        <Button variant="outline" @click="close">
          {{ $t('common.cancel') }}
        </Button>
        <Button
          variant="primary"
          :disabled="!isValid || loading"
          :loading="loading"
          @click="submit"
        >
          {{ $t('contacts.grant.submit') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useContactTokensStore } from '../stores/contactTokensStore'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'success'])

const store = useContactTokensStore()

const form = ref({
  amount: 1,
  reason: '',
  subscriptionId: null
})

const errors = ref({
  amount: null,
  reason: null
})

const loading = computed(() => store.loading)
const error = computed(() => store.error)

const isValid = computed(() => {
  return form.value.amount >= 1 && 
         form.value.amount <= 1000 && 
         form.value.reason.trim().length >= 5
})

function close() {
  errors.value = { amount: null, reason: null }
  emit('close')
}

async function submit() {
  // Validate
  errors.value = { amount: null, reason: null }
  
  if (form.value.amount < 1 || form.value.amount > 1000) {
    errors.value.amount = 'Amount must be between 1 and 1000'
    return
  }
  
  if (form.value.reason.trim().length < 5) {
    errors.value.reason = 'Reason must be at least 5 characters'
    return
  }
  
  try {
    await store.grantTokens(
      form.value.amount,
      form.value.reason,
      form.value.subscriptionId || undefined
    )
    
    emit('success', {
      amount: form.value.amount,
      reason: form.value.reason
    })
    
    // Reset form
    form.value = {
      amount: 1,
      reason: '',
      subscriptionId: null
    }
    
    close()
  } catch (e) {
    // Error handled by store
  }
}
</script>

<style scoped>
.token-grant-modal {
  max-width: 480px;
}

.grant-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-surface);
  color: var(--color-text-primary);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input.error {
  border-color: var(--color-error);
}

.error-text {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.help-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.alert {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.alert-error {
  background: var(--color-error-subtle);
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

</style>
