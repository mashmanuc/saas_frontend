<template>
  <Teleport to="body">
    <div
      class="wb-link-modal-backdrop"
      @click.self="onCancel"
      @keydown.escape="onCancel"
    >
      <div class="wb-link-modal" role="dialog" :aria-label="t('winterboard.linkAttachment.dialogTitle')">
        <h3 class="wb-link-modal__title">
          {{ initialUrl ? t('winterboard.linkAttachment.edit') : t('winterboard.linkAttachment.add') }}
        </h3>

        <label class="wb-link-modal__label">
          <span>URL</span>
          <input
            ref="urlInputRef"
            v-model="urlInput"
            type="url"
            class="wb-link-modal__input"
            :class="{ 'wb-link-modal__input--invalid': showValidationError }"
            :placeholder="t('winterboard.linkAttachment.urlPlaceholder')"
            autocomplete="off"
            spellcheck="false"
            @keydown.enter.prevent="onSubmit"
            @blur="touched = true"
          />
          <p v-if="showValidationError" class="wb-link-modal__error">
            {{ t('winterboard.linkAttachment.invalidUrl') }}
          </p>
          <p v-else-if="urlInput.trim() && !isSafeUrl(urlInput) && !isSafeUrl(normalized)" class="wb-link-modal__hint">
            {{ t('winterboard.linkAttachment.hintHttps') }}
          </p>
          <p v-else-if="!urlInput.trim()" class="wb-link-modal__hint">
            {{ t('winterboard.linkAttachment.hintExample') }}
          </p>
          <p v-else class="wb-link-modal__hint wb-link-modal__hint--ok">
            ✓ {{ normalized }}
          </p>
        </label>

        <label class="wb-link-modal__label">
          <span>{{ t('winterboard.linkAttachment.titleLabel') }} <span class="wb-link-modal__optional">({{ t('winterboard.linkAttachment.optional') }})</span></span>
          <input
            v-model="titleInput"
            type="text"
            class="wb-link-modal__input"
            :placeholder="t('winterboard.linkAttachment.titlePlaceholder')"
            maxlength="120"
            autocomplete="off"
            @keydown.enter.prevent="onSubmit"
          />
        </label>

        <div class="wb-link-modal__actions">
          <button
            v-if="initialUrl"
            type="button"
            class="wb-link-modal__btn wb-link-modal__btn--danger"
            @click="onRemove"
          >
            {{ t('winterboard.linkAttachment.remove') }}
          </button>
          <span class="wb-link-modal__spacer" />
          <button type="button" class="wb-link-modal__btn" @click="onCancel">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="wb-link-modal__btn wb-link-modal__btn--primary"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// WB: LinkAttachmentModal — modal для додавання / редагування / видалення
// зовнішнього посилання на об'єкт. Mirror UX patterns: чисто Vue (без window.prompt),
// validation live, "https://" auto-prefix при submit, ESC/backdrop = cancel.

import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { isSafeUrl, normalizeUrl } from '../../utils/urlSafety'

interface Props {
  /** Поточне посилання (для edit-mode). Empty/undefined → add-mode. */
  initialUrl?: string
  initialTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialUrl: '',
  initialTitle: '',
})

const emit = defineEmits<{
  /** User saved a (valid) link. */
  save: [url: string, title: string]
  /** User clicked remove (only available in edit-mode). */
  remove: []
  /** User cancelled. */
  cancel: []
}>()

const { t } = useI18n()

const urlInput = ref(props.initialUrl)
const titleInput = ref(props.initialTitle)
const urlInputRef = ref<HTMLInputElement | null>(null)
const touched = ref(false)

const normalized = computed(() => normalizeUrl(urlInput.value))

const showValidationError = computed(() => {
  if (!touched.value) return false
  if (!urlInput.value.trim()) return false
  return !isSafeUrl(normalized.value)
})

const canSubmit = computed(() => {
  const u = urlInput.value.trim()
  if (!u) return false
  return isSafeUrl(normalizeUrl(u))
})

onMounted(() => {
  nextTick(() => urlInputRef.value?.focus())
})

function onSubmit(): void {
  touched.value = true
  if (!canSubmit.value) return
  emit('save', normalizeUrl(urlInput.value), titleInput.value.trim())
}

function onCancel(): void {
  emit('cancel')
}

function onRemove(): void {
  emit('remove')
}
</script>

<style scoped>
.wb-link-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.wb-link-modal {
  background: #ffffff;
  border-radius: 10px;
  padding: 20px;
  width: 420px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 14px;
  user-select: none;
}

.wb-link-modal__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.wb-link-modal__label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #475569;
  font-weight: 500;
}

.wb-link-modal__optional {
  color: #94a3b8;
  font-weight: 400;
}

.wb-link-modal__input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  color: #0f172a;
  background: #f8fafc;
  outline: none;
  user-select: text;
  transition: border-color 0.15s, background 0.15s;
}

.wb-link-modal__input:focus {
  border-color: #6366f1;
  background: #ffffff;
}

.wb-link-modal__input--invalid {
  border-color: #dc2626;
  background: #fef2f2;
}

.wb-link-modal__error {
  margin: 0;
  font-size: 11px;
  color: #dc2626;
}

.wb-link-modal__hint {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 400;
  word-break: break-all;
}

.wb-link-modal__hint--ok {
  color: #16a34a;
}

.wb-link-modal__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.wb-link-modal__spacer {
  flex: 1 1 auto;
}

.wb-link-modal__btn {
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #1e293b;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.wb-link-modal__btn:hover {
  background: #e2e8f0;
}

.wb-link-modal__btn--primary {
  background: #4f46e5;
  color: #ffffff;
  border-color: #4f46e5;
}

.wb-link-modal__btn--primary:hover:not(:disabled) {
  background: #4338ca;
  border-color: #4338ca;
}

.wb-link-modal__btn--primary:disabled {
  background: #cbd5e1;
  border-color: #cbd5e1;
  cursor: not-allowed;
}

.wb-link-modal__btn--danger {
  border-color: #fca5a5;
  color: #dc2626;
  background: #fef2f2;
}

.wb-link-modal__btn--danger:hover {
  background: #fee2e2;
  border-color: #f87171;
}
</style>
