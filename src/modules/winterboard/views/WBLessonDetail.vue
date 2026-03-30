<!-- WB: WBLessonDetail — 3 tabs: materials / boards / notes
     Ref: DAY18_AGENT-B.md B16
     API: GET /winterboard/sessions/?lesson={id} — НЕ /winterboard/boards -->
<template>
  <div class="wb-lesson-detail">
    <!-- Error state -->
    <div v-if="error" class="wb-lesson-detail__error" data-testid="lesson-detail-error">
      <p>{{ error }}</p>
      <button class="wb-lesson-detail__retry" @click="loadData">
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading" class="wb-lesson-detail__loading" data-testid="lesson-detail-loading">
      <div class="wb-skeleton-pulse wb-skeleton-title" />
      <div class="wb-skeleton-pulse wb-skeleton-line" />
      <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--short" />
    </div>

    <!-- Content -->
    <template v-else>
      <header class="wb-lesson-detail__header">
        <button
          class="wb-lesson-detail__back"
          data-testid="back-btn"
          @click="router.back()"
        >
          ← {{ t('common.back') }}
        </button>
        <h1 class="wb-lesson-detail__title">
          {{ lesson?.title || lesson?.subject || lesson?.name || t('winterboard.lessons.untitled') }}
        </h1>
        <button
          class="wb-lesson-detail__start-btn"
          data-testid="start-lesson-btn"
          @click="startLesson"
        >
          ▶ {{ t('winterboard.lessons.start') }}
        </button>
      </header>

      <!-- Tabs -->
      <div class="wb-lesson-detail__tabs" role="tablist">
        <button
          v-for="tab in TABS"
          :key="tab"
          role="tab"
          class="wb-lesson-detail__tab"
          :class="{ 'wb-lesson-detail__tab--active': activeTab === tab }"
          :aria-selected="activeTab === tab"
          :data-testid="`tab-${tab}`"
          @click="activeTab = tab"
        >
          {{ t(`winterboard.lessons.${tab}`) }}
        </button>
      </div>

      <div class="wb-lesson-detail__content">
        <!-- Materials tab -->
        <div v-if="activeTab === 'materials'" data-testid="tab-panel-materials">
          <button
            class="wb-lesson-detail__add-btn"
            data-testid="add-material-btn"
            @click="showAddMaterial = true"
          >
            + {{ t('winterboard.lessons.addMaterial') }}
          </button>

          <div
            v-if="materials.length === 0"
            class="wb-lesson-detail__empty"
            data-testid="materials-empty"
          >
            {{ t('winterboard.lessons.noMaterials') }}
          </div>

          <div v-else class="wb-lesson-detail__materials">
            <div
              v-for="(material, idx) in materials"
              :key="material.id"
              class="wb-material-item"
              :data-testid="`material-${idx}`"
            >
              <img
                v-if="material.thumbnail_url"
                :src="material.thumbnail_url"
                :alt="material.name"
                width="48"
                height="48"
                class="wb-material-item__thumb"
              />
              <span class="wb-material-item__name">{{ material.name }}</span>
              <button
                class="wb-material-item__remove"
                @click="removeMaterial(material)"
              >✕</button>
            </div>
          </div>
        </div>

        <!-- Boards tab (sessions) -->
        <div v-else-if="activeTab === 'boards'" data-testid="tab-panel-boards">
          <div v-if="loadingSessions" data-testid="sessions-loading">
            <div v-for="i in 3" :key="i" class="wb-session-item wb-session-item--skeleton">
              <div class="wb-skeleton-pulse wb-skeleton-line" />
            </div>
          </div>

          <div
            v-else-if="sessions.length === 0"
            class="wb-lesson-detail__empty"
            data-testid="sessions-empty"
          >
            {{ t('winterboard.lessons.noBoards') }}
          </div>

          <div v-else class="wb-lesson-detail__sessions-grid" data-testid="sessions-grid">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="wb-session-item"
              role="button"
              tabindex="0"
              @click="openSession(session.id)"
              @keydown.enter="openSession(session.id)"
            >
              <span class="wb-session-item__name">
                {{ session.name || t('winterboard.boards.untitled') }}
              </span>
              <span class="wb-session-item__date">
                {{ formatTimeAgo(session.updated_at) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Notes tab -->
        <div v-else-if="activeTab === 'notes'" data-testid="tab-panel-notes">
          <textarea
            v-model="notes"
            class="wb-lesson-detail__notes"
            :placeholder="t('winterboard.lessons.notesPlaceholder')"
            rows="10"
            data-testid="notes-textarea"
            @blur="saveNotes"
          />
        </div>
      </div>
    </template>

    <!-- Add material modal -->
    <Teleport to="body">
      <div
        v-if="showAddMaterial"
        class="wb-modal-overlay"
        data-testid="add-material-modal"
        @click.self="showAddMaterial = false"
      >
        <div class="wb-modal">
          <h2 class="wb-modal__title">{{ t('winterboard.lessons.pickFromLibrary') }}</h2>
          <p class="wb-modal__desc">{{ t('winterboard.lessons.libraryPickerComingSoon') }}</p>
          <button class="wb-modal__btn wb-modal__btn--secondary" @click="showAddMaterial = false">
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// B16: WBLessonDetail — 3 tabs: materials / boards / notes
// Ref: DAY18_AGENT-B.md

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import lessonsApi from '@/api/lessons'
import apiClient from '@/utils/apiClient'
import { useToast } from '../composables/useToast'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { debounce } from '@/utils/debounce'

const props = defineProps<{ lessonId: string | number }>()

const { t } = useI18n()
const router = useRouter()
const { showToast } = useToast()

const authStore = useAuthStore()
const isTutor = computed(() => (authStore.user as any)?.role === 'tutor')

const TABS = computed(() =>
  isTutor.value
    ? (['materials', 'boards', 'notes'] as const)
    : (['materials', 'boards'] as const)
)
type Tab = 'materials' | 'boards' | 'notes'

// ─── State ────────────────────────────────────────────────────────────────────

const lesson = ref<any>(null)
const sessions = ref<any[]>([])
const materials = ref<{ id: number; name: string; thumbnail_url: string; content_type: string }[]>([])
const notes = ref('')
const notesUpdatedAt = ref<string | null>(null)
const activeTab = ref<Tab>('materials')
const loading = ref(false)
const loadingSessions = ref(false)
const error = ref<string | null>(null)
const showAddMaterial = ref(false)

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function loadLesson(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    lesson.value = await lessonsApi.getLessonRoom(props.lessonId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : t('winterboard.lessons.loadError')
    error.value = msg
    showToast(msg, 'error')
    console.error('[WB:LessonDetail] Failed to load lesson', err)
  } finally {
    loading.value = false
  }
}

async function loadSessions(): Promise<void> {
  loadingSessions.value = true
  try {
    // ✅ GET /v1/winterboard/sessions/?lesson={id} — НЕ /winterboard/boards
    const res = await apiClient.get('/v1/winterboard/sessions/', { params: { lesson: props.lessonId } })
    sessions.value = (res as any)?.results ?? (res as any) ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : t('winterboard.sessions.loadError')
    showToast(msg, 'error')
    console.error('[WB:LessonDetail] Failed to load sessions', err)
  } finally {
    loadingSessions.value = false
  }
}

async function loadMaterials(): Promise<void> {
  try {
    const res = await lessonsApi.getMaterials(Number(props.lessonId))
    const items = (res as any)?.results ?? (res as any) ?? []
    materials.value = items.map((m: any) => ({
      id: m.id,
      name: m.title || 'Untitled',
      thumbnail_url: m.thumbnail_url || '',
      content_type: m.content_type || '',
    }))
  } catch (err) {
    console.error('[WB:LessonDetail] loadMaterials failed', err)
  }
}

async function loadNotes(): Promise<void> {
  try {
    const res = await lessonsApi.getNotes(Number(props.lessonId))
    notes.value = (res as any)?.notes_text ?? ''
    notesUpdatedAt.value = (res as any)?.updated_at ?? null
  } catch (err: any) {
    if (err?.response?.status === 403) {
      // Student — notes tab hidden by isTutor guard
    } else {
      console.error('[WB:LessonDetail] loadNotes failed', err)
    }
  }
}

async function loadData(): Promise<void> {
  await loadLesson()
  if (!error.value) {
    await Promise.all([
      loadMaterials(),
      loadSessions(),
      isTutor.value ? loadNotes() : Promise.resolve(),
    ])
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function openSession(sessionId: string): void {
  router.push({ name: 'winterboard-solo', params: { id: sessionId } })
}

function startLesson(): void {
  router.push({ name: 'winterboard-classroom', params: { lessonId: props.lessonId } })
}

async function removeMaterial(material: { id: number }): Promise<void> {
  const prev = [...materials.value]
  materials.value = materials.value.filter((m) => m.id !== material.id)

  try {
    await lessonsApi.removeMaterial(Number(props.lessonId), material.id)
    showToast(t('winterboard.lessons.materialRemoved'), 'success')
  } catch (err) {
    materials.value = prev
    showToast(t('winterboard.lessons.materialRemoveError'), 'error')
    console.error('[WB:LessonDetail] removeMaterial failed', err)
  }
}

const saveNotesDebounced = debounce(async () => {
  try {
    const res = await lessonsApi.saveNotes(
      Number(props.lessonId),
      notes.value,
      notesUpdatedAt.value
    )
    notesUpdatedAt.value = (res as any)?.updated_at ?? notesUpdatedAt.value
  } catch (err: any) {
    if (err?.response?.status === 409) {
      const serverData = err.response.data
      showToast(t('winterboard.lessons.notesConflict'), 'warning')
      notes.value = serverData.server_notes_text ?? notes.value
      notesUpdatedAt.value = serverData.server_updated_at ?? notesUpdatedAt.value
    } else {
      showToast(t('winterboard.lessons.notesSaveError'), 'error')
    }
    console.error('[WB:LessonDetail] saveNotes failed', err)
  }
}, 1000)

function saveNotes(): void {
  saveNotesDebounced()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t('winterboard.time.justNow')
  if (mins < 60) return t('winterboard.time.minutesAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('winterboard.time.hoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  return t('winterboard.time.daysAgo', { n: days })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(loadData)
</script>

<style scoped>
.wb-lesson-detail {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.wb-lesson-detail__error {
  padding: 24px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 16px;
}

.wb-lesson-detail__retry {
  padding: 6px 14px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.wb-lesson-detail__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 0;
}

.wb-lesson-detail__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-lesson-detail__back {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--wb-brand, #0066ff);
  font-size: 14px;
  padding: 0;
  width: fit-content;
}

.wb-lesson-detail__title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--wb-fg, #0f172a);
}

.wb-lesson-detail__status {
  font-size: 12px;
  color: var(--wb-fg-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wb-lesson-detail__actions {
  display: flex;
  gap: 12px;
}

.wb-lesson-detail__open-btn {
  display: inline-flex;
  padding: 10px 20px;
  background: var(--wb-brand, #0066ff);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s;
}

.wb-lesson-detail__open-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-lesson-detail__section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--wb-fg, #0f172a);
}

.wb-lesson-detail__sessions-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-lesson-detail__sessions-empty {
  color: var(--wb-fg-secondary, #94a3b8);
  font-size: 14px;
  padding: 24px 0;
}

.wb-session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--wb-card-bg, #fff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
  outline: none;
}

.wb-session-item:hover,
.wb-session-item:focus-visible {
  border-color: var(--wb-brand, #0066ff);
}

.wb-session-item--skeleton {
  pointer-events: none;
  height: 48px;
}

.wb-session-item__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
}

.wb-session-item__date {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-skeleton-pulse {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: wb-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.wb-skeleton-title { height: 28px; width: 50%; margin-bottom: 16px; }
.wb-skeleton-line { height: 13px; width: 70%; margin-bottom: 8px; }
.wb-skeleton-line--short { width: 40%; }

@keyframes wb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 640px) {
  .wb-lesson-detail { padding: 20px 12px; }
}
</style>
