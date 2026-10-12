<template>
  <!-- Вкладка «Відео» в «Матеріалах» (ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11 §1 п.4, §6, §7).
       Етап 2: YouTube і власні відеофайли поруч — чипи «Усі · YouTube · Мої файли · Архів відео»
       і порядок; вибір пам'ятається в браузері (без localStorage усе працює).
       YouTube: архівувати ≠ видалити — архів без строку, повертається «Повернути до моїх відео»;
       видалити — той самий кошик, що для файлів (вкладка «Архів», 90 днів).
       Файл: лише «Видалити» — наявний шлях видалення файла (той самий кошик). Архіву для
       файлів НЕМАЄ: їхній статус `archived` — очищення скопійованого, не архів відео.
       Картки на дошках і в записах жодна дія не чіпає. -->
  <section class="wb-lib-videos" data-testid="library-videos">
    <div class="wb-lib-videos__bar">
      <div class="wb-lib-videos__filters" role="tablist" :aria-label="t('winterboard.library.videos.tab')">
        <button
          v-for="f in FILTERS"
          :key="f"
          type="button"
          role="tab"
          class="wb-lib-videos__chip"
          :class="{ 'wb-lib-videos__chip--active': filter === f }"
          :aria-selected="filter === f"
          :data-testid="`videos-filter-${f}`"
          @click="setFilter(f)"
        >{{ filterLabel(f) }}</button>
      </div>

      <label class="wb-lib-videos__sort">
        <span class="wb-lib-videos__sort-label">{{ t('winterboard.library.videos.sortLabel') }}</span>
        <select
          class="wb-lib-videos__select"
          :value="ordering"
          data-testid="videos-ordering"
          @change="onOrderingChange"
        >
          <option value="-created_at">{{ t('winterboard.library.videos.sortNewest') }}</option>
          <option value="created_at">{{ t('winterboard.library.videos.sortOldest') }}</option>
          <option value="name">{{ t('winterboard.library.videos.sortName') }}</option>
        </select>
      </label>
    </div>

    <!-- Додати посиланням — лише там, де видно YouTube (не в «Мої файли» і не в архіві) -->
    <form v-if="canAddByLink" class="wb-lib-videos__add" @submit.prevent="addByLink">
      <input
        v-model="linkValue"
        type="url"
        class="wb-lib-videos__input"
        :placeholder="t('winterboard.library.videos.linkPlaceholder')"
        :aria-label="t('winterboard.library.videos.addByLink')"
        autocomplete="off"
        data-testid="videos-link-input"
      />
      <button
        type="submit"
        class="wb-lib-videos__btn wb-lib-videos__btn--primary"
        :disabled="adding || !linkValue.trim()"
        data-testid="videos-link-add"
      >{{ adding ? '…' : t('winterboard.library.videos.addByLink') }}</button>
    </form>

    <p class="wb-lib-videos__hint" data-testid="videos-hint">{{ hintText }}</p>

    <p v-if="loading" class="wb-lib-videos__empty" aria-busy="true">…</p>
    <p v-else-if="loadError" class="wb-lib-videos__empty" role="status">{{ loadError }}</p>
    <p v-else-if="!videos.length" class="wb-lib-videos__empty" data-testid="videos-empty">{{ emptyText }}</p>
    <ul v-else class="wb-lib-videos__list" data-testid="videos-list">
      <li v-for="v in videos" :key="v.id" :data-testid="`video-${v.id}`">
        <VideoListRow :title="v.name" :thumbnail="v.poster_url || v.thumbnail_url">
          <template #meta>
            <span
              class="wb-lib-videos__badge"
              :class="isFile(v) ? 'wb-lib-videos__badge--file' : 'wb-lib-videos__badge--youtube'"
              data-testid="video-badge"
            >{{ isFile(v) ? t('winterboard.library.videos.badgeFile') : t('winterboard.library.videos.badgeYoutube') }}</span>
            <span v-if="isFile(v)" class="wb-lib-videos__size" data-testid="video-size">{{ formatBytes(v.size_bytes) }}</span>
          </template>
          <template #actions>
            <button
              v-if="filter !== 'archive' && !isFile(v)"
              type="button"
              class="wb-lib-videos__btn"
              :disabled="busyId === v.id"
              data-testid="video-archive"
              @click="archive(v)"
            >{{ t('winterboard.library.videos.archiveAction') }}</button>
            <button
              v-if="filter === 'archive' && !isFile(v)"
              type="button"
              class="wb-lib-videos__btn wb-lib-videos__btn--primary"
              :disabled="busyId === v.id"
              data-testid="video-unarchive"
              @click="unarchive(v)"
            >{{ t('winterboard.library.videos.unarchiveAction') }}</button>
            <button
              type="button"
              class="wb-lib-videos__btn wb-lib-videos__btn--danger"
              :disabled="busyId === v.id"
              data-testid="video-delete"
              @click="deleteTarget = v"
            >{{ t('winterboard.library.videos.deleteAction') }}</button>
          </template>
        </VideoListRow>
      </li>
    </ul>

    <!-- Видалення — з підтвердженням, як для файлів -->
    <div v-if="deleteTarget" class="wb-lib-videos__overlay" @click.self="deleteTarget = null">
      <div class="wb-lib-videos__modal" role="dialog" aria-modal="true" data-testid="video-delete-confirm">
        <h3 class="wb-lib-videos__modal-title">
          {{ isFile(deleteTarget)
            ? t('winterboard.library.videos.deleteFileConfirmTitle')
            : t('winterboard.library.videos.deleteConfirmTitle') }}
        </h3>
        <p class="wb-lib-videos__modal-text">
          {{ isFile(deleteTarget)
            ? t('winterboard.library.videos.deleteFileConfirmText', { name: deleteTarget.name })
            : t('winterboard.library.videos.deleteConfirmText', { name: deleteTarget.name }) }}
        </p>
        <div class="wb-lib-videos__modal-actions">
          <button type="button" class="wb-lib-videos__btn" @click="deleteTarget = null">
            {{ t('winterboard.library.cleanup.cancel') }}
          </button>
          <button
            type="button"
            class="wb-lib-videos__btn wb-lib-videos__btn--danger"
            data-testid="video-delete-yes"
            @click="confirmDelete"
          >{{ t('winterboard.library.videos.deleteAction') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import VideoListRow from '../video/VideoListRow.vue'
import {
  addYouTubeAsset,
  archiveVideo,
  deleteAsset,
  fetchLibraryVideos,
  unarchiveVideo,
} from '../../api/library'
import type {
  LibraryAsset,
  LibraryVideo,
  LibraryVideoOrdering,
  LibraryVideosQuery,
} from '../../types/library'
import { parseYouTubeVideoId } from '../../utils/youtubeParser'
import { useToast } from '../../composables/useToast'
import { formatBytes } from '@/utils/formatBytes'

/** Чипи вкладки: «Архів відео» — окремий погляд (лише YouTube), не вид джерела. */
type VideoFilter = 'all' | 'youtube' | 'file' | 'archive'

const FILTERS: readonly VideoFilter[] = ['all', 'youtube', 'file', 'archive']
const ORDERINGS: readonly LibraryVideoOrdering[] = ['-created_at', 'created_at', 'name']
const DEFAULT_FILTER: VideoFilter = 'all'
const DEFAULT_ORDERING: LibraryVideoOrdering = '-created_at'

/** Ключі пам'яті вибору в браузері (лише зручність одного вчителя на одному пристрої). */
const FILTER_KEY = 'm4sh.wb.library.videos.filter'
const ORDERING_KEY = 'm4sh.wb.library.videos.ordering'

const emit = defineEmits<{ count: [n: number] }>()

const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()

/**
 * Прочитати збережений вибір. localStorage може кидати (приватне вікно, заблоковані
 * дані сайту) або віддати чуже значення — тоді значення за замовчуванням.
 */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
  } catch (err) {
    console.warn('[WB:LibraryVideos] вибір не прочитано з браузера — беру типовий', err)
    return fallback
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (err) {
    console.warn('[WB:LibraryVideos] вибір не збережено в браузері — діє до перезавантаження', err)
  }
}

const filter = ref<VideoFilter>(readStored(FILTER_KEY, FILTERS, DEFAULT_FILTER))
const ordering = ref<LibraryVideoOrdering>(readStored(ORDERING_KEY, ORDERINGS, DEFAULT_ORDERING))
const videos = ref<LibraryVideo[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const linkValue = ref('')
const adding = ref(false)
const busyId = ref<number | null>(null)
const deleteTarget = ref<LibraryVideo | null>(null)
/** Номер останнього запиту переліку: відповідь на застарілий вибір чипа не показуємо. */
let loadSeq = 0

const canAddByLink = computed(() => filter.value === 'all' || filter.value === 'youtube')

function isFile(v: LibraryVideo): boolean {
  return v.video_kind === 'file'
}

function filterLabel(f: VideoFilter): string {
  if (f === 'all') return t('winterboard.library.videos.filterAll')
  if (f === 'youtube') return t('winterboard.library.videos.filterYoutube')
  if (f === 'file') return t('winterboard.library.videos.filterFiles')
  return t('winterboard.library.videos.archive')
}

const hintText = computed(() => {
  if (filter.value === 'archive') return t('winterboard.library.videos.archiveHint')
  if (filter.value === 'file') return t('winterboard.library.videos.filesHint')
  if (filter.value === 'youtube') return t('winterboard.library.videos.insertHint')
  return t('winterboard.library.videos.allHint')
})

const emptyText = computed(() => {
  if (filter.value === 'archive') return t('winterboard.library.videos.archiveEmpty')
  if (filter.value === 'file') return t('winterboard.library.videos.emptyFiles')
  if (filter.value === 'youtube') return t('winterboard.library.videos.empty')
  return t('winterboard.library.videos.emptyAll')
})

function currentQuery(): LibraryVideosQuery {
  // «Архів відео» — лише YouTube: у файлів архіву немає.
  if (filter.value === 'archive') return { kind: 'youtube', ordering: ordering.value, archived: 'only' }
  return { kind: filter.value, ordering: ordering.value }
}

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading.value = true
  loadError.value = ''
  try {
    const res = await fetchLibraryVideos(currentQuery())
    if (seq !== loadSeq) return
    videos.value = res.results ?? []
    total.value = res.count ?? videos.value.length
    emit('count', total.value)
  } catch (err) {
    if (seq !== loadSeq) return
    console.error('[WB:LibraryVideos] перелік не завантажився', err)
    videos.value = []
    loadError.value = t('winterboard.library.videos.loadError')
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function setFilter(f: VideoFilter): void {
  if (filter.value === f) return
  filter.value = f
  writeStored(FILTER_KEY, f)
  void load()
}

function onOrderingChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value
  if (!(ORDERINGS as readonly string[]).includes(value) || value === ordering.value) return
  ordering.value = value as LibraryVideoOrdering
  writeStored(ORDERING_KEY, value)
  void load()
}

function removeFromList(id: number): void {
  videos.value = videos.value.filter((x) => x.id !== id)
  total.value = Math.max(0, total.value - 1)
  emit('count', total.value)
}

/** Явне додавання посиланням (без `added_from`): кошик повертає, архів — ні (§6). */
async function addByLink(): Promise<void> {
  const url = linkValue.value.trim()
  if (!url || adding.value) return
  if (!parseYouTubeVideoId(url)) {
    showToast(t('winterboard.library.ytInvalidUrl'), 'error')
    return
  }
  adding.value = true
  try {
    const asset: LibraryAsset = await addYouTubeAsset(url)
    linkValue.value = ''
    if (asset.status === 'archived') {
      // Архівоване само не повертається — показуємо, де воно, і як повернути.
      // Перемикання — підказка, а не вибір учителя: у пам'ять браузера не пишемо.
      showToast(t('winterboard.library.videos.inArchive'), 'info')
      filter.value = 'archive'
      await load()
      return
    }
    if (videos.value.some((v) => v.id === asset.id)) {
      showToast(t('winterboard.library.videos.alreadyHere'), 'info')
      return
    }
    showToast(t('winterboard.library.videos.added'), 'success')
    // Перечитуємо з сервера: місце нового рядка залежить від обраного порядку.
    await load()
  } catch (err) {
    console.error('[WB:LibraryVideos] додавання посиланням не вдалося', err)
    showToast(t('winterboard.library.ytError'), 'error')
  } finally {
    adding.value = false
  }
}

async function archive(v: LibraryVideo): Promise<void> {
  busyId.value = v.id
  try {
    await archiveVideo(v.id)
    removeFromList(v.id)
    showToast(t('winterboard.library.videos.archived'), 'success')
  } catch (err) {
    console.error('[WB:LibraryVideos] архівування не вдалося', err)
    showToast(t('winterboard.library.videos.actionError'), 'error')
  } finally {
    busyId.value = null
  }
}

async function unarchive(v: LibraryVideo): Promise<void> {
  busyId.value = v.id
  try {
    await unarchiveVideo(v.id)
    removeFromList(v.id)
    showToast(t('winterboard.library.videos.unarchived'), 'success')
  } catch (err) {
    console.error('[WB:LibraryVideos] повернення з архіву не вдалося', err)
    showToast(t('winterboard.library.videos.actionError'), 'error')
  } finally {
    busyId.value = null
  }
}

/**
 * Той самий кошик, що для файлів: наявний шлях `DELETE /library/assets/{id}/` → 90 днів
 * у вкладці «Архів» «Матеріалів». Для відео й для файла — один і той самий виклик.
 */
async function confirmDelete(): Promise<void> {
  const v = deleteTarget.value
  if (!v) return
  deleteTarget.value = null
  busyId.value = v.id
  try {
    await deleteAsset(v.id)
    removeFromList(v.id)
    showToast(
      isFile(v) ? t('winterboard.library.videos.deletedFile') : t('winterboard.library.videos.deleted'),
      'success',
    )
  } catch (err) {
    console.error('[WB:LibraryVideos] видалення не вдалося', err)
    showToast(t('winterboard.library.videos.actionError'), 'error')
  } finally {
    busyId.value = null
  }
}

onMounted(() => { void load() })

defineExpose({ reload: load })
</script>

<style scoped>
.wb-lib-videos { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 16px; }
.wb-lib-videos__bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; max-width: 900px; }
.wb-lib-videos__filters { display: flex; flex-wrap: wrap; gap: 6px; }
.wb-lib-videos__chip {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--wb-border, #e2e8f0);
  background: transparent;
  color: var(--wb-fg-muted, #475569);
  font-size: 0.8125rem;
  cursor: pointer;
}
.wb-lib-videos__chip--active {
  background: var(--wb-accent-soft, #eff6ff);
  border-color: var(--wb-accent, #2563eb);
  color: var(--wb-accent, #2563eb);
  font-weight: 600;
}
.wb-lib-videos__sort { display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--wb-fg-muted, #475569); }
.wb-lib-videos__select {
  padding: 5px 8px;
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.8125rem;
  background: var(--wb-surface, #fff);
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
}
.wb-lib-videos__add { display: flex; gap: 6px; max-width: 520px; }
.wb-lib-videos__input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.875rem;
  background: var(--wb-surface, #fff);
  color: var(--wb-fg, #0f172a);
}
.wb-lib-videos__hint { margin: 0; font-size: 0.8125rem; color: var(--wb-fg-muted, #64748b); max-width: 900px; }
.wb-lib-videos__empty { margin: 24px 0; text-align: center; color: var(--wb-fg-muted, #64748b); font-size: 0.875rem; }
.wb-lib-videos__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-width: 900px; }
.wb-lib-videos__badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 6px;
  line-height: 1.5;
}
.wb-lib-videos__badge--youtube { background: #fee2e2; color: #b91c1c; }
.wb-lib-videos__badge--file { background: #ede9fe; color: #6d28d9; }
.wb-lib-videos__size { font-size: 0.75rem; color: #64748b; }
.wb-lib-videos__btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--wb-border, #e2e8f0);
  background: var(--wb-surface, #fff);
  color: var(--wb-fg, #0f172a);
  font-size: 0.8125rem;
  cursor: pointer;
  white-space: nowrap;
}
.wb-lib-videos__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.wb-lib-videos__btn--primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.wb-lib-videos__btn--danger { color: #b91c1c; border-color: #fecaca; }
.wb-lib-videos__overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.wb-lib-videos__modal {
  width: 420px;
  max-width: calc(100vw - 32px);
  background: var(--wb-surface, #fff);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
.wb-lib-videos__modal-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--wb-fg, #0f172a); }
.wb-lib-videos__modal-text { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--wb-fg-muted, #475569); }
.wb-lib-videos__modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

[data-theme="dark"] .wb-lib-videos__input,
[data-theme="dark"] .wb-lib-videos__select,
[data-theme="dark"] .wb-lib-videos__btn,
[data-theme="dark"] .wb-lib-videos__modal { background: var(--color-surface-elevated); color: var(--color-text); border-color: var(--color-border-strong); }
[data-theme="dark"] .wb-lib-videos__btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-on-accent); }
[data-theme="dark"] .wb-lib-videos__btn--danger { color: #fca5a5; }
[data-theme="dark"] .wb-lib-videos__badge--youtube { background: rgba(248, 113, 113, 0.18); color: #fca5a5; }
[data-theme="dark"] .wb-lib-videos__badge--file { background: rgba(167, 139, 250, 0.18); color: #c4b5fd; }
[data-theme="dark"] .wb-lib-videos__modal-title { color: var(--color-text); }
[data-theme="dark"] .wb-lib-videos__modal-text,
[data-theme="dark"] .wb-lib-videos__hint,
[data-theme="dark"] .wb-lib-videos__sort,
[data-theme="dark"] .wb-lib-videos__size,
[data-theme="dark"] .wb-lib-videos__empty { color: var(--color-text-muted); }
</style>
