<!-- Phase 14 A3.1: Public Lesson Pack Page — series of lessons by tutor
     No auth required, blank layout, CDN-cacheable data.
     Ref: AGENT_A_FE_CORE.md A3.1 -->
<template>
  <div class="lesson-pack-page">
    <!-- Loading -->
    <div v-if="isLoading" class="lesson-pack-page__loading">
      <div class="lesson-pack-page__spinner" />
      <p class="lesson-pack-page__loading-text">Завантаження серії…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="lesson-pack-page__error">
      <div class="lesson-pack-page__error-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="22" stroke="#e2e8f0" stroke-width="2"/>
          <path d="M24 14v12M24 32v2" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="lesson-pack-page__error-title">{{ error.title }}</h2>
      <p class="lesson-pack-page__error-message">{{ error.message }}</p>
      <a href="/" class="lesson-pack-page__error-link">На головну</a>
    </div>

    <!-- Content -->
    <template v-else-if="pack">
      <div class="lesson-pack-page__container">
        <!-- Phase 16 INT-13: Breadcrumbs -->
        <Breadcrumbs :items="breadcrumbs" />

        <!-- Header -->
        <header class="lesson-pack-page__header">
          <div class="lesson-pack-page__meta">
            <span class="lesson-pack-page__badge">
              {{ pack.lesson_count }} {{ lessonWord(pack.lesson_count) }}
            </span>
            <span class="lesson-pack-page__author">
              <a :href="`/tutors/${pack.tutor_slug}`" class="lesson-pack-page__author-link">
                {{ pack.tutor_name }}
              </a>
            </span>
          </div>
          <h1 class="lesson-pack-page__title">{{ pack.title }}</h1>
          <p v-if="pack.description" class="lesson-pack-page__description">
            {{ pack.description }}
          </p>
        </header>

        <!-- E1: Empty pack state -->
        <section v-if="pack.items.length === 0" class="lesson-pack-page__empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="6" y="10" width="36" height="28" rx="4" stroke="#94a3b8" stroke-width="2"/>
            <path d="M6 18h36" stroke="#94a3b8" stroke-width="2"/>
            <path d="M20 28h8M24 24v8" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <p class="lesson-pack-page__empty-text">Ця серія поки що порожня. Уроки будуть додані пізніше.</p>
        </section>

        <!-- Lesson list -->
        <section v-else class="lesson-pack-page__lessons" aria-label="Уроки серії">
          <ol class="lesson-pack-page__list">
            <li
              v-for="(item, idx) in pack.items"
              :key="item.lesson.id"
              class="lesson-pack-page__item"
            >
              <a
                :href="`/lesson/${item.lesson?.tutor?.slug}/${item.lesson?.slug}`"
                class="lesson-pack-page__item-link"
              >
                <span class="lesson-pack-page__item-number">{{ idx + 1 }}</span>
                <div class="lesson-pack-page__item-thumb">
                  <img
                    v-if="item.lesson.board_thumbnail_url"
                    :src="item.lesson.board_thumbnail_url"
                    :alt="item.lesson.title"
                    class="lesson-pack-page__item-img"
                    loading="lazy"
                    @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
                  />
                  <div v-else class="lesson-pack-page__item-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#94a3b8" stroke-width="1.5"/>
                      <path d="M3 15l5-5 4 4 3-3 6 6" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
                <div class="lesson-pack-page__item-info">
                  <h3 class="lesson-pack-page__item-title">{{ item.lesson.title }}</h3>
                  <p class="lesson-pack-page__item-meta">
                    <span v-if="item.lesson.subject_tag" class="lesson-pack-page__item-subject">
                      {{ item.lesson.subject_tag }}
                    </span>
                    <span v-if="item.lesson.duration_seconds" class="lesson-pack-page__item-duration">
                      {{ formatDuration(item.lesson.duration_seconds) }}
                    </span>
                  </p>
                </div>
                <svg class="lesson-pack-page__item-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M7.5 5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
            </li>
          </ol>
        </section>

        <!-- CTA -->
        <div class="lesson-pack-page__cta">
          <a
            :href="`/tutors/${pack.tutor_slug}`"
            class="lesson-pack-page__cta-btn"
          >
            Записатися до {{ pack.tutor_name }}
          </a>
        </div>

        <!-- Phase 16 INT-28: Share buttons -->
        <ShareButtons
          :url="`/knowledge/packs/${tutorSlug}/${packSlug}`"
          :title="pack.title"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { templateApi, type LessonPackDetail } from '../api/templateApi'
import Breadcrumbs from '@/ui/Breadcrumbs.vue'
import ShareButtons from '../components/ShareButtons.vue'

const route = useRoute()
const { t } = useI18n()

const isLoading = ref(true)
const error = ref<{ title: string; message: string } | null>(null)
const pack = ref<LessonPackDetail | null>(null)

const tutorSlug = computed(() => route.params.tutorSlug as string)
const packSlug = computed(() => route.params.packSlug as string)

