<!--
  Soft success modal after saving a board as a lesson/template from the Studio.
  Confirms WHERE the saved item lives + provides one-click navigation OR
  "continue here" without forcing user away from the board.

  Behavior:
    - lighter overlay (bg-black/30) — soft, not blocking dramatic UI
    - click outside, ESC, X button — all dismiss
    - auto-dismiss after AUTO_DISMISS_MS — user не залишається з orphan modal

  Props:
    modelValue: boolean — v-model show/hide
    lessonTitle: string
    kind: 'lesson' | 'template'
-->
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="lesson-saved-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
      @click.self="close"
      @keydown.escape="close"
    >
      <div
        ref="dialogRef"
        class="lesson-saved-dialog bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 relative"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <!-- Close (x) -->
        <button
          type="button"
          class="lesson-saved-dialog__close"
          :aria-label="t('common.close')"
          @click="close"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6">
            <line x1="3" y1="3" x2="15" y2="15" />
            <line x1="15" y1="3" x2="3" y2="15" />
          </svg>
        </button>

        <!-- Success icon -->
        <div class="lesson-saved-dialog__icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="20" fill="#DCFCE7" />
            <path d="M12 20.5l5 5L28 14" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <!-- Title -->
        <h2 class="lesson-saved-dialog__title">{{ title }}</h2>

        <!-- Body — where it is + link/name -->
        <p class="lesson-saved-dialog__body">
          {{ bodyText }}
          <span v-if="lessonTitle" class="lesson-saved-dialog__name">«{{ lessonTitle }}»</span>
        </p>
        <p class="lesson-saved-dialog__hint">{{ hintText }}</p>

        <!-- Actions -->
        <div class="lesson-saved-dialog__actions">
          <button
            type="button"
            class="lesson-saved-dialog__btn lesson-saved-dialog__btn--ghost"
            @click="continueHere"
          >
            {{ t('knowledge.savedSuccess.continueHere') }}
          </button>
          <button
            type="button"
            class="lesson-saved-dialog__btn lesson-saved-dialog__btn--primary"
            @click="goToList"
          >
            {{ t('knowledge.savedSuccess.goToList') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

interface Props {
  modelValue: boolean
  lessonTitle?: string
  kind?: 'lesson' | 'template'
}

const props = withDefaults(defineProps<Props>(), {
  lessonTitle: '',
  kind: 'lesson',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()
const router = useRouter()

const dialogRef = ref<HTMLElement | null>(null)

// Auto-dismiss timer (8s) — soft default, user може dismiss раніше
const AUTO_DISMISS_MS = 8000
let dismissTimer: ReturnType<typeof setTimeout> | null = null

const title = computed(() =>
  props.kind === 'template'
    ? t('knowledge.savedSuccess.titleTemplate')
    : t('knowledge.savedSuccess.titleLesson'),
)

const bodyText = computed(() =>
  props.kind === 'template'
    ? t('knowledge.savedSuccess.bodyTemplate')
    : t('knowledge.savedSuccess.bodyLesson'),
)

const hintText = computed(() => t('knowledge.savedSuccess.hint'))

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      nextTick(() => dialogRef.value?.focus())
      if (dismissTimer) clearTimeout(dismissTimer)
      dismissTimer = setTimeout(close, AUTO_DISMISS_MS)
    } else if (dismissTimer) {
      clearTimeout(dismissTimer)
      dismissTimer = null
    }
  },
)

onUnmounted(() => {
  if (dismissTimer) clearTimeout(dismissTimer)
})

function close(): void {
  emit('update:modelValue', false)
}

function continueHere(): void {
  close()
}

function goToList(): void {
  close()
  router.push({ name: 'MyLessons' })
}
</script>

<style scoped>
.lesson-saved-dialog__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.lesson-saved-dialog__close:hover {
  background: #f1f5f9;
  color: #475569;
}

.lesson-saved-dialog__icon {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.lesson-saved-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
  margin: 0 0 8px 0;
}

.lesson-saved-dialog__body {
  font-size: 14px;
  color: #475569;
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.lesson-saved-dialog__name {
  display: inline-block;
  margin-top: 4px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.lesson-saved-dialog__hint {
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  margin: 8px 0 0 0;
}

.lesson-saved-dialog__actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.lesson-saved-dialog__btn {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  border: 1px solid transparent;
}

.lesson-saved-dialog__btn--ghost {
  background: transparent;
  color: #475569;
  border-color: #e2e8f0;
}
.lesson-saved-dialog__btn--ghost:hover {
  background: #f8fafc;
  color: #0f172a;
}

.lesson-saved-dialog__btn--primary {
  background: #0f766e;
  color: white;
}
.lesson-saved-dialog__btn--primary:hover {
  background: #115e59;
}
</style>
