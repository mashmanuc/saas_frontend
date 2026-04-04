<template>
  <Teleport to="body">
    <Transition name="publish-dialog-fade">
      <div v-if="isOpen" class="publish-dialog-overlay" @click.self="emit('close')">
        <div
          class="publish-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="t('knowledge.publish.title')"
          @keydown.escape="emit('close')"
        >
          <!-- Header -->
          <div class="publish-dialog__header">
            <h2 class="publish-dialog__title">{{ t('knowledge.publish.title') }}</h2>
            <button
              type="button"
              class="publish-dialog__close"
              :aria-label="t('knowledge.publish.cancel')"
              @click="emit('close')"
            >
              <X :size="18" />
            </button>
          </div>

          <p class="publish-dialog__desc">{{ t('knowledge.publish.description') }}</p>

          <!-- Success state -->
          <template v-if="publishResult">
            <div class="publish-dialog__success">
              <CheckCircle :size="32" class="text-green-500" />
              <p class="publish-dialog__success-text">{{ t('knowledge.publish.success') }}</p>
              <div class="publish-dialog__success-link-row">
                <input
                  type="text"
                  class="publish-dialog__input"
                  :value="publishResult.url"
                  readonly
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <button type="button" class="publish-dialog__btn publish-dialog__btn--primary" @click="copyLink">
                  {{ linkCopied ? '✓' : t('knowledge.publish.copyLink') }}
                </button>
              </div>
              <!-- P1-1: Sharing moment — growth engine -->
              <p class="publish-dialog__share-prompt">{{ t('knowledge.publish.sharePrompt') }}</p>
              <div class="publish-dialog__share-row">
                <a
                  :href="telegramShareUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="publish-dialog__share-btn publish-dialog__share-btn--telegram"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  {{ t('knowledge.publish.shareTelegram') }}
                </a>
                <a
                  :href="whatsappShareUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="publish-dialog__share-btn publish-dialog__share-btn--whatsapp"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {{ t('knowledge.publish.shareWhatsApp') }}
                </a>
                <a
                  :href="viberShareUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="publish-dialog__share-btn publish-dialog__share-btn--viber"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.541 6.783.384 10.007c-.156 3.224-.22 9.276 5.685 10.886h.004l-.004 2.5s-.037.998.627 1.204c.8.246 1.27-.516 2.034-1.34.42-.452.998-1.116 1.434-1.622 3.946.332 6.98-.428 7.326-.544.8-.266 5.326-.84 6.063-6.846.76-6.2-.37-10.126-2.406-11.9C19.56.98 15.098-.018 11.4 0zm.503 1.9c3.26-.016 7.076.812 8.7 2.372 1.674 1.464 2.622 4.96 1.96 10.18-.595 4.842-4.244 5.186-4.912 5.408-.282.092-2.896.746-6.222.556 0 0-2.468 2.98-3.238 3.757-.12.124-.264.17-.358.148-.132-.032-.168-.188-.166-.416.004-.158.022-4.312.022-4.312C2.98 18.273 3.1 13.196 3.222 10.26 3.344 7.548 3.98 5.346 5.368 3.96 6.99 2.568 9.38 1.92 11.903 1.9z"/></svg>
                  {{ t('knowledge.publish.shareViber') }}
                </a>
              </div>
            </div>
          </template>

          <!-- Form -->
          <template v-else>
            <form @submit.prevent="handleSubmit" class="publish-dialog__form">
              <!-- Title -->
              <div class="publish-dialog__field">
                <label class="publish-dialog__label" for="pub-title">{{ t('knowledge.publish.lessonTitle') }} *</label>
                <input
                  id="pub-title"
                  v-model="form.title"
                  type="text"
                  class="publish-dialog__input"
                  :placeholder="t('knowledge.publish.lessonTitle')"
                  required
                />
              </div>

              <!-- Description -->
              <div class="publish-dialog__field">
                <label class="publish-dialog__label" for="pub-desc">{{ t('knowledge.publish.lessonDescription') }}</label>
                <textarea
                  id="pub-desc"
                  v-model="form.description"
                  class="publish-dialog__textarea"
                  rows="3"
                  :placeholder="t('knowledge.publish.lessonDescription')"
                />
              </div>

              <!-- Subject -->
              <div class="publish-dialog__field">
                <label class="publish-dialog__label" for="pub-subject">{{ t('knowledge.publish.subject') }}</label>
                <input
                  id="pub-subject"
                  v-model="form.subjectTag"
                  type="text"
                  class="publish-dialog__input"
                  :placeholder="t('knowledge.publish.subject')"
                />
              </div>

              <!-- Difficulty -->
              <div class="publish-dialog__field">
                <label class="publish-dialog__label" for="pub-difficulty">{{ t('knowledge.publish.difficulty') }}</label>
                <select id="pub-difficulty" v-model="form.difficultyLevel" class="publish-dialog__select">
                  <option value="">—</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>

              <!-- Visibility -->
              <div class="publish-dialog__field">
                <label class="publish-dialog__label">{{ t('knowledge.publish.visibility') }}</label>
                <div class="publish-dialog__radios">
                  <label class="publish-dialog__radio-label">
                    <input type="radio" v-model="form.visibility" value="public" />
                    {{ t('knowledge.publish.visibilityPublic') }}
                  </label>
                  <label class="publish-dialog__radio-label">
                    <input type="radio" v-model="form.visibility" value="demo" />
                    {{ t('knowledge.publish.visibilityDemo') }}
                  </label>
                </div>
              </div>

              <!-- Student consent -->
              <StudentConsentForm v-model="form.consent" />

              <!-- Error -->
              <p v-if="publishError" class="publish-dialog__error" role="alert">{{ publishError }}</p>

              <!-- Actions -->
              <div class="publish-dialog__actions">
                <button
                  type="button"
                  class="publish-dialog__btn publish-dialog__btn--secondary"
                  @click="emit('close')"
                >
                  {{ t('knowledge.publish.cancel') }}
                </button>
                <button
                  type="submit"
                  class="publish-dialog__btn publish-dialog__btn--primary"
                  :disabled="isPublishing || !canSubmit"
                >
                  {{ isPublishing ? t('knowledge.publish.publishing') : t('knowledge.publish.publish') }}
                </button>
              </div>
            </form>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, CheckCircle } from 'lucide-vue-next'
