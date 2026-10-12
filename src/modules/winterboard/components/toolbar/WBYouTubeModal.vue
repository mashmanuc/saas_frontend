<template>
  <Teleport to="body">
    <Transition name="wb-modal">
      <div
        v-if="visible"
        class="wb-youtube-modal__backdrop"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div
          class="wb-youtube-modal"
          :class="{ 'wb-youtube-modal--library': library }"
          role="dialog"
          :aria-label="t('winterboard.youtube.modalTitle')"
          aria-modal="true"
          data-testid="wb-youtube-modal"
        >
          <!-- Header -->
          <div class="wb-youtube-modal__header">
            <h3 class="wb-youtube-modal__title">{{ t('winterboard.youtube.modalTitle') }}</h3>
            <button
              type="button"
              class="wb-youtube-modal__close"
              :aria-label="t('winterboard.youtube.close')"
              @click="$emit('close')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11: «Мої відео» + пошук, як у
               пульті (LAW §9 v1.8, рядок «Ноутбук дошки — теж»). Лише з `library`. -->
          <template v-if="library">
            <!-- Підтвердження вибраного — як у пульті: дошка до «Додати» не змінюється -->
            <div v-if="pick" class="wb-youtube-modal__confirm" data-testid="yt-pick-confirm">
              <VideoListRow
                :title="pick.title"
                :thumbnail="pick.thumbnail"
                :channel="pick.channel"
                :duration-s="pick.durationS"
                :audio-language="pick.audioLanguage"
              />
              <p class="wb-youtube-modal__confirm-text">
                {{ t('winterboard.youtube.picker.confirm', { title: pick.title || t('winterboard.youtube.picker.untitled') }) }}
              </p>
              <div class="wb-youtube-modal__actions">
                <button
                  type="button"
                  class="wb-youtube-modal__btn wb-youtube-modal__btn--secondary"
                  data-testid="yt-pick-cancel"
                  @click="pick = null"
                >
                  {{ t('winterboard.youtube.picker.back') }}
                </button>
                <button
                  type="button"
                  class="wb-youtube-modal__btn wb-youtube-modal__btn--primary"
                  data-testid="yt-pick-add"
                  @click="confirmPick"
                >
                  {{ t('winterboard.youtube.picker.add') }}
                </button>
              </div>
            </div>

            <template v-else>
              <!-- «Мої відео» — угорі вікна (§1 п.2) -->
              <section class="wb-youtube-modal__section" data-testid="yt-my-videos">
                <h4 class="wb-youtube-modal__section-title">
                  {{ t('winterboard.youtube.picker.myVideos') }}
                  <span v-if="myVideos.length" class="wb-youtube-modal__count">{{ myVideos.length }}</span>
                </h4>
                <p v-if="myLoading" class="wb-youtube-modal__note">…</p>
                <p v-else-if="myError" class="wb-youtube-modal__note" role="status">{{ myError }}</p>
                <p v-else-if="!myVideos.length" class="wb-youtube-modal__note">
                  {{ t('winterboard.youtube.picker.myVideosEmpty') }}
                </p>
                <ul v-else class="wb-youtube-modal__list wb-youtube-modal__list--mine">
                  <li v-for="v in myVideos" :key="v.id">
                    <VideoListRow
                      interactive
                      :title="v.name"
                      :thumbnail="v.thumbnail_url"
                      @select="pickMyVideo(v)"
                    />
                  </li>
                </ul>
                <p class="wb-youtube-modal__hint">{{ t('winterboard.youtube.picker.myVideosOldNote') }}</p>
              </section>

              <!-- Пошук — той самий REST, що в пульті (ліміти й квота ті самі) -->
              <section class="wb-youtube-modal__section" data-testid="yt-search">
                <h4 class="wb-youtube-modal__section-title">{{ t('winterboard.youtube.picker.searchTitle') }}</h4>
                <form v-if="!searchOff" class="wb-youtube-modal__search" @submit.prevent="runSearch">
                  <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    type="search"
                    class="wb-youtube-modal__input"
                    :placeholder="t('winterboard.youtube.picker.placeholder')"
                    :aria-label="t('winterboard.youtube.picker.placeholder')"
                    autocomplete="off"
                    data-testid="yt-search-input"
                  />
                  <button
                    type="submit"
                    class="wb-youtube-modal__btn wb-youtube-modal__btn--primary"
                    :disabled="searching || !searchQuery.trim()"
                    data-testid="yt-search-submit"
                  >
                    {{ searching ? '…' : t('winterboard.youtube.picker.search') }}
                  </button>
                </form>
                <p v-else class="wb-youtube-modal__note" data-testid="yt-search-off">{{ t('winterboard.youtube.picker.searchOff') }}</p>
                <p v-if="searchMessage" class="wb-youtube-modal__note" role="status">{{ searchMessage }}</p>
                <ul v-if="results.length" class="wb-youtube-modal__list" data-testid="yt-search-results">
                  <li v-for="r in results" :key="r.ref.id">
                    <VideoListRow
                      interactive
                      :title="r.title"
                      :thumbnail="r.thumbnail"
                      :channel="r.channel"
                      :duration-s="r.duration_s"
                      :audio-language="r.audio_language"
                      @select="pickCandidate(r)"
                    />
                  </li>
                </ul>
              </section>

              <h4 class="wb-youtube-modal__section-title">{{ t('winterboard.youtube.picker.linkTitle') }}</h4>
            </template>
          </template>

          <template v-if="!library || !pick">
          <!-- URL input -->
          <div class="wb-youtube-modal__field">
            <label class="wb-youtube-modal__label" for="wb-yt-url">
              {{ t('winterboard.youtube.urlLabel') }}
            </label>
            <input
              id="wb-yt-url"
              ref="urlInputRef"
              v-model="urlValue"
              type="url"
              class="wb-youtube-modal__input"
              :placeholder="t('winterboard.youtube.urlPlaceholder')"
              autocomplete="off"
              @keydown.enter.prevent="handleSubmit"
            />
            <button
              v-if="library && canReadClipboard"
              type="button"
              class="wb-youtube-modal__btn wb-youtube-modal__btn--secondary wb-youtube-modal__paste"
              data-testid="yt-paste"
              @click="pasteLink"
            >
              {{ t('winterboard.youtube.picker.paste') }}
            </button>
            <p v-if="pasteError" class="wb-youtube-modal__note" role="status">{{ pasteError }}</p>
          </div>

          <!-- Preview -->
          <div class="wb-youtube-modal__preview">
            <img
              v-if="previewVideoId"
              :src="thumbnailUrl"
              :alt="t('winterboard.youtube.preview')"
              class="wb-youtube-modal__thumbnail"
              loading="lazy"
            />
            <div v-else class="wb-youtube-modal__placeholder">
              <svg width="40" height="40" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2" y="4" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.2"/>
                <path d="M8 8l5 3-5 3V8z" fill="currentColor"/>
              </svg>
              <span>{{ t('winterboard.youtube.previewHint') }}</span>
            </div>
          </div>

          <!-- Title input (optional) -->
          <div class="wb-youtube-modal__field">
            <label class="wb-youtube-modal__label" for="wb-yt-title">
              {{ t('winterboard.youtube.titleLabel') }}
            </label>
            <input
              id="wb-yt-title"
              v-model="titleValue"
              type="text"
              class="wb-youtube-modal__input"
              :placeholder="t('winterboard.youtube.titlePlaceholder')"
              @keydown.enter.prevent="handleSubmit"
            />
          </div>

          <!-- Actions -->
          <div class="wb-youtube-modal__actions">
            <button
              type="button"
              class="wb-youtube-modal__btn wb-youtube-modal__btn--secondary"
              @click="$emit('close')"
            >
              {{ t('winterboard.youtube.cancel') }}
            </button>
            <button
              type="button"
              class="wb-youtube-modal__btn wb-youtube-modal__btn--primary"
              :disabled="!previewVideoId"
              @click="handleSubmit"
            >
              {{ t('winterboard.youtube.add') }}
            </button>
          </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// WBYouTubeModal — modal dialog for inserting YouTube video onto the board
