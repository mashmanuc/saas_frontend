<!-- Phase 13 A1.2: Public Lesson Page — scaffold with all public components
     A1.4: SEO meta tags via document manipulation
     A2.3: Integration with PublicBoardViewer + usePublicReplay
     A2.4: Share moment URL ?t=секунда
     Ref: AGENT_A_FE_CORE.md -->
<template>
  <div class="public-lesson-page">
    <!-- Loading -->
    <div v-if="isLoading" class="public-lesson-page__loading">
      <div class="public-lesson-page__spinner" />
      <p class="public-lesson-page__loading-text">Завантаження уроку…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="public-lesson-page__error">
      <div class="public-lesson-page__error-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="22" stroke="#e2e8f0" stroke-width="2"/>
          <path d="M24 14v12M24 32v2" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="public-lesson-page__error-title">{{ error.title }}</h2>
      <p class="public-lesson-page__error-message">{{ error.message }}</p>
      <a href="/" class="public-lesson-page__error-link">На головну</a>
    </div>

    <!-- Content -->
    <template v-else-if="lesson">
      <div class="public-lesson-page__container">
        <!-- Phase 16 INT-12: Breadcrumbs -->
        <Breadcrumbs :items="breadcrumbItems" />

        <!-- Header -->
        <PublicLessonHeader
          :title="lesson.title"
          :tutor-name="lesson.tutor.name"
          :tutor-avatar-url="lesson.tutor.avatar_url"
          :tutor-slug="lesson.tutor.slug"
          :subject-tag="lesson.subject_tag"
          :duration-seconds="lesson.duration_seconds"
          :created-at="lesson.created_at"
        />

        <!-- Rating summary -->
        <RatingSummary
          v-if="lesson.average_rating"
          :average-rating="lesson.average_rating"
          :rating-count="lesson.rating_count || 0"
          size="md"
          class="mt-2"
        />

        <!-- Board viewer -->
        <div class="public-lesson-page__board-section">
          <PublicBoardViewer
            ref="boardViewerRef"
            :board-state="boardState"
          />
        </div>

        <!-- Replay player -->
        <PublicReplayPlayer
          :current-seconds="currentSeconds"
          :total-seconds="lesson.duration_seconds"
          :is-playing="replay.isPlaying.value"
          :markers="replayMarkers"
          :speed="replay.speed.value"
          @toggle-play="handleTogglePlay"
          @seek="handleSeek"
          @speed-change="handleSpeedChange"
        />

        <!-- Two-column layout: markers + materials -->
        <div class="public-lesson-page__columns">
          <PublicMarkersList
            :markers="displayMarkers"
            :active-id="activeMarkerId"
            @seek="handleSeek"
          />
          <PublicMaterialsList :materials="materials" />
        </div>

        <!-- Rating widget -->
        <LessonRatingWidget
          :lesson-id="lesson.id"
          :tutor-slug="lesson.tutor.slug"
          :lesson-slug="lesson.slug"
          :existing-rating="lesson.user_rating || null"
          :is-authenticated="authStore.isAuthenticated"
          class="my-6"
          @rated="handleRated"
        />

        <!-- Tutor CTA -->
        <TutorCTACard
          :tutor-name="lesson.tutor.name"
          :tutor-avatar="lesson.tutor.avatar_url"
          :tutor-slug="lesson.tutor.slug"
          :lesson-slug="lesson.slug"
          :subjects="lesson.tutor.subjects"
          :rating="lesson.tutor.rating"
          :price-from="lesson.tutor.price_from"
        />

        <!-- Phase 14 A2.4: Fork button (authenticated only, public lessons) -->
        <div v-if="lesson.visibility === 'public'" class="public-lesson-page__fork-section">
          <button
            v-if="authStore.isAuthenticated"
            type="button"
            class="public-lesson-page__fork-btn"
            :disabled="isForking"
            @click="handleFork"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5 3v4a2 2 0 002 2h2a2 2 0 002-2V3M8 9v4M3 3h4M9 3h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ isForking ? '...' : 'Форкнути урок' }}
          </button>
          <a
            v-else
            :href="`/auth/login?redirect=${encodeURIComponent(route.fullPath)}`"
            class="public-lesson-page__fork-btn public-lesson-page__fork-btn--login"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5 3v4a2 2 0 002 2h2a2 2 0 002-2V3M8 9v4M3 3h4M9 3h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Увійдіть, щоб форкнути
          </a>
        </div>

        <!-- Phase 16 INT-19: Pack membership banners -->
        <div
          v-for="pack in lessonPacks"
          :key="pack.id"
          class="public-lesson-page__pack-banner"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M6 7h6M6 11h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Цей урок є частиною серії:</span>
          <router-link :to="`/pack/${pack.tutor_slug}/${pack.slug}`" class="public-lesson-page__pack-link">
            {{ pack.title }} — {{ pack.lessons_count }} уроків
          </router-link>
        </div>

        <!-- Phase 16 INT-18: More lessons by this tutor -->
        <section v-if="relatedLessons.length > 0" class="public-lesson-page__related">
          <h2 class="public-lesson-page__related-title">Ще уроки цього тьютора</h2>
          <div class="public-lesson-page__related-grid">
            <router-link
              v-for="rel in relatedLessons"
              :key="rel.id"
              :to="`/lesson/${rel.tutor_slug || lesson.tutor.slug}/${rel.slug}`"
              class="public-lesson-page__related-card"
            >
              <div v-if="rel.board_thumbnail_url" class="public-lesson-page__related-thumb">
                <img :src="rel.board_thumbnail_url" :alt="rel.title" loading="lazy" />
              </div>
              <div v-else class="public-lesson-page__related-thumb public-lesson-page__related-thumb--empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#94a3b8" stroke-width="1.5"/><path d="M8 10h8M8 14h5" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>
              </div>
              <h3 class="public-lesson-page__related-name">{{ rel.title }}</h3>
              <span v-if="rel.subject_tag" class="public-lesson-page__related-tag">{{ rel.subject_tag }}</span>
            </router-link>
          </div>
        </section>

        <!-- Share moment button -->
        <div class="public-lesson-page__share-moment">
          <button
            type="button"
            class="public-lesson-page__share-btn"
            @click="shareCurrentMoment"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M5.7 7l4.6-2M5.7 9l4.6 2" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            {{ shareCopied ? 'Скопійовано!' : 'Поділитися моментом' }}
          </button>
        </div>

        <!-- Phase 16 INT-29: Share stats -->
        <div v-if="lesson.views_count || lesson.fork_count" class="public-lesson-page__share-stats">
          <span v-if="lesson.views_count" class="public-lesson-page__stat">
            👁 {{ lesson.views_count }} {{ t('knowledge.publicLesson.views') }}
          </span>
          <span v-if="lesson.fork_count" class="public-lesson-page__stat">
            🔀 {{ lesson.fork_count }} {{ t('knowledge.publicLesson.forks') }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { publicLessonApi, type PublicLesson, type PublicMarker, type PublicMaterial, type RelatedLesson, type LessonPackInfo } from '../api/publicLessonApi'
import { usePublicReplay } from '../composables/usePublicReplay'
import { useForkLesson } from '../composables/useForkLesson'
import { useAuthStore } from '@/modules/auth/store/authStore'
import PublicLessonHeader from '@/modules/winterboard/components/public/PublicLessonHeader.vue'
import PublicReplayPlayer from '@/modules/winterboard/components/public/PublicReplayPlayer.vue'
import PublicMarkersList from '@/modules/winterboard/components/public/PublicMarkersList.vue'
import PublicMaterialsList from '@/modules/winterboard/components/public/PublicMaterialsList.vue'
import TutorCTACard from '@/modules/winterboard/components/public/TutorCTACard.vue'
import PublicBoardViewer from '../components/PublicBoardViewer.vue'
import { catalogApi } from '../api/catalogApi'
import RatingSummary from '../components/RatingSummary.vue'
import LessonRatingWidget from '../components/LessonRatingWidget.vue'
import Breadcrumbs from '@/ui/Breadcrumbs.vue'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { fork, isForking } = useForkLesson()
const { t } = useI18n()

// ── State ───────────────────────────────────────────────────────────────────
const isLoading = ref(true)
const error = ref<{ title: string; message: string } | null>(null)
const lesson = ref<PublicLesson | null>(null)
const boardState = ref<Record<string, unknown>>({})
const markers = ref<PublicMarker[]>([])
const materials = ref<PublicMaterial[]>([])
const boardViewerRef = ref<InstanceType<typeof PublicBoardViewer> | null>(null)
const shareCopied = ref(false)
const relatedLessons = ref<RelatedLesson[]>([])
const lessonPacks = ref<LessonPackInfo[]>([])

// ── Route params ────────────────────────────────────────────────────────────
const tutorSlug = computed(() => route.params.tutorSlug as string)
const lessonSlug = computed(() => route.params.lessonSlug as string)

// ── Phase 16 INT-12: Breadcrumbs ─────────────────────────────────────────────
const breadcrumbItems = computed(() => {
  const items: Array<{ label: string; to?: string }> = [
    { label: t('knowledge.breadcrumbs.catalog'), to: '/knowledge/catalog' },
  ]
  if (lesson.value?.subject_tag) {
    items.push({
      label: lesson.value.subject_tag,
      to: `/knowledge/catalog?subject=${lesson.value.subject_tag}`,
    })
  }
  items.push({ label: lesson.value?.title || '' })
  return items
})

// ── Replay (lazy — only after Play) ─────────────────────────────────────────
const replay = usePublicReplay(tutorSlug, lessonSlug)

const currentSeconds = computed(() => Math.floor(replay.currentTimeMs.value / 1000))

const activeMarkerId = computed(() => {
  if (markers.value.length === 0) return null
  const sec = currentSeconds.value
  const sorted = [...markers.value].sort((a, b) => b.time_seconds - a.time_seconds)
  return sorted.find(m => m.time_seconds <= sec)?.id ?? null
})

// Map PublicMarker[] to ReplayMarker[] shape expected by PublicReplayPlayer
const replayMarkers = computed(() =>
  markers.value.map(m => ({
    id: m.id,
    title: m.title,
    time_seconds: m.time_seconds,
  })),
)

// Map PublicMarker[] to shape expected by PublicMarkersList
const displayMarkers = computed(() =>
  markers.value.map(m => ({
    id: m.id,
    title: m.title,
    time_seconds: m.time_seconds,
    category: m.category,
  })),
)

// ── SEO (A1.4) ──────────────────────────────────────────────────────────────
function updateSeoMeta(l: PublicLesson): void {
  document.title = `${l.title} — урок з ${l.tutor.name} | M4SH`

  setMeta('description', `Перегляньте урок "${l.title}" з репетитором ${l.tutor.name}`)
  setMetaProperty('og:title', l.title)
  setMetaProperty('og:description', `Урок з ${l.tutor.name} — ${l.subject_tag}`)
  setMetaProperty('og:type', 'website')
  if (l.board_thumbnail_url) {
    setMetaProperty('og:image', l.board_thumbnail_url)
  }

  // Canonical
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = `${window.location.origin}/lesson/${l.tutor.slug}/${l.slug}`
}

function setMeta(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

function setMetaProperty(property: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.content = content
}

// ── Replay controls ─────────────────────────────────────────────────────────
async function handleTogglePlay(): Promise<void> {
  if (replay.isPlaying.value) {
    replay.pause()
  } else {
    replay.play()
  }
}

function handleSeek(seconds: number): void {
  replay.seekTo(seconds * 1000)
}

function handleSpeedChange(speed: number): void {
  replay.speed.value = speed
}

// ── Apply replay operations to board viewer ─────────────────────────────────
watch(
  () => replay.boardSnapshot.value,
  (snapshot) => {
    if (snapshot && boardViewerRef.value) {
      boardState.value = snapshot
    }
  },
)

// ── Share moment (A2.4) ─────────────────────────────────────────────────────
async function shareCurrentMoment(): Promise<void> {
  const seconds = Math.floor(replay.currentTimeMs.value / 1000)
  const url = `${window.location.origin}/lesson/${tutorSlug.value}/${lessonSlug.value}${seconds > 0 ? `?t=${seconds}` : ''}`
  try {
    await navigator.clipboard.writeText(url)
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 2000)
  } catch {
    // Fallback: select text in a temporary input
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 2000)
  }
}

