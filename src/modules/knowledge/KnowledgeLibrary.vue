<template>
  <div class="knowledge-page">
    <h1 class="knowledge-page__title">{{ $t('knowledge.title') }}</h1>

    <!-- ══════════ TWO-COLUMN LAYOUT ══════════ -->
    <div class="knowledge-page__layout">

      <!-- ──── LEFT: Students list ──── -->
      <aside class="knowledge-page__sidebar">

        <!-- Нова дошка (solo, без студента) -->
        <button class="knowledge-page__new-board-btn" @click="handleOpenNewBoard">
          🖊 {{ $t('knowledge.newBoard') }}
        </button>

        <div class="knowledge-page__sidebar-divider" />

        <h2 class="knowledge-page__sidebar-title">{{ $t('knowledge.myStudents') }}</h2>

        <div v-if="studentsLoading" class="knowledge-page__sidebar-loading">
          <div v-for="i in 3" :key="i" class="h-10 rounded bg-gray-100 animate-pulse mb-2" />
        </div>

        <div v-else-if="studentRelations.length === 0" class="knowledge-page__sidebar-empty">
          {{ $t('knowledge.noStudents') }}
        </div>

        <button
          v-for="rel in studentRelations"
          :key="rel.id"
          class="knowledge-page__student-btn"
          :class="{ 'knowledge-page__student-btn--active': selectedRelation?.id === rel.id }"
          @click="selectRelation(rel)"
        >
          <span class="knowledge-page__student-name">
            {{ rel.student?.is_demo ? $t('knowledge.sandbox') : `${rel.student?.first_name || ''} ${(rel.student?.last_name || '').charAt(0)}.` }}
          </span>
          <span v-if="rel.student?.is_demo" class="knowledge-page__demo-badge">demo</span>
        </button>

        <!-- ── МОЇ КЛАСИ (Explicit Groups) ── -->
        <div class="knowledge-page__sidebar-divider" style="margin-top: 0.75rem" />
        <h2 class="knowledge-page__sidebar-title">{{ $t('knowledge.myClasses') }}</h2>

        <div v-if="groupStore.explicitGroups.length === 0" class="knowledge-page__sidebar-empty">
          {{ $t('knowledge.noClasses') }}
        </div>

        <button
          v-for="group in groupStore.explicitGroups"
          :key="group.id"
          class="knowledge-page__student-btn"
          :class="{ 'knowledge-page__student-btn--active': selectedGroupId === group.id && !selectedRelation }"
          @click="selectExplicitGroup(group.id)"
        >
          <span class="knowledge-page__student-name">{{ group.title }}</span>
          <span class="knowledge-page__group-count">{{ group.student_count }}</span>
        </button>
      </aside>

      <!-- ──── RIGHT: Main content area ──── -->
      <main class="knowledge-page__main">

        <!-- ── Tutor Library: upload (завжди видима) ── -->
        <section class="knowledge-page__section">
          <div class="knowledge-page__section-header">
            <h3 class="knowledge-page__section-title">
              📚 {{ $t('knowledge.tutorLibrary') }}
            </h3>
            <label class="knowledge-page__upload-btn" :class="{ 'opacity-50 pointer-events-none': isUploading }">
              <input
                ref="fileInput"
                type="file"
                multiple
                accept="image/*,.pdf,audio/*,video/*,.pptx,.ppt"
                class="sr-only"
                @change="handleFileUpload"
              />
              {{ isUploading ? $t('knowledge.uploading') : $t('knowledge.uploadFiles') }}
            </label>
          </div>

          <!-- Storage quota -->
          <div v-if="storageQuota" class="knowledge-page__quota">
            <div class="knowledge-page__quota-bar">
              <div
                class="knowledge-page__quota-fill"
                :style="{ width: Math.min(storageQuota.usage_percent, 100) + '%' }"
                :class="{
                  'knowledge-page__quota-fill--warning': storageQuota.usage_percent > 80,
                  'knowledge-page__quota-fill--critical': storageQuota.usage_percent > 95,
                }"
              />
            </div>
            <span class="knowledge-page__quota-text">
              {{ formatBytes(storageQuota.used_bytes) }} / {{ formatBytes(storageQuota.total_quota_bytes) }}
            </span>
          </div>

          <!-- Upload error -->
          <div v-if="uploadError" class="knowledge-page__upload-error">
            ⚠️ {{ uploadError }}
          </div>
        </section>

        <!-- Нічого не вибрано -->
        <div v-if="!selectedRelation && !selectedGroupId" class="knowledge-page__placeholder">
          {{ $t('knowledge.selectStudent') }}
        </div>

        <template v-else>
          <!-- ── GroupMaterialsManager: матеріали групи/учня ── -->
          <GroupMaterialsManager :external-group-id="selectedGroupId" />

          <!-- ── Open Board button (тільки для учнів, не для класів) ── -->
          <section v-if="selectedRelation" class="knowledge-page__section">
            <button
              class="knowledge-page__board-btn"
              :disabled="isCreatingLesson"
              @click="handleOpenBoardForStudent"
            >
              {{ isCreatingLesson ? $t('knowledge.creatingLesson') : $t('knowledge.openBoardWithStudent') }}
            </button>
          </section>

          <!-- ── Lessons with this student (тільки для учнів) ── -->
          <section v-if="selectedRelation" class="knowledge-page__section">
            <h3 class="knowledge-page__section-title">
              {{ $t('knowledge.lessonsWithStudent') }}
              <span class="text-gray-500">({{ studentLessons.length }})</span>
            </h3>
            <div v-if="studentLessons.length === 0" class="knowledge-page__empty-materials">
              {{ $t('knowledge.noLessons') }}
            </div>
            <div v-else class="knowledge-page__lessons-list">
              <div
                v-for="lesson in studentLessons"
                :key="lesson.id"
                class="knowledge-page__lesson-item"
              >
                <div class="knowledge-page__lesson-info">
                  <span
                    class="knowledge-page__lesson-status"
                    :class="`knowledge-page__lesson-status--${lesson.status.toLowerCase()}`"
                  >{{ lesson.status }}</span>
                  <span class="knowledge-page__lesson-date">{{ formatDate(lesson.start) }}</span>
                  <span v-if="lesson.content_count" class="text-gray-400 text-xs">
                    · {{ lesson.content_count }} {{ $t('knowledge.materials') }}
                  </span>
                </div>
                <div class="knowledge-page__lesson-actions">
                  <button
                    v-if="lesson.has_board && lesson.session_uuid"
                    class="knowledge-page__action-btn"
                    @click="openBoardSession(lesson.session_uuid)"
                  >{{ $t('knowledge.openBoard') }}</button>
                  <button
                    class="knowledge-page__action-btn"
                    @click="handleClone(lesson.id)"
                  >{{ $t('lessons.history.clone') }}</button>
                  <button
                    class="knowledge-page__action-btn"
                    @click="handleSaveAsTemplate(lesson.id)"
                  >{{ $t('template.saveAsTemplate') }}</button>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Templates tab (тільки для учнів) ── -->
          <section v-if="selectedRelation && templates.length" class="knowledge-page__section">
            <h3 class="knowledge-page__section-title">
              {{ $t('knowledge.tabTemplates') }}
              <span class="text-gray-500">({{ templates.length }})</span>
            </h3>
            <div class="knowledge-page__lessons-list">
              <SavedTemplateCard
                v-for="tmpl in templates"
                :key="tmpl.id"
                :template="toSavedTemplate(tmpl)"
                @create-lesson="handleCreateFromTemplate"
                @delete="handleDeleteTemplate"
              />
            </div>
          </section>
        </template>
      </main>
    </div>

    <!-- Save As Template Modal -->
    <SaveAsTemplateModal
      v-model="showTemplateModal"
      :lesson-id="selectedLessonId"
      @saved="onTemplateSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useKnowledge } from './composables/useKnowledge'
