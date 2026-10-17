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

        <!-- Папка (2026-10-17): куди в «Моїх уроках» ляже урок; поруч — створити нову, не виходячи з вікна -->
        <div class="mt-1">
          <label for="lesson-folder" class="block text-sm font-medium text-gray-700">
            {{ $t('winterboard.lesson.saveFolder.label') }}
          </label>
          <div class="mt-1 flex gap-2">
            <select
              id="lesson-folder"
              v-model="folderId"
              class="save-lesson-dialog__field flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm"
              :disabled="isSaving"
              data-testid="save-lesson-folder"
            >
              <option :value="null">{{ $t('winterboard.lesson.saveFolder.none') }}</option>
              <option v-for="o in folderOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <button
              type="button"
              class="save-lesson-dialog__btn save-lesson-dialog__btn--cancel shrink-0"
              :disabled="isSaving"
              data-testid="save-lesson-new-folder"
              @click="openNewFolder"
            >
              {{ $t('winterboard.lesson.saveFolder.newFolder') }}
            </button>
          </div>
          <p v-if="foldersError" class="mt-1 text-xs text-amber-700" data-testid="save-lesson-folders-error">{{ foldersError }}</p>

          <div v-if="newFolderOpen" class="mt-2 space-y-1" data-testid="save-lesson-new-folder-form">
            <div class="flex gap-2">
              <input
                ref="newFolderInput"
                v-model="newFolderName"
                class="save-lesson-dialog__field flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm"
                :placeholder="$t('winterboard.lesson.saveFolder.namePlaceholder')"
                maxlength="100"
                data-testid="save-lesson-new-folder-name"
                @keydown.enter.stop.prevent="createFolder"
                @keydown.escape.stop="newFolderOpen = false"
              />
              <button
                type="button"
                class="save-lesson-dialog__btn save-lesson-dialog__btn--save shrink-0"
                :disabled="!newFolderName.trim() || creatingFolder || !canCreateInside"
                data-testid="save-lesson-new-folder-create"
                @click="createFolder"
              >
                {{ creatingFolder ? $t('winterboard.lesson.saveFolder.creating') : $t('winterboard.lesson.saveFolder.create') }}
              </button>
            </div>
            <p class="text-xs text-gray-500" data-testid="save-lesson-new-folder-where">{{ newFolderWhere }}</p>
            <p v-if="newFolderError" class="text-xs text-red-600" role="alert" data-testid="save-lesson-new-folder-error">{{ newFolderError }}</p>
          </div>
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
import { lessonSaveApi, type LessonFolder } from '../api/lessonSaveApi'
import { useAuthStore } from '@/modules/auth/store/authStore'

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

// ── Папка (2026-10-17, власник: «вибір папки при збереженні» + «створення нової папки прямо в цьому вікні») ──
const MAX_FOLDER_DEPTH = 3 // як на сервері (INV-ORG-1)
const folders = ref<LessonFolder[]>([])
const folderId = ref<string | null>(null)
const foldersError = ref<string | null>(null)
const newFolderOpen = ref(false)
const newFolderName = ref('')
const newFolderInput = ref<HTMLInputElement | null>(null)
const creatingFolder = ref(false)
const newFolderError = ref<string | null>(null)

/** Папки деревом, кожна з повним шляхом: «9 клас › Алгебра». */
const folderOptions = computed(() => {
  const byParent = new Map<string | null, LessonFolder[]>()
  for (const f of folders.value) {
    const key = f.parent ?? null
    byParent.set(key, [...(byParent.get(key) || []), f])
  }
  const out: { id: string; label: string; depth: number }[] = []
  const walk = (parent: string | null, prefix: string, depth: number) => {
    const kids = (byParent.get(parent) || []).slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    for (const f of kids) {
      const label = prefix ? `${prefix} › ${f.name}` : f.name
      out.push({ id: f.id, label, depth })
      walk(f.id, label, depth + 1)
    }
  }
  walk(null, '', 1)
  return out
})
const selectedFolder = computed(() => folderOptions.value.find((o) => o.id === folderId.value) || null)
const canCreateInside = computed(() => (selectedFolder.value?.depth ?? 0) < MAX_FOLDER_DEPTH)
const newFolderWhere = computed(() => {
  if (!canCreateInside.value) return t('winterboard.lesson.saveFolder.tooDeep')
  return selectedFolder.value
    ? t('winterboard.lesson.saveFolder.inside', { path: selectedFolder.value.label })
    : t('winterboard.lesson.saveFolder.top')
})

