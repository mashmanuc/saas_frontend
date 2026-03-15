<template>
  <Teleport to="body">
    <Transition name="wb-modal">
      <div
        v-if="visible"
        class="wb-youtube-modal__backdrop"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div
          class="wb-youtube-modal"
          role="dialog"
          :aria-label="t('winterboard.youtube.modalTitle')"
          aria-modal="true"
        >
          <!-- Header -->
          <div class="wb-youtube-modal__header">
            <h3 class="wb-youtube-modal__title">{{ t('winterboard.youtube.modalTitle') }}</h3>
            <button
              type="button"
              class="wb-youtube-modal__close"
              :aria-label="t('winterboard.youtube.close')"
              @click="$emit('close')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- URL input -->
          <div class="wb-youtube-modal__field">
            <label class="wb-youtube-modal__label" for="wb-yt-url">
              {{ t('winterboard.youtube.urlLabel') }}
            </label>
            <input
              id="wb-yt-url"
              ref="urlInputRef"
              v-model="urlValue"
              type="url"
              class="wb-youtube-modal__input"
              :placeholder="t('winterboard.youtube.urlPlaceholder')"
              autocomplete="off"
              @keydown.enter.prevent="handleSubmit"
            />
          </div>

          <!-- Preview -->
          <div class="wb-youtube-modal__preview">
            <img
              v-if="previewVideoId"
              :src="thumbnailUrl"
              :alt="t('winterboard.youtube.preview')"
              class="wb-youtube-modal__thumbnail"
              loading="lazy"
            />
            <div v-else class="wb-youtube-modal__placeholder">
              <svg width="40" height="40" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2" y="4" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.2"/>
                <path d="M8 8l5 3-5 3V8z" fill="currentColor"/>
              </svg>
              <span>{{ t('winterboard.youtube.previewHint') }}</span>
            </div>
          </div>

          <!-- Title input (optional) -->
          <div class="wb-youtube-modal__field">
            <label class="wb-youtube-modal__label" for="wb-yt-title">
              {{ t('winterboard.youtube.titleLabel') }}
            </label>
            <input
              id="wb-yt-title"
              v-model="titleValue"
              type="text"
              class="wb-youtube-modal__input"
              :placeholder="t('winterboard.youtube.titlePlaceholder')"
              @keydown.enter.prevent="handleSubmit"
            />
          </div>

          <!-- Actions -->
          <div class="wb-youtube-modal__actions">
            <button
              type="button"
              class="wb-youtube-modal__btn wb-youtube-modal__btn--secondary"
              @click="$emit('close')"
            >
              {{ t('winterboard.youtube.cancel') }}
            </button>
            <button
              type="button"
              class="wb-youtube-modal__btn wb-youtube-modal__btn--primary"
              :disabled="!previewVideoId"
              @click="handleSubmit"
            >
              {{ t('winterboard.youtube.add') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// WBYouTubeModal — modal dialog for inserting YouTube video onto the board
// Ref: DAY2_AGENT_B.md B3.2
// Zone: AGENT-B (components/toolbar/WBYouTubeModal.vue)

import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseYouTubeVideoId, getYouTubeThumbnail } from '../../utils/youtubeParser'

// ─── Props & Emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { url: string; title?: string }]
}>()

const { t } = useI18n({ useScope: 'global' })

// ─── State ──────────────────────────────────────────────────────────────────

const urlValue = ref('')
const titleValue = ref('')
const urlInputRef = ref<HTMLInputElement | null>(null)

// ─── Computed ───────────────────────────────────────────────────────────────

const previewVideoId = computed(() => parseYouTubeVideoId(urlValue.value))
const thumbnailUrl = computed(() => previewVideoId.value ? getYouTubeThumbnail(previewVideoId.value) : '')

// ─── Auto-focus URL input when modal opens ──────────────────────────────────

watch(() => props.visible, async (v) => {
  if (v) {
    urlValue.value = ''
    titleValue.value = ''
    await nextTick()
    urlInputRef.value?.focus()
  }
})

// ─── Submit handler ─────────────────────────────────────────────────────────

function handleSubmit(): void {
  if (!previewVideoId.value) return
  emit('submit', {
    url: urlValue.value.trim(),
    title: titleValue.value.trim() || undefined,
  })
  urlValue.value = ''
  titleValue.value = ''
}
</script>

<style scoped>
.wb-youtube-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.wb-youtube-modal {
  width: 420px;
  max-width: calc(100vw - 32px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

.wb-youtube-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-youtube-modal__title {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.wb-youtube-modal__close {
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

.wb-youtube-modal__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.wb-youtube-modal__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-youtube-modal__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
}

.wb-youtube-modal__input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #0f172a;
  background: #f8fafc;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.wb-youtube-modal__input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.wb-youtube-modal__input::placeholder {
  color: #94a3b8;
}

.wb-youtube-modal__preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #1e293b;
}

.wb-youtube-modal__thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-youtube-modal__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
}

.wb-youtube-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wb-youtube-modal__btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-youtube-modal__btn--secondary {
  background: #f1f5f9;
  color: #475569;
}

.wb-youtube-modal__btn--secondary:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.wb-youtube-modal__btn--primary {
  background: #2563eb;
  color: #ffffff;
}

.wb-youtube-modal__btn--primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.wb-youtube-modal__btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Modal transition ─────────────────────────────────────────────────────── */

.wb-modal-enter-active {
  transition: opacity 0.2s ease;
}
.wb-modal-enter-active .wb-youtube-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.wb-modal-leave-active {
  transition: opacity 0.15s ease;
}
.wb-modal-leave-active .wb-youtube-modal {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.wb-modal-enter-from {
  opacity: 0;
}
.wb-modal-enter-from .wb-youtube-modal {
  transform: scale(0.95);
  opacity: 0;
}
.wb-modal-leave-to {
  opacity: 0;
}
.wb-modal-leave-to .wb-youtube-modal {
  transform: scale(0.95);
  opacity: 0;
}
</style>