// ── Rating (Phase 15 B1.4) ──────────────────────────────────────────────────
function handleRated(score: number, _comment: string): void {
  if (!lesson.value) return
  lesson.value = {
    ...lesson.value,
    user_rating: { score, comment: _comment },
    rating_count: (lesson.value.rating_count || 0) + 1,
  }
}

// ── Fork (A2.4) ────────────────────────────────────────────────────────────────
async function handleFork(): Promise<void> {
  if (!lesson.value) return
  const result = await fork(lesson.value.id)
  if (result) {
    router.push(`/lesson/${result.tutor_slug}/${result.slug}`)
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!tutorSlug.value || !lessonSlug.value) {
    error.value = { title: 'Урок не знайдено', message: 'Невірне посилання на урок.' }
    isLoading.value = false
    return
  }

  try {
    // Fetch lesson detail first
    const lessonData = await publicLessonApi.getLessonDetail(tutorSlug.value, lessonSlug.value)
    lesson.value = lessonData
    updateSeoMeta(lessonData)

    // Fetch board state, markers, materials in parallel
    const [board, markersData, materialsData] = await Promise.all([
      publicLessonApi.getBoardState(tutorSlug.value, lessonSlug.value).catch(() => ({})),
      publicLessonApi.getMarkers(tutorSlug.value, lessonSlug.value).catch(() => []),
      publicLessonApi.getMaterials(tutorSlug.value, lessonSlug.value).catch(() => []),
    ])

    boardState.value = board
    markers.value = markersData
    materials.value = materialsData

    // A2.4: If ?t= query param present, seek to that time after load
    const startTime = Number(route.query.t) || 0
    if (startTime > 0) {
      replay.seekTo(startTime * 1000)
    }

    // Phase 15 A3.4: Log view (best-effort, no error handling)
    catalogApi.logView(tutorSlug.value, lessonSlug.value, 'direct')

    // Phase 16 INT-18/INT-19: Load related lessons + pack info (non-blocking)
    publicLessonApi.getRelatedLessons(tutorSlug.value, lessonSlug.value, 3)
      .then(data => { relatedLessons.value = data })
    publicLessonApi.getLessonPacks(tutorSlug.value, lessonSlug.value)
      .then(data => { lessonPacks.value = data })
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 404) {
      error.value = { title: 'Урок не знайдено', message: 'Цей урок не існує або був видалений.' }
    } else {
      error.value = { title: 'Помилка завантаження', message: 'Не вдалося завантажити урок. Спробуйте пізніше.' }
    }
    console.error('[PublicLessonPage] Failed to load lesson:', err)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  replay.destroy()
})
</script>

