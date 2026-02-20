<template>
  <Modal :open="!!modelValue" :title="t('calendar.no_show.select_reason')" size="sm" @close="close">
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
      <Textarea
        v-model="comment"
        :label="t('calendar.no_show.comment_optional')"
        :placeholder="t('calendar.no_show.comment_placeholder')"
        :rows="3"
      />
    </div>

    <template #footer>
      <Button variant="ghost" @click="close">
        {{ t('common.cancel') }}
      </Button>
      <Button
        variant="primary"
        :disabled="!selectedReason"
        :loading="isLoading"
        @click="confirm"
      >
        {{ t('calendar.no_show.confirm') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'

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
.description {
  margin: 0 0 20px;
  color: var(--text-secondary);
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
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.reason-item:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
}

.reason-item.selected {
  border-color: var(--accent);
  background: var(--accent-bg, #E3F2FD);
}

.reason-item input[type="radio"] {
  cursor: pointer;
}

.reason-item span {
  font-size: 14px;
  color: var(--text-primary);
}

.comment-section {
  margin-top: 8px;
}
</style>