// Ref: DAY2_AGENT_B.md B3.2
// Zone: AGENT-B (components/toolbar/WBYouTubeModal.vue)

import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseYouTubeVideoId, getYouTubeThumbnail, videoRefToWatchUrl } from '../../utils/youtubeParser'
import VideoListRow from '../video/VideoListRow.vue'
import { winterboardApi, type VideoCandidate } from '../../api/winterboardApi'
import { fetchVideos } from '../../api/library'
import type { LibraryAsset } from '../../types/library'

// ─── Props & Emits ──────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  visible: boolean
  /**
   * «Мої відео» + пошук, як у пульті (ТЗ 2026-10-11). Вмикає лише WBSoloRoom
   * для власника дошки; без нього вікно — рівно як раніше (лише посилання).
   */
  library?: boolean
}>(), {
  library: false,
})

const emit = defineEmits<{
  close: []
  submit: [payload: { url: string; title?: string }]
}>()

const { t } = useI18n({ useScope: 'global' })

// ─── State ──────────────────────────────────────────────────────────────────

const urlValue = ref('')
const titleValue = ref('')
const urlInputRef = ref<HTMLInputElement | null>(null)

/** Обране, але ще не підтверджене — дошка до «Додати» не змінюється (як у пульті). */
interface VideoPick {
  url: string
  title: string
  thumbnail: string
  channel: string
  durationS: number | null
  audioLanguage: string
}
const pick = ref<VideoPick | null>(null)

