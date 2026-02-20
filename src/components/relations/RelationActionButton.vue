<template>
  <button
    class="relation-action-button"
    :class="buttonClass"
    @click="handleClick"
    :disabled="isDisabled"
    data-testid="relation-action-button"
  >
    {{ buttonText }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { Relation } from '@/types/relations'

/**
 * RelationActionButton v0.62
 * 
 * Єдина кнопка дії для relation згідно інваріантів:
 * 1. Якщо can_chat і є active_lesson_id → кнопка "Message"
 * 2. Else якщо can_request_contact → "Request contact"
 * 3. Else → "Book lesson" або "Why locked"
 * 
 * Інваріант: FE не вгадує логіку, використовує поля з API
 */

interface Props {
  relation: Relation
  variant?: 'primary' | 'secondary'
}

interface Emits {
  (e: 'requestContact'): void
  (e: 'showLockedReason'): void
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary'
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const router = useRouter()

/**
 * Визначити тип дії згідно інваріантів v0.62
 */
const actionType = computed<'message' | 'requestContact' | 'bookLesson' | 'whyLocked'>(() => {
  // Правило 1: can_chat і active_lesson_id → Message
  if (props.relation.can_chat && props.relation.active_lesson_id) {
    return 'message'
  }
  
  // Правило 2: can_request_contact → Request contact
  if (props.relation.can_request_contact) {
    return 'requestContact'
  }
  
  // Правило 3: Book lesson або Why locked
  // Якщо є contact_locked_reason, показуємо "Why locked"
  if (props.relation.contact_locked_reason) {
    return 'whyLocked'
  }
  
  // Default: Book lesson
  return 'bookLesson'
})

/**
 * Текст кнопки згідно типу дії
 */
const buttonText = computed(() => {
  switch (actionType.value) {
    case 'message':
      return t('relationAction.message')
    case 'requestContact':
      return t('relationAction.requestContact')
    case 'bookLesson':
      return t('relationAction.bookLesson')
    case 'whyLocked':
      return t('relationAction.whyLocked')
    default:
      return ''
  }
})

/**
 * CSS клас кнопки
 */
const buttonClass = computed(() => {
  return {
    'btn-primary': props.variant === 'primary',
    'btn-secondary': props.variant === 'secondary',
    'btn-message': actionType.value === 'message',
    'btn-request': actionType.value === 'requestContact',
    'btn-book': actionType.value === 'bookLesson',
    'btn-locked': actionType.value === 'whyLocked'
  }
})

/**
 * Чи кнопка disabled
 */
const isDisabled = computed(() => {
  // Можна додати логіку disabled якщо потрібно
  return false
})

/**
 * Обробник кліку згідно типу дії
 */
function handleClick() {
  switch (actionType.value) {
    case 'message':
      // Навігація до чату уроку
      if (props.relation.active_lesson_id) {
        router.push(`/lessons/${props.relation.active_lesson_id}/chat`)
      }
      break
      
    case 'requestContact':
      // Emit event для відкриття InquiryModal
      emit('requestContact')
      break
      
    case 'bookLesson':
      // Навігація до booking з tutor_id
      router.push({
        name: 'booking',
        query: { tutor: props.relation.tutor.id }
      })
      break
      
    case 'whyLocked':
      // Emit event для показу ContactLockedPanel
      emit('showLockedReason')
      break
  }
}
</script>

<style scoped>
.relation-action-button {
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  white-space: nowrap;
}

.relation-action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-primary:active:not(:disabled) {
  filter: brightness(0.95);
}

.btn-secondary {
  background-color: var(--color-bg-secondary, #f3f4f6);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-bg-tertiary, #e5e7eb);
}

.btn-secondary:active:not(:disabled) {
  background-color: var(--border-color);
}

/* Специфічні стилі для типів дій */
.btn-message {
  /* Message - primary action */
}

.btn-request {
  /* Request contact - важлива дія */
  background-color: var(--color-success, #10b981);
}

.btn-request:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-book {
  /* Book lesson - стандартна дія */
}

.btn-locked {
  /* Why locked - інформаційна дія */
  background-color: var(--color-warning, #f59e0b);
}

.btn-locked:hover:not(:disabled) {
  filter: brightness(1.1);
}
</style>