import { useLearningGroupStore } from '@/modules/learning-content/stores/learningGroupStore'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import type { StorageQuota } from '@/modules/learning-content/api/learningContentApi'
import relationsApi from '@/api/relations'
import lessonsApi from '@/api/lessons'
import GroupMaterialsManager from '@/modules/learning-content/components/GroupMaterialsManager.vue'
import SavedTemplateCard from '@/modules/lessons/components/SavedTemplateCard.vue'
import type { SavedTemplateItem } from '@/modules/lessons/components/SavedTemplateCard.vue'
import SaveAsTemplateModal from '@/modules/lessons/components/SaveAsTemplateModal.vue'
import { lessonsTemplateApi } from '@/modules/lessons/api/lessonsTemplateApi'
import type { KnowledgeTemplate } from './api/knowledgeApi'

const { t } = useI18n()
const router = useRouter()
const groupStore = useLearningGroupStore()
const {
  lessons, templates, isLoading, error,
  reload,
} = useKnowledge()

// ── Students sidebar ────────────────────────────────────────
const studentRelations = ref<any[]>([])
const selectedRelation = ref<any | null>(null)
const studentsLoading = ref(false)

async function loadStudents() {
  studentsLoading.value = true
  try {
    const res = await relationsApi.getTutorRelations({ status: 'active' })
    const data = (res as any)
    studentRelations.value = Array.isArray(data) ? data : (data.results ?? [])
  } catch (e) {
    console.warn('[KnowledgeLibrary] Failed to load students:', e)
  } finally {
    studentsLoading.value = false
  }
}

