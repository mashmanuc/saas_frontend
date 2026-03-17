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
              <!-- SHARE-3: Contextual share after publish -->
              <p class="publish-dialog__share-prompt">{{ t('knowledge.publish.sharePrompt') }}</p>
              <div class="publish-dialog__share-row">
                <a
                  :href="`https://t.me/share/url?url=${encodeURIComponent(publishResult.url)}&text=${encodeURIComponent(publishResult.title)}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="publish-dialog__share-btn publish-dialog__share-btn--telegram"
                >
                  ✈️ {{ t('knowledge.publish.shareTelegram') }}
                </a>
                <a
                  :href="`viber://forward?text=${encodeURIComponent(publishResult.title + ' ' + publishResult.url)}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="publish-dialog__share-btn publish-dialog__share-btn--viber"
                >
                  📱 {{ t('knowledge.publish.shareViber') }}
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
