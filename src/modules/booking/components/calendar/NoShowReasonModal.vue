<template>
  <div v-if="modelValue" class="modal-overlay" @click="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ t('calendar.no_show.select_reason') }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="modal-body">
        <p class="description">{{ t('calendar.no_show.description') }}</p>
        
        <div class="reason-list">
          <label
            v-for="reason in reasons"
            :key="reason.id"
            class="reason-item"
            :class="{ selected: selectedReason === reason.id }"
          >
            <input
              v-model="selectedReason"
              type="radio"
              :value="reason.id"
              name="no-show-reason"
            />
            <span>{{ reason.label }}</span>
          </label>
        </div>
        
        <div class="comment-section">
          <label for="comment">{{ t('calendar.no_show.comment_optional') }}</label>
          <textarea
            id="comment"
            v-model="comment"
            :placeholder="t('calendar.no_show.comment_placeholder')"
            rows="3"
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="close">
          {{ t('common.cancel') }}
        </button>
        <button
          class="btn-primary"
          :disabled="!selectedReason || isLoading"
          @click="confirm"
        >
          {{ isLoading ? t('common.loading') : t('calendar.no_show.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  reasons?: Array<{ id: number; label: string }>
}>()

const emit = defineEmits<{
  confirm: [reasonId: number, comment: string]
}>()

const { t } = useI18n()
const modelValue = defineModel<boolean>()

const selectedReason = ref<number | null>(null)
const comment = ref('')
const isLoading = ref(false)

const reasons = computed(() => props.reasons || [
  { id: 1, label: t('calendar.no_show.reasons.student_absent') },
  { id: 2, label: t('calendar.no_show.reasons.student_late') },
  { id: 3, label: t('calendar.no_show.reasons.technical_issues') },
  { id: 4, label: t('calendar.no_show.reasons.other') }
])

const close = () => {
  modelValue.value = false
  selectedReason.value = null
  comment.value = ''
}

const confirm = () => {
  if (!selectedReason.value) return
  
  isLoading.value = true
  emit('confirm', selectedReason.value, comment.value)
  
  // Reset after emit
  setTimeout(() => {
    isLoading.value = false
    close()
  }, 100)
}
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

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.description {
  margin: 0 0 20px;
  color: #666;
  font-size: 14px;
}

.reason-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.reason-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.reason-item:hover {
  border-color: #2196F3;
  background: #f5f5f5;
}

.reason-item.selected {
  border-color: #2196F3;
  background: #E3F2FD;
}

.reason-item input[type="radio"] {
  cursor: pointer;
}

.reason-item span {
  font-size: 14px;
  color: #333;
}

.comment-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-section label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.comment-section textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.comment-section textarea:focus {
  outline: none;
  border-color: #2196F3;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-primary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976D2;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