const myVideos = ref<LibraryAsset[]>([])
const myLoading = ref(false)
const myError = ref('')

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const searching = ref(false)
const results = ref<VideoCandidate[]>([])
const searchMessage = ref('')
/** Сервер сказав, що пошук не налаштовано: на цю сесію лишаємо посилання (як у пульті) */
const searchOff = ref(false)

const canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText
const pasteError = ref('')

// ─── Computed ───────────────────────────────────────────────────────────────

const previewVideoId = computed(() => parseYouTubeVideoId(urlValue.value))
const thumbnailUrl = computed(() => previewVideoId.value ? getYouTubeThumbnail(previewVideoId.value) : '')

// ─── Auto-focus URL input when modal opens ──────────────────────────────────

watch(() => props.visible, async (v) => {
  if (v) {
    urlValue.value = ''
    titleValue.value = ''
    pick.value = null
    results.value = []
    searchMessage.value = ''
    searchQuery.value = ''
    pasteError.value = ''
    if (props.library) void loadMyVideos()
    await nextTick()
    if (props.library) searchInputRef.value?.focus()
    else urlInputRef.value?.focus()
  }
})

// ─── «Мої відео» ────────────────────────────────────────────────────────────

/** Лише свої, без архіву й кошика — фільтрує сервер. */
async function loadMyVideos(): Promise<void> {
  myLoading.value = true
  myError.value = ''
  try {
    const res = await fetchVideos()
    myVideos.value = res.results ?? []
  } catch (err) {
    console.warn('[WB:YouTubeModal] «Мої відео» не завантажились', err)
    myVideos.value = []
    myError.value = t('winterboard.youtube.picker.myVideosError')
  } finally {
    myLoading.value = false
  }
}

function pickMyVideo(v: LibraryAsset): void {
  const id = parseYouTubeVideoId(v.cdn_url)
  if (!id) {
    myError.value = t('winterboard.youtube.invalidUrl')
    return
  }
  pick.value = {
    url: v.cdn_url,
    title: v.name,
    thumbnail: v.thumbnail_url || getYouTubeThumbnail(id),
    channel: '',
    durationS: null,
    audioLanguage: '',
  }
}