<style scoped>
.public-lesson-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: #ffffff;
}

.public-lesson-page__container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px 48px;
}

/* ── Loading ───────────────────────────────────────────────────── */
.public-lesson-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
}

.public-lesson-page__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: public-spin 0.7s linear infinite;
}

@keyframes public-spin {
  to { transform: rotate(360deg); }
}

.public-lesson-page__loading-text {
  font-size: 14px;
  color: #94a3b8;
}

/* ── Error ──────────────────────────────────────────────────────── */
.public-lesson-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
  text-align: center;
  padding: 2rem;
}

.public-lesson-page__error-icon {
  margin-bottom: 8px;
}

.public-lesson-page__error-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.public-lesson-page__error-message {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.public-lesson-page__error-link {
  margin-top: 12px;
  padding: 8px 20px;
  background: #6366f1;
  color: #ffffff;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s;
}

.public-lesson-page__error-link:hover {
  background: #4f46e5;
}

/* ── Board section ──────────────────────────────────────────────── */
.public-lesson-page__board-section {
  margin: 24px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

/* ── Two columns: markers + materials ───────────────────────────── */
.public-lesson-page__columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin: 24px 0;
}

/* ── Fork section (A2.4) ───────────────────────────────────────── */
.public-lesson-page__fork-section {
  display: flex;
  justify-content: center;
  margin: 20px 0;
}

.public-lesson-page__fork-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #166534;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}

.public-lesson-page__fork-btn:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #86efac;
}

