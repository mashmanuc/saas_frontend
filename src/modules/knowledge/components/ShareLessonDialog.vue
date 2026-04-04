<!-- P1-1: Standalone share dialog — reusable from board list, solo room, knowledge hub -->
<template>
  <Teleport to="body">
    <Transition name="share-dialog-fade">
      <div v-if="isOpen" class="share-dialog-overlay" @click.self="emit('close')">
        <div
          class="share-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="t('knowledge.share.title')"
          @keydown.escape="emit('close')"
        >
          <!-- Header -->
          <div class="share-dialog__header">
            <h2 class="share-dialog__title">{{ t('knowledge.share.title') }}</h2>
            <button
              type="button"
              class="share-dialog__close"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Lesson info -->
          <div class="share-dialog__lesson-info">
            <div class="share-dialog__lesson-title">{{ lessonTitle }}</div>
            <div v-if="lessonSubject" class="share-dialog__lesson-subject">{{ lessonSubject }}</div>
          </div>

          <!-- Copy link -->
          <div class="share-dialog__link-row">
            <input
              type="text"
              class="share-dialog__input"
              :value="absoluteUrl"
              readonly
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button type="button" class="share-dialog__btn share-dialog__btn--primary" @click="copyLink">
              {{ linkCopied ? '✓' : t('knowledge.share.copyLink') }}
            </button>
          </div>

          <!-- Social share -->
          <p class="share-dialog__prompt">{{ t('knowledge.share.sendTo') }}</p>
          <div class="share-dialog__social-row">
            <a
              :href="telegramUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="share-dialog__social-btn share-dialog__social-btn--telegram"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
              <span>Telegram</span>
            </a>
            <a
              :href="whatsappUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="share-dialog__social-btn share-dialog__social-btn--whatsapp"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>WhatsApp</span>
            </a>
            <a
              :href="viberUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="share-dialog__social-btn share-dialog__social-btn--viber"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.541 6.783.384 10.007c-.156 3.224-.22 9.276 5.685 10.886h.004l-.004 2.5s-.037.998.627 1.204c.8.246 1.27-.516 2.034-1.34.42-.452.998-1.116 1.434-1.622 3.946.332 6.98-.428 7.326-.544.8-.266 5.326-.84 6.063-6.846.76-6.2-.37-10.126-2.406-11.9C19.56.98 15.098-.018 11.4 0zm.503 1.9c3.26-.016 7.076.812 8.7 2.372 1.674 1.464 2.622 4.96 1.96 10.18-.595 4.842-4.244 5.186-4.912 5.408-.282.092-2.896.746-6.222.556 0 0-2.468 2.98-3.238 3.757-.12.124-.264.17-.358.148-.132-.032-.168-.188-.166-.416.004-.158.022-4.312.022-4.312C2.98 18.273 3.1 13.196 3.222 10.26 3.344 7.548 3.98 5.346 5.368 3.96 6.99 2.568 9.38 1.92 11.903 1.9z"/></svg>
              <span>Viber</span>
            </a>
          </div>

          <!-- Native share (mobile) -->
          <button
            v-if="hasNativeShare"
            type="button"
            class="share-dialog__native-btn"
            @click="nativeShare"
          >
            <Share2 :size="16" />
            {{ t('knowledge.share.moreOptions') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Share2 } from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  lessonTitle: string
  lessonSubject?: string
  lessonUrl: string // relative URL like /lesson/tutor-slug/lesson-slug
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const linkCopied = ref(false)

const absoluteUrl = computed(() => `${window.location.origin}${props.lessonUrl}`)
const shareText = computed(() => props.lessonTitle)

const telegramUrl = computed(() =>
  `https://t.me/share/url?url=${encodeURIComponent(absoluteUrl.value)}&text=${encodeURIComponent(shareText.value)}`
)
const whatsappUrl = computed(() =>
  `https://wa.me/?text=${encodeURIComponent(shareText.value + ' ' + absoluteUrl.value)}`
)
const viberUrl = computed(() =>
  `viber://forward?text=${encodeURIComponent(shareText.value + ' ' + absoluteUrl.value)}`
)

const hasNativeShare = computed(() => typeof navigator?.share === 'function')

async function copyLink() {
  try {
    await navigator.clipboard.writeText(absoluteUrl.value)
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  } catch { /* noop */ }
}

async function nativeShare() {
  try {
    await navigator.share({
      title: props.lessonTitle,
      url: absoluteUrl.value,
    })
  } catch { /* user cancelled */ }
}
</script>

<style scoped>
.share-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.share-dialog {
  background: var(--color-surface, #fff);
  border-radius: 16px;
  padding: 24px;
  max-width: 440px;
  width: 92%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
}

.share-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.share-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  margin: 0;
}

.share-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary, #64748b);
  transition: background 0.1s;
}

.share-dialog__close:hover { background: var(--bg-secondary, #f1f5f9); }

.share-dialog__lesson-info {
  margin-bottom: 16px;
}

.share-dialog__lesson-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.share-dialog__lesson-subject {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  margin-top: 2px;
}

.share-dialog__link-row {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.share-dialog__input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary, #0f172a);
  background: var(--bg-secondary, #f8fafc);
  outline: none;
  min-width: 0;
}

.share-dialog__btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  transition: background 0.15s;
}

.share-dialog__btn--primary {
  background: var(--accent, #6366f1);
  color: #fff;
}
.share-dialog__btn--primary:hover { background: #4f46e5; }

.share-dialog__prompt {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  margin: 0 0 12px;
}

.share-dialog__social-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.share-dialog__social-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-primary, #475569);
  background: var(--bg-secondary, #f8fafc);
  transition: all 0.15s;
  flex: 1;
  justify-content: center;
  min-width: 100px;
}

.share-dialog__social-btn:hover { transform: translateY(-1px); }

.share-dialog__social-btn--telegram:hover {
  background: #e0f2fe;
  border-color: #0ea5e9;
  color: #0284c7;
}

.share-dialog__social-btn--whatsapp:hover {
  background: #dcfce7;
  border-color: #22c55e;
  color: #16a34a;
}

.share-dialog__social-btn--viber:hover {
  background: #f0e6ff;
  border-color: #7360f2;
  color: #7360f2;
}

.share-dialog__native-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
  background: none;
  border: 1px dashed var(--border-color, #e2e8f0);
  cursor: pointer;
  transition: all 0.15s;
}

.share-dialog__native-btn:hover {
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-primary, #0f172a);
}

.share-dialog-fade-enter-active,
.share-dialog-fade-leave-active { transition: opacity 0.2s ease; }
.share-dialog-fade-enter-from,
.share-dialog-fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .share-dialog-overlay { align-items: flex-end; }
  .share-dialog {
    width: 100%;
    max-width: 100%;
    border-radius: 16px 16px 0 0;
  }
}
</style>