onMounted(() => {
  loadStudents()
  groupStore.fetchGroups()
})

// ── Select student → load group + materials ─────────────────
const selectedGroupId = ref<string | null>(null)
const groupMaterials = computed(() => groupStore.materials)

async function selectRelation(rel: any) {
  // НЕ встановлюємо selectedRelation одразу — чекаємо groupId (щоб не було флікера)
  selectedRelation.value = null
  const studentId = rel.student?.id ?? rel.student_id

  // Load LearningGroups and find the implicit one containing this student
  await groupStore.fetchGroups()
  const implicitGroups = groupStore.groups.filter(
    (g: any) => g.group_type === 'IMPLICIT' && g.is_active
  )

  let foundGroupId: string | null = null

  for (const g of implicitGroups) {
    try {
      await groupStore.selectGroup(g.id)
      if (groupStore.students.includes(studentId)) {
        foundGroupId = g.id
        break
      }
    } catch { /* ignore */ }
  }

  // Fallback: if no implicit group found, use first active group
  if (!foundGroupId && groupStore.groups.length) {
    const firstActive = groupStore.groups.find((g: any) => g.is_active)
    if (firstActive) {
      foundGroupId = firstActive.id
      await groupStore.selectGroup(firstActive.id)
    }
  }

  // Встановлюємо обидва після async — без флікера GroupMaterialsManager
  selectedGroupId.value = foundGroupId
  selectedRelation.value = rel
  loadQuota()
}

// Вибір явної групи (класу) — без relation
async function selectExplicitGroup(groupId: string) {
  selectedRelation.value = null
  selectedGroupId.value = groupId
  await groupStore.selectGroup(groupId)
  loadQuota()
}

// ── File Upload ─────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)

// Ліміти відповідають бекенду (ContentItemUploadView.UPLOAD_SIZE_LIMITS_MB)
const UPLOAD_LIMITS_MB: Record<string, number> = {
  image: 10, pdf: 50, audio: 50, video: 200, presentation: 50,
}

const PRESENTATION_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
])