.public-lesson-page__fork-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.public-lesson-page__fork-btn--login {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #475569;
}

.public-lesson-page__fork-btn--login:hover {
  background: #e2e8f0;
}

/* ── Pack banner (INT-19) ──────────────────────────────────────── */
.public-lesson-page__pack-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  padding: 12px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  font-size: 14px;
  color: #1e40af;
}

.public-lesson-page__pack-link {
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
}

.public-lesson-page__pack-link:hover {
  text-decoration: underline;
}

/* ── Related lessons (INT-18) ─────────────────────────────────── */
.public-lesson-page__related {
  margin: 32px 0 24px;
}

.public-lesson-page__related-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 12px;
}

.public-lesson-page__related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.public-lesson-page__related-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.public-lesson-page__related-card:hover {
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.public-lesson-page__related-thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: #f8fafc;
}

.public-lesson-page__related-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.public-lesson-page__related-thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.public-lesson-page__related-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  padding: 10px 12px 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.public-lesson-page__related-tag {
  font-size: 11px;
  color: #64748b;
  padding: 0 12px 10px;
}

/* ── Share moment ───────────────────────────────────────────────── */
.public-lesson-page__share-moment {
  display: flex;
  justify-content: center;
  margin: 24px 0;
}

.public-lesson-page__share-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s;
}

.public-lesson-page__share-btn:hover {
  background: #e2e8f0;
}

/* ── Phase 16 INT-29: Share stats ──────────────────────────────── */
.public-lesson-page__share-stats {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.public-lesson-page__stat {
  font-size: 13px;
  color: #94a3b8;
}

/* ── Mobile ─────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .public-lesson-page__container {
    padding: 0 16px 32px;
  }

  .public-lesson-page__columns {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .public-lesson-page__spinner {
    animation: none;
  }
}
</style>