// ─── Пошук — той самий REST, що в пульті ────────────────────────────────────

function errorCode(e: unknown): string {
  const err = e as { response?: { data?: { error?: unknown } }; data?: { error?: unknown }; error?: unknown }
  const raw = err?.response?.data?.error ?? err?.data?.error ?? err?.error ?? ''
  return typeof raw === 'string' ? raw : String((raw as { code?: string })?.code ?? '')
}

async function runSearch(): Promise<void> {
  const query = searchQuery.value.trim()
  if (!query || searching.value) return
  searching.value = true
  searchMessage.value = ''
  results.value = []
  try {
    const res = await winterboardApi.searchVideos(query)
    results.value = res.items ?? []
    if (!results.value.length) searchMessage.value = t('winterboard.youtube.picker.empty')
  } catch (e) {
    const code = errorCode(e)
    if (code === 'video_search_disabled') searchOff.value = true
    searchMessage.value = code === 'video_search_quota'
      ? t('winterboard.youtube.picker.quota')
      : code === 'video_search_user_limit'
        ? t('winterboard.youtube.picker.userLimit')
        : code === 'video_search_disabled'
          ? ''
          : t('winterboard.youtube.picker.failed')
    console.warn('[WB:YouTubeModal] пошук відео не вдався', code || e)
  } finally {
    searching.value = false
  }
}

function pickCandidate(r: VideoCandidate): void {
  const url = videoRefToWatchUrl(r.ref)
  if (!url) {
    searchMessage.value = t('winterboard.youtube.invalidUrl')
    return
  }
  pick.value = {
    url,
    title: r.title.slice(0, 200),
    thumbnail: r.thumbnail,
    channel: r.channel,
    durationS: r.duration_s,
    audioLanguage: r.audio_language,
  }
}

/** Підтверджено — той самий `submit`, що й вставка посилання (WBSoloRoom.handleYouTubeSubmit). */
function confirmPick(): void {
  const p = pick.value
  if (!p) return
  emit('submit', { url: p.url, title: p.title || undefined })
  pick.value = null
}

/** Вставити з буфера (жест кнопки) — у поле посилання; далі той самий шлях. */
async function pasteLink(): Promise<void> {
  pasteError.value = ''
  try {
    const text = (await navigator.clipboard.readText()).trim()
    if (text) urlValue.value = text
  } catch (err) {
    console.warn('[WB:YouTubeModal] буфер не прочитано', err)
    pasteError.value = t('winterboard.youtube.picker.pasteDenied')
  }
}

// ─── Submit handler ─────────────────────────────────────────────────────────

function handleSubmit(): void {
  if (!previewVideoId.value) return
  emit('submit', {
    url: urlValue.value.trim(),
    title: titleValue.value.trim() || undefined,
  })
  urlValue.value = ''
  titleValue.value = ''
}
</script>

