<template>
  <div
    class="wb-text-overlay"
    @mousedown.stop
    @click.stop
  >
    <div class="wb-text-overlay__header">
      <span class="wb-text-overlay__title">{{ t('winterboard.objectText.title') }}</span>
      <button class="wb-text-overlay__close" @click="handleClose">×</button>
    </div>

    <!-- Readonly mode: just show text -->
    <template v-if="readonly">
      <div class="wb-text-overlay__content">{{ text || t('winterboard.objectText.placeholder') }}</div>
    </template>

    <!-- Edit mode: textarea with save -->
    <template v-else>
      <textarea
        ref="textareaRef"
        class="wb-text-overlay__textarea"
        v-model="draft"
        :placeholder="t('winterboard.objectText.placeholder')"
        @keydown.stop
        @keydown.enter.ctrl.prevent="handleSave"
        @keydown.enter.meta.prevent="handleSave"
      />
      <div class="wb-text-overlay__footer">
        <button
          v-if="text"
          class="wb-text-overlay__btn wb-text-overlay__btn--delete"
          @click="emit('delete')"
        >
          {{ t('winterboard.objectText.delete') }}
        </button>
        <button
          class="wb-text-overlay__btn wb-text-overlay__btn--save"
          :disabled="!draft.trim()"
          @click="handleSave"
        >
          {{ t('winterboard.objectText.save', 'Зберегти') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Object Text Overlay — edit/view text annotation.
 *
 * INV: Draft is local — save only on explicit action (button / Ctrl+Enter).
 * INV: On open, draft = existing text (or empty for new).
 * INV: Close without save = discard changes.
 */
import { ref, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  /** Current saved text on the object */
  text: string
  /** True in replay/readonly mode */
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})

const emit = defineEmits<{
  /** Save text to object */
  save: [text: string]
  /** Close overlay (no save) */
  close: []
  /** Delete text from object */
  delete: []
}>()

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Local draft — initialized from props.text, saved only on explicit action
const draft = ref(props.text ?? '')

// Reset draft when text prop changes (e.g. reopen on different object)
watch(() => props.text, (newText) => {
  draft.value = newText ?? ''
})

function handleSave() {
  const trimmed = draft.value.trim()
  if (trimmed) {
    emit('save', trimmed)
  }
  emit('close')
}

function handleClose() {
  // Discard unsaved changes
  emit('close')
}

onMounted(() => {
  if (!props.readonly) {
    nextTick(() => {
      textareaRef.value?.focus()
    })
  }
})
</script>

<style scoped>
.wb-text-overlay {
  width: 280px;
  background: var(--wb-bg-primary, #ffffff);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.wb-text-overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--wb-border, #e2e8f0);
  background: var(--wb-bg-secondary, #f8fafc);
  border-radius: 8px 8px 0 0;
}

.wb-text-overlay__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-secondary, #64748b);
}

.wb-text-overlay__close {
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  color: var(--wb-text-secondary, #64748b);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.wb-text-overlay__close:hover {
  background: var(--wb-bg-hover, #f1f5f9);
  color: var(--wb-text-primary, #334155);
}

.wb-text-overlay__content {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--wb-text-primary, #1e293b);
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 40px;
}

.wb-text-overlay__textarea {
  min-height: 80px;
  max-height: 200px;
  padding: 8px 10px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--wb-text-primary, #1e293b);
  background: transparent;
}

.wb-text-overlay__textarea::placeholder {
  color: var(--wb-text-secondary, #94a3b8);
}

.wb-text-overlay__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px 6px;
  border-top: 1px solid var(--wb-border, #e2e8f0);
}

.wb-text-overlay__btn {
  font-size: 11px;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.wb-text-overlay__btn--delete {
  background: none;
  color: #ef4444;
}

.wb-text-overlay__btn--delete:hover {
  background: rgba(239, 68, 68, 0.1);
}

.wb-text-overlay__btn--save {
  background: var(--color-primary, #2563eb);
  color: white;
  font-weight: 600;
  margin-left: auto;
}

.wb-text-overlay__btn--save:hover {
  background: var(--color-primary-hover, #1d4ed8);
}

.wb-text-overlay__btn--save:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
