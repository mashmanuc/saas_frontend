<template>
  <Modal
    :open="open"
    :title="$t('startLesson.title', { name: studentName })"
    size="lg"
    stacked
    @close="$emit('close')"
  >
    <div class="space-y-4" data-testid="start-lesson-dialog">
      <!-- Урок з цим учнем уже йде: повернутися в нього, а не відкривати другий -->
      <div
        v-if="running"
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent p-3"
        data-testid="start-lesson-running"
      >
        <span class="text-sm font-semibold text-body">{{ $t('startLesson.running') }}</span>
        <Button size="sm" :disabled="busy" data-testid="start-lesson-return" @click="goToRunning">
          {{ $t('startLesson.return') }}
        </Button>
      </div>

      <button
        type="button"
        class="start-lesson__new w-full rounded-xl border border-default p-3 text-left hover:border-accent disabled:opacity-60"
        :disabled="busy"
        data-testid="start-lesson-new"
        @click="start(null)"
      >
        <span class="block font-semibold text-body">
          {{ starting === NEW ? $t('startLesson.starting') : $t('startLesson.newBoard') }}
        </span>
        <span class="block text-xs text-muted">{{ $t('startLesson.newBoardHint') }}</span>
      </button>

      <div class="space-y-2">
        <p class="text-sm font-semibold text-body">{{ $t('startLesson.readyTitle') }}</p>
        <input
          v-model="query"
          type="search"
          class="w-full rounded-lg border border-default bg-transparent px-3 py-2 text-sm"
          :placeholder="$t('startLesson.searchPlaceholder')"
          data-testid="start-lesson-search"
        />

        <!-- Шлях: «Мої уроки › 9 клас › Алгебра», кожен крок — назад у ту папку -->
        <nav v-if="!searching" class="flex flex-wrap items-center gap-1 text-sm" data-testid="start-lesson-path">
          <button
            type="button"
            class="text-accent hover:underline"
            :class="{ 'font-semibold text-body': currentFolder === null }"
            data-testid="start-lesson-path-root"
            @click="openFolder(null)"
          >{{ $t('startLesson.root') }}</button>
          <template v-for="f in path" :key="f.id">
            <span class="text-muted" aria-hidden="true">›</span>
            <button
              type="button"
              class="text-accent hover:underline"
              :class="{ 'font-semibold text-body': f.id === currentFolder }"
              :data-testid="`start-lesson-path-${f.id}`"
              @click="openFolder(f.id)"
            >{{ f.name }}</button>
          </template>
        </nav>

        <p v-if="listError" class="text-sm text-danger" role="alert" data-testid="start-lesson-list-error">{{ listError }}</p>
        <ul v-else class="max-h-[45vh] overflow-y-auto rounded-xl border border-border-subtle" data-testid="start-lesson-list">
          <li v-for="f in subfolders" :key="`f-${f.id}`" class="border-b border-border-subtle last:border-b-0">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted"
              :data-testid="`start-lesson-folder-${f.id}`"
              @click="openFolder(f.id)"
            >
              <span aria-hidden="true">📁</span>
              <span class="flex-1 truncate text-sm font-medium text-body">{{ f.name }}</span>
              <span class="shrink-0 text-xs text-muted" :data-testid="`start-lesson-folder-count-${f.id}`">{{ folderCount(f) }}</span>
            </button>
          </li>
          <li v-for="l in lessons" :key="`l-${l.id}`" class="border-b border-border-subtle last:border-b-0">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted disabled:opacity-60"
              :disabled="busy"
              :data-testid="`start-lesson-item-${l.id}`"
              @click="start(l.id)"
            >
              <span aria-hidden="true">📄</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm text-body">{{ l.title }}</span>
                <span v-if="searching" class="block truncate text-xs text-muted" :data-testid="`start-lesson-item-path-${l.id}`">
                  {{ folderLabel(l.folder) }}
                </span>
              </span>
              <span class="shrink-0 text-xs text-muted">
                {{ starting === l.id ? $t('startLesson.starting') : $t('startLesson.pages', { n: l.page_count || 1 }) }}
              </span>
            </button>
          </li>
          <li v-if="loadingList" class="px-3 py-2 text-sm text-muted">{{ $t('startLesson.loading') }}</li>
          <li
            v-else-if="!subfolders.length && !lessons.length"
            class="px-3 py-3 text-sm text-muted"
            data-testid="start-lesson-empty"
          >{{ emptyText }}</li>
        </ul>
        <Button v-if="hasMore && !loadingList" variant="ghost" size="sm" data-testid="start-lesson-more" @click="loadLessons(true)">
          {{ $t('startLesson.more') }}
        </Button>
      </div>

      <p v-if="startError" class="text-sm text-danger" role="alert" data-testid="start-lesson-error">{{ startError }}</p>
    </div>
  </Modal>
</template>

<script setup lang="ts">
// «Почати урок з учнем» (власник 2026-10-15: «роби вікно вибору уроку з папками»): нова дошка або готовий урок
// з «Моїх уроків» — шлях через папки, як у «Моїх уроках», і пошук за назвою. Урок іде з учнем: живий урок,
// учню — сповіщення «Урок розпочався», він заходить зі свого розкладу. Готовий урок не змінюється — учень
// отримує копію. Не відкрився готовий урок — помилка у вікні, а не порожня дошка.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import lessonsApi from '@/api/lessons'
import { lessonSaveApi, type LessonFolder, type MyLesson } from '../api/lessonSaveApi'