function getContentType(file: File): string {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (PRESENTATION_MIMES.has(file.type)) return 'presentation'
  return 'image'
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input?.files ?? [])
  if (!files.length) return

  uploadError.value = null
  isUploading.value = true
  try {
    for (const file of files) {
      const contentType = getContentType(file)
      const limitMb = UPLOAD_LIMITS_MB[contentType] ?? 10
      if (file.size > limitMb * 1024 * 1024) {
        uploadError.value = `Файл "${file.name}" завеликий. Максимум ${limitMb} MB.`
        continue
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name)
      const result: any = await learningContentApi.uploadFile(formData)
      // Прикріплюємо до групи тільки якщо студент вибраний (є groupId)
      if (result?.id && selectedGroupId.value) {
        await groupStore.addMaterial(selectedGroupId.value, result.id)
      }
    }
    if (selectedGroupId.value) {
      await groupStore.fetchMaterials(selectedGroupId.value)
    }
    loadQuota()
  } catch (e: any) {
    const errData = e?.response?.data
    if (errData?.error === 'file_too_large') {
      uploadError.value = `Файл завеликий. Максимум ${errData.limit_mb} MB (файл ${errData.actual_mb} MB).`
    } else if (errData?.error === 'unsupported_format') {
      uploadError.value = `Формат не підтримується: ${errData.mime || 'невідомий'}. Підтримуються: зображення, PDF, аудіо, відео, PPTX.`
    } else {
      uploadError.value = 'Помилка завантаження. Спробуйте ще раз.'
    }
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

// ── Remove material ─────────────────────────────────────────
async function handleRemoveMaterial(materialId: string) {
  await groupStore.removeMaterial(materialId)
}

// ── Storage quota ───────────────────────────────────────────
const storageQuota = ref<StorageQuota | null>(null)

async function loadQuota() {
  try {
    storageQuota.value = await learningContentApi.getStorageQuota()
  } catch { /* ignore */ }
}

onMounted(loadQuota)

// ── Lessons filtered by selected student ────────────────────
const studentLessons = computed(() => {
  if (!selectedRelation.value) return []
  const studentId = selectedRelation.value.student?.id ?? selectedRelation.value.student_id
  return lessons.value.filter((l: any) => l.student === studentId)
})

// ── Open Board ──────────────────────────────────────────────
const isCreatingLesson = ref(false)

// "Нова дошка" — solo session без студента (підготовка / пісочниця)
function handleOpenNewBoard() {
  router.push({
    path: '/winterboard/new',
    query: selectedGroupId.value ? { groupId: selectedGroupId.value } : {},
  })
}

async function handleOpenBoardForStudent() {
  if (!selectedRelation.value) return

  // Reuse existing DRAFT/IN_PROGRESS lesson (Правило 3: 1 DRAFT per student)
  const active = studentLessons.value.find(
    (l: any) => ['DRAFT', 'draft', 'IN_PROGRESS', 'in_progress'].includes(l.status)
  )
  if (active) {
    if (active.session_uuid) {
      // Pass groupId so sidebar shows materials on the board
      router.push({
        path: `/winterboard/${active.session_uuid}`,
        query: selectedGroupId.value ? { groupId: selectedGroupId.value } : {},
      })
    } else {
      router.push(`/winterboard/classroom/${active.id}`)
    }
    return
  }

  // No active lesson — open solo board with group materials sidebar
  router.push({
    path: '/winterboard/new',
    query: selectedGroupId.value ? { groupId: selectedGroupId.value } : {},
  })
}

function openBoardSession(sessionUuid: string) {
  router.push({
    path: `/winterboard/${sessionUuid}`,
    query: selectedGroupId.value ? { groupId: selectedGroupId.value } : {},
  })
}

// ── Clone, Template, Delete (preserved from original) ───────
async function handleClone(lessonId: number) {
  try {
    await lessonsApi.cloneLesson(lessonId)
    reload()
  } catch (e) {
    console.warn('[KnowledgeLibrary] Clone failed:', e)
  }
}

const showTemplateModal = ref(false)
const selectedLessonId = ref<number | null>(null)

function handleSaveAsTemplate(lessonId: number) {
  selectedLessonId.value = lessonId
  showTemplateModal.value = true
}

function onTemplateSaved() {
  reload()
}

function toSavedTemplate(tmpl: KnowledgeTemplate): SavedTemplateItem {
  return {
    id: tmpl.id,
    title: tmpl.title,
    content_count: tmpl.content_count,
    has_board: tmpl.has_board,
    source_lesson_id: tmpl.source_lesson_id,
    created_at: tmpl.created_at,
  }
}

function handleCreateFromTemplate(templateId: number) {
  router.push({ name: 'lesson-create', query: { template_id: String(templateId) } })
}

async function handleDeleteTemplate(templateId: number) {
  try {
    await lessonsTemplateApi.deleteTemplate(templateId)
    reload()
  } catch (e) {
    console.warn('[KnowledgeLibrary] Delete failed:', e)
  }
}

// ── Helpers ─────────────────────────────────────────────────
function formatDate(dt: string): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getTypeIcon(type: string): string {
  if (!type) return '📄'
  if (type.startsWith('image')) return '🖼️'
  if (type.includes('pdf')) return '📄'
  if (type.startsWith('audio')) return '🎵'
  if (type.startsWith('video')) return '🎬'
  return '📄'
}
</script>

<style scoped>
.knowledge-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}
.knowledge-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1.5rem;
}
.knowledge-page__layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 1.5rem;
  min-height: calc(100vh - 200px);
}
@media (max-width: 768px) {
  .knowledge-page__layout {
    grid-template-columns: 1fr;
  }
}