import StudentConsentForm, { type ConsentData } from './StudentConsentForm.vue'
import { usePublishLesson } from '../composables/usePublishLesson'

const props = defineProps<{
  sessionId: string
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  published: [lesson: { id: string; title: string; url: string }]
}>()

const { t } = useI18n()
const { publish, isPublishing, publishedLesson, publicUrl, error: publishComposableError, reset } = usePublishLesson()

const form = reactive({
  title: '',
  description: '',
  subjectTag: '',
  difficultyLevel: '',
  visibility: 'public' as 'public' | 'demo',
  consent: {
    hasStudentData: false,
    studentConsented: false,
    anonymize: false,
  } as ConsentData,
})

const publishError = ref<string | null>(null)
const publishResult = ref<{ id: string; title: string; url: string } | null>(null)
const linkCopied = ref(false)

const canSubmit = computed(() => {
  if (!form.title.trim()) return false
  if (form.consent.hasStudentData && !form.consent.studentConsented && !form.consent.anonymize) return false
  return true
})

// P1-1: Share URL helpers
const shareAbsoluteUrl = computed(() => {
  if (!publishResult.value?.url) return ''
  return `${window.location.origin}${publishResult.value.url}`
})
const shareText = computed(() => publishResult.value?.title || '')

const telegramShareUrl = computed(() =>
  `https://t.me/share/url?url=${encodeURIComponent(shareAbsoluteUrl.value)}&text=${encodeURIComponent(shareText.value)}`
)
const whatsappShareUrl = computed(() =>
  `https://wa.me/?text=${encodeURIComponent(shareText.value + ' ' + shareAbsoluteUrl.value)}`
)
const viberShareUrl = computed(() =>
  `viber://forward?text=${encodeURIComponent(shareText.value + ' ' + shareAbsoluteUrl.value)}`
)