// Остання обрана папка — зручність одного вчителя в цьому браузері (серія уроків в одну папку).
// Сховище браузера може бути вимкнене (приватне вікно) — тоді просто без запам'ятовування.
function lastFolderKey(): string | null {
  try {
    const id = useAuthStore().user?.id
    return id ? `m4sh.saveLesson.lastFolder.${id}` : null
  } catch {
    return null // поза застосунком (без сховища стану) — без запам'ятовування
  }
}
function readLastFolder(): string | null {
  const key = lastFolderKey()
  if (!key) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // сховище браузера недоступне — без запам'ятовування
  }
}
function rememberFolder(id: string | null): void {
  const key = lastFolderKey()
  if (!key) return
  try {
    if (id) window.localStorage.setItem(key, id)
    else window.localStorage.removeItem(key)
  } catch (err) {
    console.warn('[WBSaveLessonDialog] не вдалося запам\'ятати папку:', err)
  }
}

async function loadFolders(): Promise<void> {
  foldersError.value = null
  try {
    folders.value = await lessonSaveApi.getFolders()
    const last = readLastFolder()
    folderId.value = last && folders.value.some((f) => f.id === last) ? last : null
  } catch (err) {
    console.error('[WBSaveLessonDialog] не вдалося завантажити папки:', err)
    folders.value = []
    folderId.value = null
    foldersError.value = t('winterboard.lesson.saveFolder.loadError')
  }
}

function openNewFolder(): void {
  newFolderOpen.value = true
  newFolderName.value = ''
  newFolderError.value = null
  nextTick(() => newFolderInput.value?.focus())
}

async function createFolder(): Promise<void> {
  const name = newFolderName.value.trim()
  if (!name || creatingFolder.value || !canCreateInside.value) return
  creatingFolder.value = true
  newFolderError.value = null
  try {
    const folder = await lessonSaveApi.createFolder(name, folderId.value)
    folders.value = [...folders.value, folder]
    folderId.value = folder.id
    newFolderOpen.value = false
    newFolderName.value = ''
  } catch (err) {
    console.error('[WBSaveLessonDialog] не вдалося створити папку:', err)
    const e = err as { response?: { data?: { error?: unknown } } }
    newFolderError.value = /depth/i.test(String(e?.response?.data?.error ?? ''))
      ? t('winterboard.lesson.saveFolder.tooDeep')
      : t('winterboard.lesson.saveFolder.createError')
  } finally {
    creatingFolder.value = false
  }
}

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
    newFolderOpen.value = false
    loadFolders()
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
      ...(folderId.value ? { folder_id: folderId.value } : {}),
    })
    saved = { id: lesson.id, title: lesson.title }
    rememberFolder(folderId.value)
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

.save-lesson-dialog__field:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent, #047857);
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

/* Темна тема (Б-156, фаза 1): світла кнопка «Скасувати» → токени; світла тема без змін */
[data-theme="dark"] .save-lesson-dialog {
  border: 1px solid var(--color-border);
}
[data-theme="dark"] .save-lesson-dialog__btn--cancel {
  background: var(--color-surface-sunken);
  color: var(--color-text);
}
[data-theme="dark"] .save-lesson-dialog__btn--cancel:hover {
  background: var(--color-border-strong);
}
</style>