/* ── New Board button ── */
.knowledge-page__new-board-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  background: #10b981;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 0.75rem;
}
.knowledge-page__new-board-btn:hover {
  background: #059669;
}
.knowledge-page__sidebar-divider {
  height: 1px;
  background: #e2e8f0;
  margin-bottom: 0.75rem;
}

/* ── Sidebar ── */
.knowledge-page__sidebar {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}
.knowledge-page__sidebar-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.knowledge-page__sidebar-empty {
  font-size: 0.8125rem;
  color: #94a3b8;
  text-align: center;
  padding: 2rem 0.5rem;
}
.knowledge-page__student-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  margin-bottom: 0.25rem;
}
.knowledge-page__student-btn:hover {
  background: #e2e8f0;
}
.knowledge-page__student-btn--active {
  background: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.15);
}
.knowledge-page__student-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
}
.knowledge-page__group-count {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #e0f2fe;
  color: #0369a1;
  margin-left: auto;
}
.knowledge-page__demo-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f3e8ff;
  color: #7c3aed;
}

/* ── Main area ── */
.knowledge-page__main {
  min-width: 0;
}
.knowledge-page__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #94a3b8;
  font-size: 0.9375rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
}
.knowledge-page__section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}
.knowledge-page__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.knowledge-page__section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
}

/* ── Upload button ── */
.knowledge-page__upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #ffffff;
  background: #3b82f6;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.knowledge-page__upload-btn:hover {
  background: #2563eb;
}

/* ── Quota bar ── */
.knowledge-page__quota {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.knowledge-page__quota-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}
.knowledge-page__quota-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s;
}
.knowledge-page__quota-fill--warning {
  background: #f59e0b;
}
.knowledge-page__quota-fill--critical {
  background: #ef4444;
}
.knowledge-page__quota-text {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
}

/* ── Upload error ── */
.knowledge-page__upload-error {
  font-size: 0.8125rem;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}

/* ── Materials list ── */
.knowledge-page__empty-materials {
  text-align: center;
  color: #94a3b8;
  font-size: 0.8125rem;
  padding: 1.5rem 0;
}
.knowledge-page__materials-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.knowledge-page__material-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 6px;
  transition: background 0.1s;
}
.knowledge-page__material-item:hover {
  background: #f1f5f9;
}
.knowledge-page__material-icon {
  font-size: 1rem;
  flex-shrink: 0;
}
.knowledge-page__material-title {
  font-size: 0.8125rem;
  color: #334155;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.knowledge-page__material-remove {
  font-size: 0.75rem;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}
.knowledge-page__material-item:hover .knowledge-page__material-remove {
  opacity: 1;
}
.knowledge-page__material-remove:hover {
  color: #ef4444;
  background: #fef2f2;
}

/* ── Board button ── */
.knowledge-page__board-btn {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #ffffff;
  background: #10b981;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.knowledge-page__board-btn:hover:not(:disabled) {
  background: #059669;
}
.knowledge-page__board-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Lessons list ── */
.knowledge-page__lessons-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.knowledge-page__lesson-item {
  padding: 0.625rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.knowledge-page__lesson-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.375rem;
}
.knowledge-page__lesson-status {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.knowledge-page__lesson-status--completed { background: #dcfce7; color: #166534; }
.knowledge-page__lesson-status--in_progress { background: #dbeafe; color: #1e40af; }
.knowledge-page__lesson-status--draft { background: #f1f5f9; color: #475569; }
.knowledge-page__lesson-status--cancelled { background: #fef2f2; color: #991b1b; }
.knowledge-page__lesson-date {
  font-size: 0.75rem;
  color: #64748b;
}
.knowledge-page__lesson-actions {
  display: flex;
  gap: 0.375rem;
}
.knowledge-page__action-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.knowledge-page__action-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}
</style>
