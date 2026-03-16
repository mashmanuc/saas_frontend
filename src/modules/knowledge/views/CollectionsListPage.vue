<template>
  <div class="collections-list-page">
    <div class="collections-list-page__container">
      <header class="collections-list-page__header">
        <h1 class="collections-list-page__title">Підбірки уроків</h1>
        <p class="collections-list-page__subtitle">Тематичні підбірки від тьюторів та редакції</p>
      </header>

      <div v-if="isLoading" class="collections-list-page__grid">
        <div v-for="i in 6" :key="i" class="collections-list-page__skeleton">
          <div class="collections-list-page__skeleton-bar collections-list-page__skeleton-bar--title" />
          <div class="collections-list-page__skeleton-bar" />
          <div class="collections-list-page__skeleton-bar collections-list-page__skeleton-bar--short" />
        </div>
      </div>

      <div v-else-if="error" class="collections-list-page__error">
        <p>{{ error }}</p>
        <button type="button" class="collections-list-page__retry-btn" @click="load">Спробувати знову</button>
      </div>

      <div v-else-if="collections.length === 0" class="collections-list-page__empty">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="6" y="10" width="36" height="28" rx="4" stroke="#94a3b8" stroke-width="2"/>
          <path d="M6 18h36" stroke="#94a3b8" stroke-width="2"/>
        </svg>
        <h3 class="collections-list-page__empty-title">Поки немає підбірок</h3>
        <p class="collections-list-page__empty-text">Скоро тут з'являться тематичні підбірки уроків</p>
      </div>

      <div v-else class="collections-list-page__grid">
        <a
          v-for="col in collections"
          :key="col.id"
          :href="`/knowledge/collections/${col.slug}`"
          class="collections-list-page__card"
        >
          <div class="collections-list-page__card-body">
            <h3 class="collections-list-page__card-title">{{ col.title }}</h3>
            <p v-if="col.description" class="collections-list-page__card-desc">{{ col.description }}</p>
          </div>
          <div class="collections-list-page__card-footer">
            <span class="collections-list-page__card-count">{{ col.lesson_count }} {{ lessonWord(col.lesson_count) }}</span>
            <span v-if="col.is_featured" class="collections-list-page__card-featured">&#11088; Вибрана</span>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { catalogApi, type LessonCollection } from '../api/catalogApi'

const collections = ref<LessonCollection[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

function lessonWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'урок'
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'уроки'
  return 'уроків'
}

async function load(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    collections.value = await catalogApi.getCollections()
  } catch (err) {
    error.value = 'Не вдалося завантажити підбірки'
    console.error('[CollectionsListPage] Load failed:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  document.title = 'Підбірки уроків | M4SH'
  load()
})
</script>

<style scoped>
.collections-list-page { min-height: 100vh; min-height: 100dvh; background: #fff; }
.collections-list-page__container { max-width: 960px; margin: 0 auto; padding: 32px 24px 64px; }
.collections-list-page__header { margin-bottom: 28px; }
.collections-list-page__title { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 6px; }
.collections-list-page__subtitle { font-size: 15px; color: #64748b; margin: 0; }
.collections-list-page__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.collections-list-page__card { display: flex; flex-direction: column; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s; min-height: 140px; }
.collections-list-page__card:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,.06); }
.collections-list-page__card-body { flex: 1; }
.collections-list-page__card-title { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 8px; line-height: 1.3; }
.collections-list-page__card-desc { font-size: 13px; color: #64748b; margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.collections-list-page__card-footer { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.collections-list-page__card-count { font-size: 13px; color: #6366f1; font-weight: 600; }
.collections-list-page__card-featured { font-size: 12px; color: #f59e0b; font-weight: 600; }
.collections-list-page__skeleton { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; min-height: 140px; }
.collections-list-page__skeleton-bar { height: 12px; width: 100%; background: #e2e8f0; border-radius: 4px; margin-bottom: 8px; animation: cls-pulse 1.5s ease-in-out infinite; }
.collections-list-page__skeleton-bar--title { height: 18px; width: 70%; margin-bottom: 12px; }
.collections-list-page__skeleton-bar--short { width: 40%; margin-top: 12px; }
@keyframes cls-pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
.collections-list-page__error { text-align: center; padding: 32px 0; color: #64748b; font-size: 14px; }
.collections-list-page__retry-btn { margin-top: 12px; padding: 6px 14px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #475569; cursor: pointer; }
.collections-list-page__empty { display: flex; flex-direction: column; align-items: center; padding: 48px 0; gap: 12px; text-align: center; }
.collections-list-page__empty-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
.collections-list-page__empty-text { font-size: 14px; color: #64748b; margin: 0; }
@media (max-width: 640px) { .collections-list-page__container { padding: 20px 16px 48px; } .collections-list-page__title { font-size: 22px; } .collections-list-page__grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .collections-list-page__skeleton-bar { animation: none; } }
</style>