async function handleSubmit() {
  if (!canSubmit.value) return
  publishError.value = null

  await publish(props.sessionId, {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    subject_tag: form.subjectTag.trim() || undefined,
    visibility: form.visibility,
  })

  if (publishedLesson.value) {
    const result = {
      id: publishedLesson.value.id,
      title: publishedLesson.value.title,
      url: publicUrl.value || `/lesson/${publishedLesson.value.tutor_slug || ''}/${publishedLesson.value.slug || ''}`,
    }
    publishResult.value = result
    emit('published', result)
  } else if (publishComposableError.value) {
    publishError.value = publishComposableError.value
  } else {
    // BUG-12 fix: fallback error when no result and no explicit error
    publishError.value = 'Публікація не вдалася. Спробуйте ще раз.'
  }
}

async function copyLink() {
  if (!publishResult.value?.url) return
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${publishResult.value.url}`)
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  } catch { /* noop */ }
}
</script>

<style scoped>
.publish-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.publish-dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  max-width: 520px;
  width: 92%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
}

.publish-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.publish-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.publish-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #64748b;
  transition: background 0.1s;
}

.publish-dialog__close:hover { background: #f1f5f9; }

.publish-dialog__desc {
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 16px;
}

.publish-dialog__form { display: flex; flex-direction: column; gap: 14px; }

.publish-dialog__field { display: flex; flex-direction: column; gap: 4px; }

.publish-dialog__label {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.publish-dialog__input,
.publish-dialog__textarea,
.publish-dialog__select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #0f172a;
  background: #f8fafc;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.publish-dialog__input:focus,
.publish-dialog__textarea:focus,
.publish-dialog__select:focus {
  border-color: #6366f1;
  background: #fff;
}

.publish-dialog__textarea { resize: vertical; min-height: 60px; }

.publish-dialog__radios { display: flex; gap: 16px; }

.publish-dialog__radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #0f172a;
  cursor: pointer;
}

.publish-dialog__error {
  color: #ef4444;
  font-size: 13px;
  margin: 0;
}

.publish-dialog__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.publish-dialog__btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.publish-dialog__btn--primary {
  background: #6366f1;
  color: #fff;
}

.publish-dialog__btn--primary:hover { background: #4f46e5; }
.publish-dialog__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

.publish-dialog__btn--secondary {
  background: #f1f5f9;
  color: #0f172a;
}

.publish-dialog__btn--secondary:hover { background: #e2e8f0; }

.publish-dialog__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.publish-dialog__success-text {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.publish-dialog__success-link-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.publish-dialog__share-prompt {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  margin: 4px 0 0;
}

.publish-dialog__share-row {
  display: flex;
  gap: 8px;
}

.publish-dialog__share-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid #e2e8f0;
  color: #475569;
  background: #f8fafc;
  transition: background 0.12s, border-color 0.12s;
}

.publish-dialog__share-btn:hover { background: #f1f5f9; }

.publish-dialog__share-btn--telegram:hover {
  background: #e0f2fe;
  border-color: #0ea5e9;
  color: #0284c7;
}

.publish-dialog__share-btn--whatsapp:hover {
  background: #dcfce7;
  border-color: #22c55e;
  color: #16a34a;
}

.publish-dialog__share-btn--viber:hover {
  background: #f0e6ff;
  border-color: #7360f2;
  color: #7360f2;
}

.publish-dialog-fade-enter-active,
.publish-dialog-fade-leave-active { transition: opacity 0.2s ease; }
.publish-dialog-fade-enter-from,
.publish-dialog-fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .publish-dialog-overlay { align-items: flex-end; }
  .publish-dialog {
    width: 100%;
    max-width: 100%;
    border-radius: 16px 16px 0 0;
    max-height: 90dvh;
  }
}
</style>