const props = defineProps<{
  open: boolean
  studentId: number | null
  studentName: string
}>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const { t } = useI18n()

const NEW = 'new'
const PAGE = 50
// Урок, що «застряг» у статусі «триває» (вчитель не завершив), не пропонуємо як поточний — як на головній (2 год)
const RUNNING_GRACE_MS = 2 * 60 * 60 * 1000

const folders = ref<LessonFolder[]>([])
const currentFolder = ref<string | null>(null)
const lessons = ref<MyLesson[]>([])
const hasMore = ref(false)
const loadingList = ref(false)
const listError = ref<string | null>(null)
const query = ref('')
const running = ref<{ id: number | string } | null>(null)
const starting = ref<string | null>(null)
const startError = ref<string | null>(null)
let listToken = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

const busy = computed(() => starting.value !== null)
const searching = computed(() => query.value.trim().length > 0)
const byId = computed(() => new Map(folders.value.map((f) => [f.id, f])))

const path = computed<LessonFolder[]>(() => {
  const out: LessonFolder[] = []
  let id = currentFolder.value
  while (id) {
    const f = byId.value.get(id)
    if (!f) break
    out.unshift(f)
    id = f.parent
  }
  return out
})

const subfolders = computed(() => (searching.value ? [] : folders.value
  .filter((f) => f.parent === currentFolder.value)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))))

const emptyText = computed(() => {
  if (searching.value) return t('startLesson.notFound')
  if (currentFolder.value) return t('startLesson.folderEmpty')
  return t('startLesson.noLessons')
})

// Уроки рахуються лише прямо в папці: «9 клас» з підпапкою «Алгебра» показував би «уроків: 0»
function folderCount(f: LessonFolder): string {
  if (f.lesson_count > 0) return t('knowledge.folder.count', { n: f.lesson_count })
  const subs = folders.value.filter((x) => x.parent === f.id).length
  return subs ? t('startLesson.subfolders', { n: subs }) : t('startLesson.emptyFolder')
}

function folderLabel(folderId: string | null): string {
  const names: string[] = []
  let id = folderId
  while (id) {
    const f = byId.value.get(id)
    if (!f) break
    names.unshift(f.name)
    id = f.parent
  }
  return [t('startLesson.root'), ...names].join(' › ')
}

async function loadLessons(more = false) {
  const token = ++listToken
  loadingList.value = true
  listError.value = null
  try {
    const q = query.value.trim()
    const res = await lessonSaveApi.getMyLessonsFiltered(q
      ? { q, offset: more ? lessons.value.length : 0, limit: PAGE }
      : { folder: currentFolder.value ?? 'root', offset: more ? lessons.value.length : 0, limit: PAGE })
    if (token !== listToken) return
    lessons.value = more ? [...lessons.value, ...(res.lessons || [])] : (res.lessons || [])
    hasMore.value = Boolean(res.has_more)
  } catch (err) {
    if (token !== listToken) return
    console.error('[StartLessonDialog] Не вдалося завантажити «Мої уроки»:', err)
    listError.value = t('startLesson.loadError')
  } finally {
    if (token === listToken) loadingList.value = false
  }
}

async function loadFolders() {
  try {
    folders.value = await lessonSaveApi.getFolders()
  } catch (err) {
    console.error('[StartLessonDialog] Не вдалося завантажити папки:', err)
    listError.value = t('startLesson.loadError')
  }
}

async function loadRunning() {
  running.value = null
  if (!props.studentId) return
  try {
    const res = await lessonsApi.getActiveLessons({ status: 'IN_PROGRESS', student_id: props.studentId }, { silent: true })
    const now = Date.now()
    const live = (res?.results || []).find((l: { has_session?: boolean; end?: string }) =>
      l.has_session && (!l.end || new Date(l.end).getTime() >= now - RUNNING_GRACE_MS))
    running.value = live || null
  } catch (err) {
    // Без цього рядка вікно все одно працює: «Нова дошка» і готові уроки доступні
    console.error('[StartLessonDialog] Не вдалося перевірити урок, що триває:', err)
  }
}

function openFolder(id: string | null) {
  currentFolder.value = id
  loadLessons()
}

async function start(lessonId: string | null) {
  if (!props.studentId || busy.value) return
  starting.value = lessonId ?? NEW
  startError.value = null
  try {
    const body = await lessonsApi.quickStart(lessonId
      ? { student_id: props.studentId, source_knowledge_lesson_id: lessonId }
      : { student_id: props.studentId })
    const roomUrl = body?.room_url || (body?.lesson_id ? `/winterboard/classroom/${body.lesson_id}` : null)
    if (!roomUrl) {
      startError.value = t('dashboard.tutor.cta.createLessonError')
      return
    }
    emit('close')
    router.push(roomUrl)
  } catch (err) {
    const e = err as { response?: { data?: { detail?: string } } }
    startError.value = e?.response?.data?.detail || t('dashboard.tutor.cta.createLessonError')
  } finally {
    starting.value = null
  }
}

function goToRunning() {
  if (!running.value) return
  const id = running.value.id
  emit('close')
  router.push(`/winterboard/classroom/${id}`)
}

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadLessons(), 300)
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  currentFolder.value = null
  query.value = ''
  lessons.value = []
  startError.value = null
  listError.value = null
  loadFolders()
  loadLessons()
  loadRunning()
}, { immediate: true })
</script>
