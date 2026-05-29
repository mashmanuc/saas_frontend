<!--
  WBFormulaInputModal — модальне вікно введення LaTeX формули.
  Використовується для створення і редагування formula_card.
  Ref: saas_docs/plans/FUTURE_WORK_PLAN_2026-05-30.md Phase 1
-->
<template>
  <Teleport to="body">
    <Transition name="wb-modal">
      <div
        v-if="visible"
        class="wb-formula-modal__backdrop"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div
          class="wb-formula-modal"
          role="dialog"
          aria-label="Формула (LaTeX)"
          aria-modal="true"
        >
          <!-- Header -->
          <div class="wb-formula-modal__header">
            <h3 class="wb-formula-modal__title">
              {{ initialFormula ? 'Редагувати формулу' : 'Додати формулу' }}
            </h3>
            <button
              type="button"
              class="wb-formula-modal__close"
              aria-label="Закрити"
              @click="$emit('close')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- LaTeX input -->
          <div class="wb-formula-modal__field">
            <label class="wb-formula-modal__label" for="wb-formula-input">
              LaTeX формула
            </label>
            <textarea
              id="wb-formula-input"
              ref="formulaInputRef"
              v-model="formulaValue"
              class="wb-formula-modal__textarea"
              placeholder="\sin^2 x + \cos^2 x = 1"
              rows="3"
              autocomplete="off"
              spellcheck="false"
              @keydown.ctrl.enter.prevent="handleSubmit"
              @keydown.meta.enter.prevent="handleSubmit"
            />
            <span class="wb-formula-modal__hint">Ctrl+Enter для підтвердження</span>
          </div>

          <!-- Live preview -->
          <div class="wb-formula-modal__preview-label">Попередній перегляд</div>
          <div class="wb-formula-modal__preview">
            <span
              v-if="renderedPreview"
              v-html="renderedPreview"
              class="wb-formula-modal__preview-content"
            />
            <span v-else class="wb-formula-modal__preview-empty">
              Почніть вводити LaTeX…
            </span>
          </div>

          <!-- Actions -->
          <div class="wb-formula-modal__actions">
            <button
              type="button"
              class="wb-formula-modal__btn wb-formula-modal__btn--secondary"
              @click="$emit('close')"
            >
              Скасувати
            </button>
            <button
              type="button"
              class="wb-formula-modal__btn wb-formula-modal__btn--primary"
              :disabled="!formulaValue.trim()"
              @click="handleSubmit"
            >
              {{ initialFormula ? 'Зберегти' : 'Додати' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

// ─── Props & Emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean
  /** Початкове значення при редагуванні (без $ delimiters) */
  initialFormula?: string
}>()

const emit = defineEmits<{
  close: []
  submit: [formula: string]
}>()

// ─── State ──────────────────────────────────────────────────────────────────

const formulaValue = ref('')
const formulaInputRef = ref<HTMLTextAreaElement | null>(null)

// ─── Live preview ────────────────────────────────────────────────────────────

const renderedPreview = computed((): string => {
  const f = formulaValue.value.trim()
  if (!f) return ''
  return renderTextWithLatex(`$$${f}$$`)
})

// ─── Auto-focus + prefill when modal opens ───────────────────────────────────

watch(() => props.visible, async (v) => {
  if (v) {
    formulaValue.value = props.initialFormula ?? ''
    await nextTick()
    formulaInputRef.value?.focus()
    formulaInputRef.value?.select()
  }
})

// ─── Submit ──────────────────────────────────────────────────────────────────

function handleSubmit(): void {
  const f = formulaValue.value.trim()
  if (!f) return
  emit('submit', f)
  formulaValue.value = ''
}
</script>

<style scoped>
.wb-formula-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.wb-formula-modal {
  width: 440px;
  max-width: calc(100vw - 32px);
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

.wb-formula-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-formula-modal__title {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.wb-formula-modal__close {
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
  transition: background 0.12s, color 0.12s;
}
.wb-formula-modal__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.wb-formula-modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wb-formula-modal__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
}

.wb-formula-modal__textarea {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: 'Fira Code', 'Courier New', monospace;
  color: #0f172a;
  background: #f8fafc;
  resize: vertical;
  min-height: 72px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.wb-formula-modal__textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}
.wb-formula-modal__textarea::placeholder {
  color: #94a3b8;
}

.wb-formula-modal__hint {
  font-size: 11px;
  color: #94a3b8;
}

/* Preview */
.wb-formula-modal__preview-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
}

.wb-formula-modal__preview {
  min-height: 72px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  text-align: center;
}

.wb-formula-modal__preview-content {
  font-size: 1.4rem;
  color: #1e293b;
  line-height: 1.5;
}

.wb-formula-modal__preview-empty {
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

/* Actions */
.wb-formula-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wb-formula-modal__btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.12s, color 0.12s;
}
.wb-formula-modal__btn--secondary {
  background: #f1f5f9;
  color: #475569;
}
.wb-formula-modal__btn--secondary:hover { background: #e2e8f0; color: #0f172a; }

.wb-formula-modal__btn--primary {
  background: #6366f1;
  color: #ffffff;
}
.wb-formula-modal__btn--primary:hover:not(:disabled) { background: #4f46e5; }
.wb-formula-modal__btn--primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* Modal transition (same as YouTube modal) */
.wb-modal-enter-active { transition: opacity 0.2s ease; }
.wb-modal-enter-active .wb-formula-modal { transition: transform 0.2s ease, opacity 0.2s ease; }
.wb-modal-leave-active { transition: opacity 0.15s ease; }
.wb-modal-leave-active .wb-formula-modal { transition: transform 0.15s ease, opacity 0.15s ease; }
.wb-modal-enter-from { opacity: 0; }
.wb-modal-enter-from .wb-formula-modal { transform: scale(0.95); opacity: 0; }
.wb-modal-leave-to { opacity: 0; }
.wb-modal-leave-to .wb-formula-modal { transform: scale(0.95); opacity: 0; }

/* KaTeX display math inline in preview */
:deep(.lc-display-math) {
  display: inline;
  margin: 0;
}
:deep(math) {
  font-size: 1em;
}
</style>
