<!-- Phase 15 A3.1: Public Collection Page — curated lesson collection
     No auth required, blank layout, CDN-cacheable data.
     Ref: AGENT_A_FE_CORE.md A3.1 -->
<template>
  <div class="collection-page">
    <!-- Loading -->
    <div v-if="isLoading" class="collection-page__loading">
      <div class="collection-page__spinner" />
      <p class="collection-page__loading-text">Завантаження підбірки…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="collection-page__error">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="22" stroke="#e2e8f0" stroke-width="2"/>
        <path d="M24 14v12M24 32v2" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <h2 class="collection-page__error-title">{{ error.title }}</h2>
      <p class="collection-page__error-message">{{ error.message }}</p>
      <a href="/knowledge/collections" class="collection-page__error-link">До підбірок</a>
    </div>

    <!-- Content -->
    <template v-else-if="collection">
      <div class="collection-page__container">
        <!-- Phase 16 INT-13: Breadcrumbs -->
        <Breadcrumbs :items="breadcrumbs" />

        <header class="collection-page__header">
          <h1 class="collection-page__title">{{ collection.title }}</h1>
          <p v-if="collection.description" class="collection-page__description">
            {{ collection.description }}
          </p>
          <span class="collection-page__badge">
            {{ collection.lesson_count }} {{ lessonWord(collection.lesson_count) }}
          </span>
        </header>

        <div v-if="collection.items.length === 0" class="collection-page__empty">
          <p>Підбірка поки порожня</p>
        </div>

        <div v-else class="collection-page__grid">
          <a
            v-for="item in collection.items"
            :key="item.lesson.id"
            :href="`/lesson/${item.lesson.tutor.slug}/${item.lesson.slug}`"
            class="collection-page__card"
          >
            <div class="collection-page__card-img-wrap">
              <img
                v-if="item.lesson.board_thumbnail_url"
                :src="item.lesson.board_thumbnail_url"
                :alt="item.lesson.title"
                class="collection-page__card-img"
                loading="lazy"
              />
              <div v-else class="collection-page__card-img-placeholder">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="22" height="22" rx="4" stroke="#94a3b8" stroke-width="1.5"/>
                  <path d="M3 18l6-6 5 5 4-4 7 7" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="collection-page__card-body">
              <h3 class="collection-page__card-title">{{ item.lesson.title }}</h3>
              <div class="collection-page__card-meta">
                <span class="collection-page__card-author">{{ item.lesson.tutor.name }}</span>
                <span v-if="item.lesson.subject_tag" class="collection-page__card-subject">
                  {{ item.lesson.subject_tag }}
                </span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { catalogApi, type LessonCollectionDetail } from '../api/catalogApi'
import Breadcrumbs from '@/ui/Breadcrumbs.vue'

const route = useRoute()
const { t } = useI18n()

const isLoading = ref(true)
const error = ref<{ title: string; message: string } | null>(null)
const collection = ref<LessonCollectionDetail | null>(null)

// ── Phase 16 INT-13: Breadcrumbs ─────────────────────────────────────────────
const breadcrumbs = computed(() => [
  { label: t('knowledge.breadcrumbs.knowledge'), to: '/knowledge' },
  { label: t('knowledge.breadcrumbs.collections'), to: '/knowledge/collections' },
  { label: collection.value?.title || '' },
])

function lessonWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'урок'
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'уроки'
  return 'уроків'
}

// ── SEO ──────────────────────────────────────────────────────────────────────

function updateSeo(col: LessonCollectionDetail): void {
  document.title = `${col.title} — підбірка уроків | M4SH`
  let el = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!el) {
    el = document.createElement('meta')
    el.name = 'description'
    document.head.appendChild(el)
  }
  el.content = col.description || `Підбірка «${col.title}» — ${col.lesson_count} ${lessonWord(col.lesson_count)}`
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  const slug = route.params.slug as string
  if (!slug) {
    error.value = { title: 'Підбірку не знайдено', message: 'Невірне посилання.' }
    isLoading.value = false
    return
  }

  try {
    const data = await catalogApi.getCollectionDetail(slug)
    collection.value = data
    updateSeo(data)
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 404) {
      error.value = { title: 'Підбірку не знайдено', message: 'Ця підбірка не існує або була видалена.' }
    } else {
      error.value = { title: 'Помилка', message: 'Не вдалося завантажити підбірку. Спробуйте пізніше.' }
    }
    console.error('[CollectionPage] Load failed:', err)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.collection-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: #ffffff;
}

.collection-page__container {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

/* ── Loading ───────────────────────────────────────────────────── */
.collection-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
}

.collection-page__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: col-spin 0.7s linear infinite;
}

@keyframes col-spin { to { transform: rotate(360deg); } }

.collection-page__loading-text {
  font-size: 14px;
  color: #94a3b8;
}

/* ── Error ──────────────────────────────────────────────────────── */
.collection-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
  text-align: center;
  padding: 2rem;
}

.collection-page__error-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.collection-page__error-message {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.collection-page__error-link {
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

.collection-page__error-link:hover { background: #4f46e5; }

/* ── Header ────────────────────────────────────────────────────── */
.collection-page__header {
  margin-bottom: 28px;
}

.collection-page__back {
  display: inline-block;
  font-size: 13px;
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
  margin-bottom: 12px;
}

.collection-page__back:hover { text-decoration: underline; }

.collection-page__title {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 8px;
  line-height: 1.2;
}

.collection-page__description {
  font-size: 15px;
  color: #475569;
  line-height: 1.6;
  margin: 0 0 12px;
}

.collection-page__badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background: #ede9fe;
  color: #6d28d9;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

/* ── Grid ──────────────────────────────────────────────────────── */
.collection-page__empty {
  text-align: center;
  padding: 32px 0;
  color: #94a3b8;
  font-size: 14px;
}

.collection-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.collection-page__card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.collection-page__card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.collection-page__card-img-wrap {
  height: 140px;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.collection-page__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.collection-page__card-img-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.collection-page__card-body {
  padding: 12px 14px 14px;
}

.collection-page__card-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 6px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-page__card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}

.collection-page__card-author {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collection-page__card-subject {
  padding: 1px 6px;
  background: #f1f5f9;
  border-radius: 4px;
  white-space: nowrap;
}

/* ── Mobile ────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .collection-page__container { padding: 20px 16px 48px; }
  .collection-page__title { font-size: 22px; }
  .collection-page__grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  .collection-page__card-img-wrap { height: 110px; }
}

@media (prefers-reduced-motion: reduce) {
  .collection-page__spinner { animation: none; }
}
</style>