<style scoped>
.wb-youtube-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.wb-youtube-modal {
  width: 420px;
  max-width: calc(100vw - 32px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

.wb-youtube-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── Режим «Мої відео» + пошук (ТЗ 2026-10-11) ───────────────────────────── */
.wb-youtube-modal--library {
  width: 600px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  gap: 12px;
}
.wb-youtube-modal--library .wb-youtube-modal__preview {
  /* у широкому вікні прев'ю посилання не мусить займати пів екрана */
  max-width: 320px;
  align-self: center;
}
.wb-youtube-modal__section { display: flex; flex-direction: column; gap: 8px; }
.wb-youtube-modal__section-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
}
.wb-youtube-modal__count {
  font-weight: 500;
  font-size: 0.75rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 0 8px;
}
.wb-youtube-modal__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.wb-youtube-modal__list--mine { max-height: 230px; overflow-y: auto; }
.wb-youtube-modal__search { display: flex; gap: 8px; }
.wb-youtube-modal__search .wb-youtube-modal__input { flex: 1; min-width: 0; }
.wb-youtube-modal__note { margin: 0; font-size: 0.8125rem; color: #64748b; }
.wb-youtube-modal__hint { margin: 0; font-size: 0.75rem; color: #94a3b8; }
.wb-youtube-modal__paste { align-self: flex-start; margin-top: 4px; }
.wb-youtube-modal__confirm { display: flex; flex-direction: column; gap: 10px; }
.wb-youtube-modal__confirm-text { margin: 0; font-size: 0.9375rem; line-height: 1.35; color: #0f172a; }

.wb-youtube-modal__title {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.wb-youtube-modal__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-youtube-modal__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.wb-youtube-modal__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-youtube-modal__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
}

.wb-youtube-modal__input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #0f172a;
  background: #f8fafc;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.wb-youtube-modal__input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.wb-youtube-modal__input::placeholder {
  color: #94a3b8;
}

.wb-youtube-modal__preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #1e293b;
}

.wb-youtube-modal__thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-youtube-modal__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
}

.wb-youtube-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wb-youtube-modal__btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-youtube-modal__btn--secondary {
  background: #f1f5f9;
  color: #475569;
}

.wb-youtube-modal__btn--secondary:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.wb-youtube-modal__btn--primary {
  background: #2563eb;
  color: #ffffff;
}

.wb-youtube-modal__btn--primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.wb-youtube-modal__btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Modal transition ─────────────────────────────────────────────────────── */

.wb-modal-enter-active {
  transition: opacity 0.2s ease;
}
.wb-modal-enter-active .wb-youtube-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.wb-modal-leave-active {
  transition: opacity 0.15s ease;
}
.wb-modal-leave-active .wb-youtube-modal {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.wb-modal-enter-from {
  opacity: 0;
}
.wb-modal-enter-from .wb-youtube-modal {
  transform: scale(0.95);
  opacity: 0;
}
.wb-modal-leave-to {
  opacity: 0;
}
.wb-modal-leave-to .wb-youtube-modal {
  transform: scale(0.95);
  opacity: 0;
}
/* Темна тема (Б-156, фаза 1): біле вікно → токени; світла тема без змін */
[data-theme="dark"] .wb-youtube-modal {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
}
[data-theme="dark"] .wb-youtube-modal__title { color: var(--color-text); }
[data-theme="dark"] .wb-youtube-modal__close { color: var(--color-text-muted); }
[data-theme="dark"] .wb-youtube-modal__close:hover { background: var(--color-hover); color: var(--color-text); }
[data-theme="dark"] .wb-youtube-modal__label { color: var(--color-text-secondary); }
[data-theme="dark"] .wb-youtube-modal__input {
  border-color: var(--color-border-strong);
  color: var(--color-text);
  background: var(--color-surface-sunken);
}
[data-theme="dark"] .wb-youtube-modal__input:focus { border-color: var(--color-accent); }
[data-theme="dark"] .wb-youtube-modal__input::placeholder { color: var(--color-text-muted); }
[data-theme="dark"] .wb-youtube-modal__btn--secondary {
  background: var(--color-surface-sunken);
  color: var(--color-text-secondary);
}
[data-theme="dark"] .wb-youtube-modal__btn--secondary:hover { background: var(--color-border-strong); color: var(--color-text); }
[data-theme="dark"] .wb-youtube-modal__btn--primary { background: var(--color-accent); color: var(--color-on-accent); }
[data-theme="dark"] .wb-youtube-modal__btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
[data-theme="dark"] .wb-youtube-modal__section-title { color: var(--color-text-secondary); }
[data-theme="dark"] .wb-youtube-modal__count { color: var(--color-text-muted); background: var(--color-surface-sunken); }
[data-theme="dark"] .wb-youtube-modal__note,
[data-theme="dark"] .wb-youtube-modal__hint { color: var(--color-text-muted); }
[data-theme="dark"] .wb-youtube-modal__confirm-text { color: var(--color-text); }
</style>