// ── Phase 16 INT-13: Breadcrumbs ─────────────────────────────────────────────
const breadcrumbs = computed(() => [
  { label: t('breadcrumb.catalog'), to: '/knowledge/catalog' },
  { label: pack.value?.tutor_name || '...', to: `/marketplace/tutors/${pack.value?.tutor_slug}` },
  { label: pack.value?.title || '...' },
])

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m} хв ${s} с` : `${m} хв`
}

function lessonWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'урок'
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'уроки'
  return 'уроків'
}

// ── SEO ──────────────────────────────────────────────────────────────────────

function updateSeoMeta(p: LessonPackDetail): void {
  document.title = `${p.title} — серія уроків від ${p.tutor_name} | M4SH`

  setMeta('description', `Серія "${p.title}" від ${p.tutor_name} — ${p.lesson_count} ${lessonWord(p.lesson_count)}`)
  setMetaProperty('og:title', p.title)
  setMetaProperty('og:description', `Серія уроків від ${p.tutor_name}`)
  setMetaProperty('og:type', 'website')

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = `${window.location.origin}/pack/${p.tutor_slug}/${p.slug}`
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

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!tutorSlug.value || !packSlug.value) {
    error.value = { title: 'Серію не знайдено', message: 'Невірне посилання на серію.' }
    isLoading.value = false
    return
  }

  try {
    const data = await templateApi.getPublicPack(tutorSlug.value, packSlug.value)
    pack.value = data
    updateSeoMeta(data)
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 404) {
      error.value = { title: 'Серію не знайдено', message: 'Ця серія уроків не існує або була видалена.' }
    } else {
      error.value = { title: 'Помилка завантаження', message: 'Не вдалося завантажити серію. Спробуйте пізніше.' }
    }
    console.error('[LessonPackPage] Failed to load pack:', err)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.lesson-pack-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: #ffffff;
}

.lesson-pack-page__container {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

/* ── Loading ───────────────────────────────────────────────────── */
.lesson-pack-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
}

.lesson-pack-page__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: pack-spin 0.7s linear infinite;
}

@keyframes pack-spin {
  to { transform: rotate(360deg); }
}

.lesson-pack-page__loading-text {
  font-size: 14px;
  color: #94a3b8;
}

/* ── Error ──────────────────────────────────────────────────────── */
.lesson-pack-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
  text-align: center;
  padding: 2rem;
}

.lesson-pack-page__error-icon { margin-bottom: 8px; }

.lesson-pack-page__error-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.lesson-pack-page__error-message {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.lesson-pack-page__error-link {
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

.lesson-pack-page__error-link:hover { background: #4f46e5; }

/* ── Header ────────────────────────────────────────────────────── */
.lesson-pack-page__header {
  margin-bottom: 32px;
}

.lesson-pack-page__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.lesson-pack-page__badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background: #ede9fe;
  color: #6d28d9;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.lesson-pack-page__author {
  font-size: 14px;
  color: #64748b;
}

.lesson-pack-page__author-link {
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
}

.lesson-pack-page__author-link:hover {
  text-decoration: underline;
}

.lesson-pack-page__title {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 8px;
  line-height: 1.2;
}

.lesson-pack-page__description {
  font-size: 15px;
  color: #475569;
  line-height: 1.6;
  margin: 0;
}

/* ── Empty pack ────────────────────────────────────────────────── */
.lesson-pack-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  text-align: center;
}

.lesson-pack-page__empty-text {
  font-size: 15px;
  color: #64748b;
  margin: 0;
  max-width: 360px;
  line-height: 1.5;
}

/* ── Lesson list ───────────────────────────────────────────────── */
.lesson-pack-page__lessons {
  margin-bottom: 32px;
}

.lesson-pack-page__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lesson-pack-page__item {
  border-radius: 12px;
  overflow: hidden;
}

.lesson-pack-page__item-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s, border-color 0.15s;
}

.lesson-pack-page__item-link:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.lesson-pack-page__item-number {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 13px;
  font-weight: 700;
  border-radius: 8px;
}

.lesson-pack-page__item-thumb {
  flex-shrink: 0;
  width: 64px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lesson-pack-page__item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lesson-pack-page__item-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.lesson-pack-page__item-info {
  flex: 1;
  min-width: 0;
}

.lesson-pack-page__item-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lesson-pack-page__item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.lesson-pack-page__item-subject {
  padding: 1px 6px;
  background: #f1f5f9;
  border-radius: 4px;
}

.lesson-pack-page__item-arrow {
  flex-shrink: 0;
  color: #94a3b8;
}

/* ── CTA ───────────────────────────────────────────────────────── */
.lesson-pack-page__cta {
  display: flex;
  justify-content: center;
}

.lesson-pack-page__cta-btn {
  display: inline-flex;
  align-items: center;
  padding: 12px 32px;
  background: #6366f1;
  color: #ffffff;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
}

.lesson-pack-page__cta-btn:hover {
  background: #4f46e5;
}

/* ── Mobile ────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .lesson-pack-page__container {
    padding: 20px 16px 48px;
  }

  .lesson-pack-page__title {
    font-size: 22px;
  }

  .lesson-pack-page__item-thumb {
    display: none;
  }

  .lesson-pack-page__item-link {
    padding: 12px;
    gap: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lesson-pack-page__spinner {
    animation: none;
  }
}
</style>
