<template>
  <!-- Вкладка «Відео» в «Матеріалах» (ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11 §1 п.4, §6).
       Архівувати ≠ видалити: архів — без строку, повертається «Повернути до моїх
       відео»; видалити — той самий кошик, що для файлів (вкладка «Архів», 90 днів).
       Картки на дошках і в записах жодна дія не чіпає. -->
  <section class="wb-lib-videos" data-testid="library-videos">
    <div class="wb-lib-videos__bar">
      <div class="wb-lib-videos__filters" role="tablist" :aria-label="t('winterboard.library.videos.tab')">
        <button
          type="button"
          role="tab"
          class="wb-lib-videos__chip"
          :class="{ 'wb-lib-videos__chip--active': !showArchive }"
          :aria-selected="!showArchive"
          data-testid="videos-filter-mine"
          @click="setArchive(false)"
        >{{ t('winterboard.library.videos.mine') }}</button>
        <button
          type="button"
          role="tab"
          class="wb-lib-videos__chip"
          :class="{ 'wb-lib-videos__chip--active': showArchive }"
          :aria-selected="showArchive"
          data-testid="videos-filter-archive"
          @click="setArchive(true)"
        >{{ t('winterboard.library.videos.archive') }}</button>
      </div>

      <form v-if="!showArchive" class="wb-lib-videos__add" @submit.prevent="addByLink">
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
    </div>

    <p class="wb-lib-videos__hint">
      {{ showArchive ? t('winterboard.library.videos.archiveHint') : t('winterboard.library.videos.insertHint') }}
    </p>

    <p v-if="loading" class="wb-lib-videos__empty" aria-busy="true">…</p>
    <p v-else-if="loadError" class="wb-lib-videos__empty" role="status">{{ loadError }}</p>
    <p v-else-if="!videos.length" class="wb-lib-videos__empty" data-testid="videos-empty">
      {{ showArchive ? t('winterboard.library.videos.archiveEmpty') : t('winterboard.library.videos.empty') }}
    </p>
    <ul v-else class="wb-lib-videos__list" data-testid="videos-list">
      <li v-for="v in videos" :key="v.id" :data-testid="`video-${v.id}`">
        <VideoListRow :title="v.name" :thumbnail="v.thumbnail_url">
          <template #actions>
            <button
              v-if="!showArchive"
              type="button"
              class="wb-lib-videos__btn"
              :disabled="busyId === v.id"
              data-testid="video-archive"
              @click="archive(v)"
            >{{ t('winterboard.library.videos.archiveAction') }}</button>
            <button
              v-else
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
        <h3 class="wb-lib-videos__modal-title">{{ t('winterboard.library.videos.deleteConfirmTitle') }}</h3>
        <p class="wb-lib-videos__modal-text">
          {{ t('winterboard.library.videos.deleteConfirmText', { name: deleteTarget.name }) }}
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import VideoListRow from '../video/VideoListRow.vue'
import {
  addYouTubeAsset,
  archiveVideo,
  deleteAsset,
  fetchVideos,
  unarchiveVideo,
} from '../../api/library'
import type { LibraryAsset } from '../../types/library'
import { parseYouTubeVideoId } from '../../utils/youtubeParser'
import { useToast } from '../../composables/useToast'

const emit = defineEmits<{ count: [n: number] }>()

const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()

const showArchive = ref(false)
const videos = ref<LibraryAsset[]>([])
const loading = ref(false)
const loadError = ref('')
const linkValue = ref('')
const adding = ref(false)
const busyId = ref<number | null>(null)
const deleteTarget = ref<LibraryAsset | null>(null)

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const res = await fetchVideos({ archived: showArchive.value })
    videos.value = res.results ?? []
    emit('count', res.count ?? videos.value.length)
  } catch (err) {
    console.error('[WB:LibraryVideos] перелік не завантажився', err)
    videos.value = []
    loadError.value = t('winterboard.library.videos.loadError')
  } finally {
    loading.value = false
  }
}

function setArchive(v: boolean): void {
  if (showArchive.value === v) return
  showArchive.value = v
  void load()
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
    const asset = await addYouTubeAsset(url)
    linkValue.value = ''
    if (asset.status === 'archived') {
      // Архівоване само не повертається — показуємо, де воно, і як повернути.
      showToast(t('winterboard.library.videos.inArchive'), 'info')
      showArchive.value = true
      await load()
      return
    }
    if (videos.value.some((v) => v.id === asset.id)) {
      showToast(t('winterboard.library.videos.alreadyHere'), 'info')
      return
    }
    videos.value = [asset, ...videos.value]
    emit('count', videos.value.length)
    showToast(t('winterboard.library.videos.added'), 'success')
  } catch (err) {
    console.error('[WB:LibraryVideos] додавання посиланням не вдалося', err)
    showToast(t('winterboard.library.ytError'), 'error')
  } finally {
    adding.value = false
  }
}

async function archive(v: LibraryAsset): Promise<void> {
  busyId.value = v.id
  try {
    await archiveVideo(v.id)
    videos.value = videos.value.filter((x) => x.id !== v.id)
    emit('count', videos.value.length)
    showToast(t('winterboard.library.videos.archived'), 'success')
  } catch (err) {
    console.error('[WB:LibraryVideos] архівування не вдалося', err)
    showToast(t('winterboard.library.videos.actionError'), 'error')
  } finally {
    busyId.value = null
  }
}

async function unarchive(v: LibraryAsset): Promise<void> {
  busyId.value = v.id
  try {
    await unarchiveVideo(v.id)
    videos.value = videos.value.filter((x) => x.id !== v.id)
    emit('count', videos.value.length)
    showToast(t('winterboard.library.videos.unarchived'), 'success')
  } catch (err) {
    console.error('[WB:LibraryVideos] повернення з архіву не вдалося', err)
    showToast(t('winterboard.library.videos.actionError'), 'error')
  } finally {
    busyId.value = null
  }
}

/** Той самий кошик, що для файлів (`DELETE /library/assets/{id}/` → 90 днів у «Архіві»). */
async function confirmDelete(): Promise<void> {
  const v = deleteTarget.value
  if (!v) return
  deleteTarget.value = null
  busyId.value = v.id
  try {
    await deleteAsset(v.id)
    videos.value = videos.value.filter((x) => x.id !== v.id)
    emit('count', videos.value.length)
    showToast(t('winterboard.library.videos.deleted'), 'success')
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
.wb-lib-videos__bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.wb-lib-videos__filters { display: flex; gap: 6px; }
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
.wb-lib-videos__add { display: flex; gap: 6px; flex: 1; min-width: 260px; max-width: 520px; }
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
.wb-lib-videos__hint { margin: 0; font-size: 0.8125rem; color: var(--wb-fg-muted, #64748b); }
.wb-lib-videos__empty { margin: 24px 0; text-align: center; color: var(--wb-fg-muted, #64748b); font-size: 0.875rem; }
.wb-lib-videos__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-width: 900px; }
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
[data-theme="dark"] .wb-lib-videos__btn,
[data-theme="dark"] .wb-lib-videos__modal { background: var(--color-surface-elevated); color: var(--color-text); border-color: var(--color-border-strong); }
[data-theme="dark"] .wb-lib-videos__btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-on-accent); }
[data-theme="dark"] .wb-lib-videos__btn--danger { color: #fca5a5; }
[data-theme="dark"] .wb-lib-videos__modal-title { color: var(--color-text); }
[data-theme="dark"] .wb-lib-videos__modal-text,
[data-theme="dark"] .wb-lib-videos__hint,
[data-theme="dark"] .wb-lib-videos__empty { color: var(--color-text-muted); }
</style>
