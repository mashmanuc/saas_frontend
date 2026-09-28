<!-- Phase 21: Save session as draft lesson dialog
     Ref: PHASE21_KNOWLEDGE_CORE.md -->
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="save-lesson-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="close"
      @keydown.escape="close"
    >
      <div
        ref="dialogRef"
        class="save-lesson-dialog bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="texts.title"
        tabindex="-1"
      >
        <h2 class="text-lg font-bold text-gray-900">{{ texts.title }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ texts.subtitle }}</p>

        <!-- Title input -->
        <div class="mt-4">
          <label for="lesson-title" class="block text-sm font-medium text-gray-700">
            {{ texts.label }}
          </label>
          <input
            id="lesson-title"
            ref="titleInput"
            v-model="title"
            class="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :placeholder="$t('winterboard.lesson.titlePlaceholder')"
            maxlength="255"
            @keydown.enter="save"
          />
          <p class="mt-1 text-xs text-gray-400 text-right">{{ title.length }}/255</p>
        </div>

        <!-- Error -->
        <p v-if="saveError" class="mt-2 text-sm text-red-600" role="alert" data-testid="save-lesson-error">{{ saveError }}</p>

        <!-- Actions -->
        <div class="save-lesson-dialog__actions">
          <button
            type="button"
            class="save-lesson-dialog__btn save-lesson-dialog__btn--cancel"
            @click="close"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="isSaving || !title.trim()"
            class="save-lesson-dialog__btn save-lesson-dialog__btn--save"
            @click="save"
          >
            {{ isSaving ? texts.saving : texts.save }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  sessionId: string
  defaultTitle?: string
  /**
   * 'copy' — «Зберегти як новий шаблон» з проведеного уроку (ТЗ
   * TZ_SAVE_FROM_LIVE_LESSON_AS_TEMPLATE; LAW §9 v1.18). Той самий API, інші тексти.
   */
  mode?: 'lesson' | 'copy'
  /**
   * Перед запитом (момент знімка): бар'єр артефакту й блок дошки. Рядок — причина
   * відмови: показуємо її, запиту немає; null — зберігаємо.
   */
  beforeSave?: () => Promise<string | null>
  /** Після спроби — завжди, коли викликали beforeSave (успіх, відмова, виняток): зняти блок. */
  afterSave?: () => void
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [lesson: { id: string; title: string }]
}>()

const dialogRef = ref<HTMLElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const title = ref('')
const isSaving = ref(false)
const saveError = ref<string | null>(null)

const texts = computed(() => props.mode === 'copy'
  ? {
      title: t('winterboard.lesson.copy.title'),
      subtitle: t('winterboard.lesson.copy.subtitle'),
      label: t('winterboard.lesson.copy.titleLabel'),
      save: t('winterboard.lesson.copy.save'),
      saving: t('winterboard.lesson.copy.saving'),
    }
  : {
      title: t('winterboard.lesson.saveTitle'),
      subtitle: t('winterboard.lesson.saveSubtitle'),
      label: t('winterboard.lesson.titleLabel'),
      save: t('winterboard.lesson.saveButton'),
      saving: t('winterboard.lesson.saving'),
    })

/** Причина відмови сервера людською мовою (ТЗ §2: учитель бачить причину, нічого не збережено). */
function saveErrorText(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { error?: unknown } }; data?: { error?: unknown } }
  const code = e?.response?.data?.error ?? e?.data?.error
  if (code === 'board_state_unavailable') return t('winterboard.lesson.saveErrorState')
  if (code === 'plan_transfer_failed') return t('winterboard.lesson.saveErrorPlan')
  if (!e?.response) return t('winterboard.lesson.saveErrorNetwork')
  return t('winterboard.lesson.saveError')
}

// Reset form when dialog opens
watch(() => props.modelValue, (open) => {
  if (open) {
    title.value = props.defaultTitle || ''
    saveError.value = null
    isSaving.value = false
    nextTick(() => {
      dialogRef.value?.focus()
      titleInput.value?.focus()
    })
  }
})

function close(): void {
  // Посеред збереження вікно не закриваємо: результат (успіх чи причина) — тут.
  if (isSaving.value) return
  emit('update:modelValue', false)
}

async function save(): Promise<void> {
  const trimmed = title.value.trim()
  if (!trimmed || isSaving.value) return

  isSaving.value = true
  saveError.value = null
  let saved: { id: string; title: string } | null = null

  try {
    if (props.beforeSave) {
      const refusal = await props.beforeSave()
      if (refusal) {
        saveError.value = refusal
        return
      }
    }
    const lesson = await lessonSaveApi.saveLessonFromSession({
      session_id: props.sessionId,
      title: trimmed,
    })
    saved = { id: lesson.id, title: lesson.title }
  } catch (err: unknown) {
    // Юзеру — завжди локалізоване дружнє повідомлення (НЕ сирий BE-код/англ. рядок).
    // Технічні деталі лишаємо у console для діагностики.
    saveError.value = saveErrorText(err)
    console.error('[WBSaveLessonDialog] save error:', err)
  } finally {
    if (props.beforeSave) props.afterSave?.()
    isSaving.value = false
  }
  if (saved) {
    emit('saved', saved)
    close()
  }
}

// Focus trap
function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !props.modelValue || !dialogRef.value) return
  const focusable = dialogRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
</script>

<style scoped>
.save-lesson-dialog__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.save-lesson-dialog__btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s, opacity 0.15s;
}

.save-lesson-dialog__btn--cancel {
  background: #f1f5f9;
  color: #475569;
}

.save-lesson-dialog__btn--cancel:hover {
  background: #e2e8f0;
}

/* Акцент застосунку (зелений), а не сторонній синій #0066FF —
   FIRST USER GATE 2026-09-23: єдина синя кнопка на шляху новачка. */
.save-lesson-dialog__btn--save {
  background: var(--accent, #047857);
  color: var(--accent-contrast, #ffffff);
}

.save-lesson-dialog__btn--save:hover {
  background: var(--accent-hover, #065f46);
}

.save-lesson-dialog__btn--save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .save-lesson-dialog {
    border-radius: 0;
    max-width: none;
    margin: 0;
    min-height: 100vh;
    min-height: 100dvh;
  }
  .save-lesson-overlay {
    align-items: stretch;
  }
}
</style>
