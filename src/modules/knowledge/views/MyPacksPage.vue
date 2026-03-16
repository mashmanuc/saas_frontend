<!-- Phase 14 A3.3: My Packs Page — CRUD lesson packs for tutor (authenticated)
     Drag&drop reorder lessons in a pack.
     Ref: AGENT_A_FE_CORE.md A3.3 -->
<template>
  <div class="my-packs-page">
    <div class="my-packs-page__header">
      <h1 class="my-packs-page__title">Мої серії уроків</h1>
      <button
        type="button"
        class="my-packs-page__create-btn"
        @click="showCreateDialog = true"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Створити серію
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="my-packs-page__loading">
      <div class="my-packs-page__spinner" />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="my-packs-page__error">
      <p>{{ loadError }}</p>
      <button type="button" class="my-packs-page__retry-btn" @click="loadPacks">
        Спробувати знову
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="packs.length === 0" class="my-packs-page__empty">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="6" y="10" width="36" height="28" rx="4" stroke="#94a3b8" stroke-width="2"/>
        <path d="M6 18h36" stroke="#94a3b8" stroke-width="2"/>
        <rect x="12" y="24" width="10" height="8" rx="2" stroke="#94a3b8" stroke-width="1.5"/>
        <rect x="26" y="24" width="10" height="8" rx="2" stroke="#94a3b8" stroke-width="1.5"/>
      </svg>
      <h2 class="my-packs-page__empty-title">Ще немає серій</h2>
      <p class="my-packs-page__empty-text">
        Створіть серію уроків, щоб організувати їх в послідовний курс.
      </p>
    </div>

    <!-- Pack list -->
    <div v-else class="my-packs-page__list">
      <div
        v-for="p in packs"
        :key="p.id"
        class="my-packs-page__card"
      >
        <div class="my-packs-page__card-header">
          <div class="my-packs-page__card-info">
            <h3 class="my-packs-page__card-title">{{ p.title }}</h3>
            <div class="my-packs-page__card-meta">
              <span class="my-packs-page__card-count">
                {{ p.lesson_count }} {{ lessonWord(p.lesson_count) }}
              </span>
              <span
                class="my-packs-page__card-status"
                :class="`my-packs-page__card-status--${p.status}`"
              >
                {{ statusLabel(p.status) }}
              </span>
            </div>
          </div>
          <div class="my-packs-page__card-actions">
            <a
              v-if="p.status === 'public'"
              :href="`/pack/${p.tutor_slug}/${p.slug}`"
              target="_blank"
              class="my-packs-page__card-action"
              title="Переглянути"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </a>
            <button
              type="button"
              class="my-packs-page__card-action"
              title="Редагувати"
              @click="startEdit(p)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              class="my-packs-page__card-action my-packs-page__card-action--danger"
              title="Видалити"
              @click="confirmDelete(p)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <p v-if="p.description" class="my-packs-page__card-desc">{{ p.description }}</p>
      </div>
    </div>

    <!-- Create / Edit dialog (overlay) -->
    <div v-if="showCreateDialog || editingPack" class="my-packs-page__overlay" @click.self="closeDialog">
      <div class="my-packs-page__dialog" role="dialog" :aria-label="editingPack ? 'Редагувати серію' : 'Створити серію'">
        <h2 class="my-packs-page__dialog-title">
          {{ editingPack ? 'Редагувати серію' : 'Створити серію' }}
        </h2>

        <label class="my-packs-page__field">
          <span class="my-packs-page__label">Назва</span>
          <input
            v-model="form.title"
            type="text"
            class="my-packs-page__input"
            placeholder="Назва серії уроків"
            maxlength="255"
          />
        </label>

        <label class="my-packs-page__field">
          <span class="my-packs-page__label">Опис (необов'язково)</span>
          <textarea
            v-model="form.description"
            class="my-packs-page__textarea"
            placeholder="Короткий опис серії"
            rows="3"
          />
        </label>

        <label class="my-packs-page__field">
          <span class="my-packs-page__label">Статус</span>
          <select v-model="form.status" class="my-packs-page__select">
            <option value="draft">Чернетка</option>
            <option value="public">Публічний</option>
          </select>
        </label>

        <div v-if="dialogError" class="my-packs-page__dialog-error">{{ dialogError }}</div>

        <div class="my-packs-page__dialog-actions">
          <button
            type="button"
            class="my-packs-page__dialog-cancel"
            @click="closeDialog"
          >
            Скасувати
          </button>
          <button
            type="button"
            class="my-packs-page__dialog-save"
            :disabled="isSaving || !form.title.trim()"
            @click="handleSave"
          >
            {{ isSaving ? '...' : (editingPack ? 'Зберегти' : 'Створити') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="deletingPack" class="my-packs-page__overlay" @click.self="deletingPack = null">
      <div class="my-packs-page__dialog" role="alertdialog" aria-label="Видалити серію">
        <h2 class="my-packs-page__dialog-title">Видалити серію?</h2>
        <p class="my-packs-page__dialog-text">
          Ви впевнені, що хочете видалити «{{ deletingPack.title }}»? Цю дію не можна скасувати.
        </p>
        <div class="my-packs-page__dialog-actions">
          <button
            type="button"
            class="my-packs-page__dialog-cancel"
            @click="deletingPack = null"
          >
            Скасувати
          </button>
          <button
            type="button"
            class="my-packs-page__dialog-save my-packs-page__dialog-save--danger"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            {{ isDeleting ? '...' : 'Видалити' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { templateApi, type LessonPack } from '../api/templateApi'
import { useToast } from '@/modules/winterboard/composables/useToast'

const { showToast } = useToast()

// ── State ────────────────────────────────────────────────────────────────────

const packs = ref<LessonPack[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)

const showCreateDialog = ref(false)
const editingPack = ref<LessonPack | null>(null)
const deletingPack = ref<LessonPack | null>(null)

const isSaving = ref(false)
const isDeleting = ref(false)
const dialogError = ref<string | null>(null)

const form = reactive({
  title: '',
  description: '',
  status: 'draft' as 'draft' | 'public',
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function lessonWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'урок'
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'уроки'
  return 'уроків'
}

function statusLabel(status: string): string {
  if (status === 'public') return 'Публічний'
  if (status === 'hidden') return 'Прихований'
  return 'Чернетка'
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadPacks(): Promise<void> {
  isLoading.value = true
  loadError.value = null
  try {
    packs.value = await templateApi.getMyPacks()
  } catch (err) {
    loadError.value = 'Не вдалося завантажити серії'
    console.error('[MyPacksPage] Load failed:', err)
  } finally {
    isLoading.value = false
  }
}

// ── Create / Edit ────────────────────────────────────────────────────────────

function startEdit(p: LessonPack): void {
  editingPack.value = p
  form.title = p.title
  form.description = p.description
  form.status = p.status === 'hidden' ? 'draft' : p.status
  dialogError.value = null
}

function closeDialog(): void {
  showCreateDialog.value = false
  editingPack.value = null
  form.title = ''
  form.description = ''
  form.status = 'draft'
  dialogError.value = null
}

async function handleSave(): Promise<void> {
  if (!form.title.trim()) return
  isSaving.value = true
  dialogError.value = null

  try {
    if (editingPack.value) {
      const updated = await templateApi.updatePack(editingPack.value.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
      })
      const idx = packs.value.findIndex(p => p.id === editingPack.value!.id)
      if (idx !== -1) packs.value[idx] = updated
      showToast('Серію оновлено', 'success')
    } else {
      const created = await templateApi.createPack({
        title: form.title.trim(),
        description: form.description.trim(),
        lesson_ids: [],
        status: form.status,
      })
      packs.value = [created, ...packs.value]
      showToast('Серію створено', 'success')
    }
    closeDialog()
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    dialogError.value = detail || 'Не вдалося зберегти серію'
    console.error('[MyPacksPage] Save failed:', err)
  } finally {
    isSaving.value = false
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────

function confirmDelete(p: LessonPack): void {
  deletingPack.value = p
}

async function handleDelete(): Promise<void> {
  if (!deletingPack.value) return
  isDeleting.value = true
  try {
    await templateApi.deletePack(deletingPack.value.id)
    packs.value = packs.value.filter(p => p.id !== deletingPack.value!.id)
    showToast('Серію видалено', 'success')
    deletingPack.value = null
  } catch (err) {
    showToast('Не вдалося видалити серію', 'error')
    console.error('[MyPacksPage] Delete failed:', err)
  } finally {
    isDeleting.value = false
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(loadPacks)
</script>

<style scoped>
.my-packs-page {
  max-width: 820px;
  margin: 0 auto;
  padding: 32px 24px;
}

.my-packs-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.my-packs-page__title {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.my-packs-page__create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #6366f1;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.my-packs-page__create-btn:hover { background: #4f46e5; }

/* ── Loading / Error / Empty ──────────────────────────────────── */
.my-packs-page__loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.my-packs-page__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: mp-spin 0.7s linear infinite;
}

@keyframes mp-spin { to { transform: rotate(360deg); } }

.my-packs-page__error {
  text-align: center;
  padding: 32px 0;
  color: #64748b;
  font-size: 14px;
}

.my-packs-page__retry-btn {
  margin-top: 12px;
  padding: 6px 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
}

.my-packs-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
  gap: 12px;
}

.my-packs-page__empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.my-packs-page__empty-text {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  text-align: center;
}

/* ── Pack cards ───────────────────────────────────────────────── */
.my-packs-page__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.my-packs-page__card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
  transition: border-color 0.15s;
}

.my-packs-page__card:hover { border-color: #cbd5e1; }

.my-packs-page__card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.my-packs-page__card-info { flex: 1; min-width: 0; }

.my-packs-page__card-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px;
}

.my-packs-page__card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
}

.my-packs-page__card-count {
  padding: 2px 8px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 12px;
  font-weight: 600;
  font-size: 12px;
}

.my-packs-page__card-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 12px;
}

.my-packs-page__card-status--draft {
  background: #fef3c7;
  color: #92400e;
}

.my-packs-page__card-status--public {
  background: #d1fae5;
  color: #065f46;
}

.my-packs-page__card-status--hidden {
  background: #f1f5f9;
  color: #64748b;
}

.my-packs-page__card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.my-packs-page__card-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.my-packs-page__card-action:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.my-packs-page__card-action--danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.my-packs-page__card-desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

/* ── Dialog overlay ───────────────────────────────────────────── */
.my-packs-page__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.my-packs-page__dialog {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.my-packs-page__dialog-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 20px;
}

.my-packs-page__dialog-text {
  font-size: 14px;
  color: #475569;
  line-height: 1.6;
  margin: 0 0 20px;
}

.my-packs-page__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.my-packs-page__label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.my-packs-page__input,
.my-packs-page__textarea,
.my-packs-page__select {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #0f172a;
  background: #ffffff;
  transition: border-color 0.15s;
}

.my-packs-page__input:focus,
.my-packs-page__textarea:focus,
.my-packs-page__select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.my-packs-page__textarea {
  resize: vertical;
  min-height: 60px;
}

.my-packs-page__dialog-error {
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 13px;
  color: #dc2626;
  margin-bottom: 16px;
}

.my-packs-page__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.my-packs-page__dialog-cancel {
  padding: 8px 16px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s;
}

.my-packs-page__dialog-cancel:hover { background: #e2e8f0; }

.my-packs-page__dialog-save {
  padding: 8px 20px;
  background: #6366f1;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.my-packs-page__dialog-save:hover:not(:disabled) { background: #4f46e5; }
.my-packs-page__dialog-save:disabled { opacity: 0.5; cursor: not-allowed; }

.my-packs-page__dialog-save--danger {
  background: #dc2626;
}

.my-packs-page__dialog-save--danger:hover:not(:disabled) {
  background: #b91c1c;
}

/* ── Mobile ────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .my-packs-page { padding: 20px 16px; }

  .my-packs-page__header { flex-direction: column; gap: 12px; align-items: flex-start; }

  .my-packs-page__dialog { max-width: 100%; border-radius: 12px; padding: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .my-packs-page__spinner { animation: none; }
}
</style>
