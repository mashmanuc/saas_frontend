<template>
  <Modal :open="isOpen" @close="close" class="report-user-modal">
    <template #header>
      <h3>{{ $t('trust.report.title') }}</h3>
    </template>
    
    <template #default>
      <div class="report-content">
        <div class="target-preview">
          <div class="target-icon">
            <i :class="targetIcon"></i>
          </div>
          <div class="target-info">
            <h4 class="target-name">{{ targetName }}</h4>
            <p class="target-type">{{ targetTypeLabel }}</p>
          </div>
        </div>
        
        <div class="form-group">
          <label>{{ $t('trust.report.categoryLabel') }}</label>
          <div class="category-options">
            <label
              v-for="cat in categories"
              :key="cat.value"
              class="category-option"
              :class="{ 'selected': category === cat.value }"
            >
              <input
                v-model="category"
                type="radio"
                :value="cat.value"
                name="category"
              />
              <i :class="cat.icon"></i>
              <span>{{ cat.label }}</span>
            </label>
          </div>
        </div>
        
        <div class="form-group">
          <Textarea
            v-model="comment"
            :label="$t('trust.report.commentLabel')"
            :rows="3"
            :placeholder="$t('trust.report.commentPlaceholder')"
            :maxlength="500"
          />
          <span class="char-count">{{ comment.length }}/500</span>
        </div>
        
        <div class="warning-box">
          <i class="icon-alert-triangle"></i>
          <p>{{ $t('trust.report.warning') }}</p>
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
          variant="danger"
          :disabled="!canSubmit || processing"
          :loading="processing"
          @click="submit"
        >
          {{ $t('trust.report.submit') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  targetType: {
    type: String,
    default: 'user', // 'user', 'inquiry', 'review', 'message'
    validator: (value) => ['user', 'inquiry', 'review', 'message'].includes(value)
  },
  targetId: {
    type: Number,
    required: true
  },
  targetName: {
    type: String,
    default: ''
  },
  processing: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'submit'])

const category = ref('')
const comment = ref('')

const categories = [
  { value: 'spam', label: 'Спам', icon: 'icon-mail' },
  { value: 'harassment', label: 'Домагання', icon: 'icon-user-x' },
  { value: 'fraud', label: 'Шахрайство', icon: 'icon-shield-off' },
  { value: 'inappropriate', label: 'Недоречний контент', icon: 'icon-alert-circle' },
  { value: 'other', label: 'Інше', icon: 'icon-more-horizontal' }
]

const targetIcon = computed(() => {
  const icons = {
    user: 'icon-user',
    inquiry: 'icon-message-square',
    review: 'icon-star',
    message: 'icon-message-circle'
  }
  return icons[props.targetType] || 'icon-alert-circle'
})

const targetTypeLabel = computed(() => {
  const labels = {
    user: 'Користувач',
    inquiry: 'Запит',
    review: 'Відгук',
    message: 'Повідомлення'
  }
  return labels[props.targetType] || 'Об\'єкт'
})

const canSubmit = computed(() => {
  return category.value !== ''
})

function close() {
  category.value = ''
  comment.value = ''
  emit('close')
}

function submit() {
  emit('submit', {
    targetType: props.targetType,
    targetId: props.targetId,
    category: category.value,
    comment: comment.value
  })
}
</script>

<style scoped>
.report-user-modal {
  max-width: 520px;
}

.report-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.target-preview {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.target-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-warning-subtle);
  color: var(--color-warning);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.target-icon i {
  font-size: 24px;
}

.target-info {
  flex: 1;
}

.target-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0 0 var(--spacing-xs);
}

.target-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
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

.category-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.category-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-option:hover {
  border-color: var(--color-border-hover);
}

.category-option.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.category-option input {
  display: none;
}

.category-option i {
  color: var(--color-text-secondary);
}

.category-option.selected i {
  color: var(--color-primary);
}

.category-option span {
  font-size: var(--font-size-sm);
}

.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-align: right;
}

.warning-box {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-warning-subtle);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  color: var(--color-warning);
}

.warning-box i {
  flex-shrink: 0;
}

.warning-box p {
  margin: 0;
  font-size: var(--font-size-sm);
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

@media (max-width: 480px) {
  .category-options {
    grid-template-columns: 1fr;
  }
}
</style>
