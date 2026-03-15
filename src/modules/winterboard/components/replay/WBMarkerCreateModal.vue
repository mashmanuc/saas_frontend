<template>
  <Teleport to="body">
    <Transition name="wb-modal">
      <div
        v-if="visible"
        class="wb-marker-modal__backdrop"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div
          class="wb-marker-modal"
          role="dialog"
          :aria-label="t('winterboard.markerModal.title')"
          aria-modal="true"
        >
          <!-- Header -->
          <div class="wb-marker-modal__header">
            <h3 class="wb-marker-modal__heading">{{ t('winterboard.markerModal.title') }}</h3>
            <button
              type="button"
              class="wb-marker-modal__close"
              :aria-label="t('winterboard.markerModal.close')"
              @click="$emit('close')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Title input -->
          <div class="wb-marker-modal__field">
            <label class="wb-marker-modal__label" for="wb-marker-title">
              {{ t('winterboard.markerModal.nameLabel') }}
            </label>
            <input
              id="wb-marker-title"
              ref="titleInputRef"
              v-model="titleValue"
              type="text"
              class="wb-marker-modal__input"
              :placeholder="t('winterboard.markerModal.namePlaceholder')"
              autocomplete="off"
              @keydown.enter.prevent="handleSubmit"
            />
          </div>

          <!-- Category select -->
          <div class="wb-marker-modal__field">
            <label class="wb-marker-modal__label" for="wb-marker-category">
              {{ t('winterboard.markerModal.categoryLabel') }}
            </label>
            <select
              id="wb-marker-category"
              v-model="categoryValue"
              class="wb-marker-modal__select"
            >
              <option
                v-for="cat in CATEGORIES"
                :key="cat"
                :value="cat"
              >
                {{ t(`winterboard.lessonMap.category.${cat}`) }}
              </option>
            </select>
          </div>

          <!-- Actions -->
          <div class="wb-marker-modal__actions">
            <button
              type="button"
              class="wb-marker-modal__btn wb-marker-modal__btn--secondary"
              @click="$emit('close')"
            >
              {{ t('winterboard.markerModal.cancel') }}
            </button>
            <button
              type="button"
              class="wb-marker-modal__btn wb-marker-modal__btn--primary"
              :disabled="!titleValue.trim()"
              @click="handleSubmit"
            >
              {{ t('winterboard.markerModal.create') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// WBMarkerCreateModal — modal for creating lesson markers in replay mode
// Ref: DAY4_AGENT_B.md B5.2
// Zone: AGENT-B (components/replay/)

import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LessonMarkerCategory } from '../../types/winterboard'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { title: string; category: string }]
}>()

const { t } = useI18n({ useScope: 'global' })

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES: LessonMarkerCategory[] = [
  'theory',
  'formula',
  'example',
  'practice',
  'solution',
  'custom',
]

// ─── State ──────────────────────────────────────────────────────────────────

const titleValue = ref('')
const categoryValue = ref<LessonMarkerCategory>('theory')
const titleInputRef = ref<HTMLInputElement | null>(null)

// ─── Auto-focus + reset when modal opens ────────────────────────────────────

watch(() => props.visible, async (v) => {
  if (v) {
    titleValue.value = ''
    categoryValue.value = 'theory'
    await nextTick()
    titleInputRef.value?.focus()
  }
})

// ─── Submit handler ─────────────────────────────────────────────────────────

function handleSubmit(): void {
  const title = titleValue.value.trim()
  if (!title) return
  emit('submit', {
    title,
    category: categoryValue.value,
  })
  titleValue.value = ''
  categoryValue.value = 'theory'
}
</script>

<style scoped>
.wb-marker-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.wb-marker-modal {
  width: 400px;
  max-width: calc(100vw - 32px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

.wb-marker-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-marker-modal__heading {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.wb-marker-modal__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-marker-modal__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.wb-marker-modal__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-marker-modal__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
}

.wb-marker-modal__input,
.wb-marker-modal__select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #0f172a;
  background: #f8fafc;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.wb-marker-modal__input:focus,
.wb-marker-modal__select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.wb-marker-modal__input::placeholder {
  color: #94a3b8;
}

.wb-marker-modal__select {
  cursor: pointer;
  appearance: auto;
}

.wb-marker-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wb-marker-modal__btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-marker-modal__btn--secondary {
  background: #f1f5f9;
  color: #475569;
}

.wb-marker-modal__btn--secondary:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.wb-marker-modal__btn--primary {
  background: #2563eb;
  color: #ffffff;
}

.wb-marker-modal__btn--primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.wb-marker-modal__btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Modal transition ─────────────────────────────────────────────────────── */

.wb-modal-enter-active {
  transition: opacity 0.2s ease;
}
.wb-modal-enter-active .wb-marker-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.wb-modal-leave-active {
  transition: opacity 0.15s ease;
}
.wb-modal-leave-active .wb-marker-modal {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.wb-modal-enter-from {
  opacity: 0;
}
.wb-modal-enter-from .wb-marker-modal {
  transform: scale(0.95);
  opacity: 0;
}
.wb-modal-leave-to {
  opacity: 0;
}
.wb-modal-leave-to .wb-marker-modal {
  transform: scale(0.95);
  opacity: 0;
}
</style>
