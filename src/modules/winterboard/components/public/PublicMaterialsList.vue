<!-- WB: Public materials list — read-only list of lesson materials
     Ref: PHASE12_PLAN.md B4 / Phase 13 B1.4 -->
<template>
  <section class="public-materials" :aria-label="t('publicLesson.materials.title')">
    <h3 class="public-materials__title">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.3"/>
        <path d="M5 5h6M5 8h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      {{ t('publicLesson.materials.title') }}
      <span class="public-materials__count">{{ materials.length }}</span>
    </h3>

    <div v-if="materials.length === 0" class="public-materials__empty">
      {{ t('publicLesson.materials.empty') }}
    </div>

    <ul v-else class="public-materials__list" role="list">
      <li
        v-for="item in materials"
        :key="item.id"
        class="public-materials__item"
        :class="{ 'public-materials__item--restricted': !item.is_public }"
        role="listitem"
      >
        <div class="public-materials__icon" :aria-hidden="true">
          <svg v-if="contentTypeIcon(item.content_type) === 'pdf'" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="1" width="14" height="18" rx="2" fill="#ef4444"/>
            <path d="M6 10h8M6 13h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <svg v-else-if="contentTypeIcon(item.content_type) === 'video'" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="11" height="12" rx="2" fill="#3b82f6"/>
            <path d="M13 8l5-2.5v9L13 12V8z" fill="#3b82f6"/>
          </svg>
          <svg v-else-if="contentTypeIcon(item.content_type) === 'audio'" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v10.5a3 3 0 1 1-2-2.83V5l6-1.5v8a3 3 0 1 1-2-2.83V3h-2z" fill="#8b5cf6"/>
          </svg>
          <svg v-else-if="contentTypeIcon(item.content_type) === 'youtube'" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="12" rx="3" fill="#FF0000"/>
            <path d="M8.5 7.5l5 2.5-5 2.5V7.5z" fill="#fff"/>
          </svg>
          <svg v-else-if="contentTypeIcon(item.content_type) === 'image'" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="3" width="16" height="14" rx="2" stroke="#10b981" stroke-width="1.3"/>
            <circle cx="7" cy="8" r="2" fill="#10b981"/>
            <path d="M2 15l5-4 3 2 4-3 4 3" stroke="#10b981" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="2" width="14" height="16" rx="2" stroke="#94a3b8" stroke-width="1.5"/>
            <path d="M7 7h6M7 10h4" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>

        <div class="public-materials__info">
          <span class="public-materials__name">{{ item.name }}</span>
          <span v-if="!item.is_public" class="public-materials__restricted">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            {{ t('knowledge.public.restrictedMaterial') }}
          </span>
          <span v-else-if="item.content_type" class="public-materials__type">{{ item.content_type }}</span>
        </div>

        <a
          v-if="item.is_public && item.thumbnail_url"
          :href="item.thumbnail_url"
          target="_blank"
          rel="noopener noreferrer"
          class="public-materials__link"
          :aria-label="t('publicLesson.materials.open') + ': ' + item.name"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M5.5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M8 2h4v4M7 7l5-5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export interface PublicMaterial {
  id: string
  name: string
  content_type: string
  is_public: boolean
  thumbnail_url?: string | null
}

defineProps<{
  materials: PublicMaterial[]
}>()

const { t } = useI18n()

const CONTENT_TYPE_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'pdf': 'pdf',
  'video/mp4': 'video',
  'video': 'video',
  'audio/mpeg': 'audio',
  'audio': 'audio',
  'youtube_link': 'youtube',
  'youtube': 'youtube',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image': 'image',
}

function contentTypeIcon(ct: string): string {
  return CONTENT_TYPE_MAP[ct] ?? 'file'
}
</script>

<style scoped>
.public-materials {
  padding: 16px 0;
}

.public-materials__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 12px;
}

.public-materials__count {
  font-size: 11px;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 6px;
  border-radius: 10px;
}

.public-materials__empty {
  font-size: 13px;
  color: #94a3b8;
  padding: 12px 0;
}

.public-materials__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.public-materials__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  transition: border-color 0.12s;
}

.public-materials__item:hover {
  border-color: #e2e8f0;
}

.public-materials__item--restricted {
  opacity: 0.65;
}

.public-materials__restricted {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #f59e0b;
  font-weight: 500;
}

.public-materials__icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-radius: 6px;
  flex-shrink: 0;
}

.public-materials__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.public-materials__name {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-materials__type {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.public-materials__link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: #6366f1;
  transition: background 0.12s;
  flex-shrink: 0;
}

.public-materials__link:hover {
  background: #ede9fe;
}
</style>
