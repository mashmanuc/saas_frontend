<!-- WB: Public markers list — clickable markers with time labels
     Ref: PHASE12_PLAN.md B3 / Phase 13 B1.3 -->
<template>
  <nav class="public-markers" :aria-label="t('publicLesson.markers.title')">
    <h3 class="public-markers__title">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5L9.8 5.2l4.1.6-3 2.9.7 4.1L8 10.8l-3.6 2 .7-4.1-3-2.9 4.1-.6L8 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/>
      </svg>
      {{ t('publicLesson.markers.title') }}
      <span class="public-markers__count">{{ markers.length }}</span>
    </h3>

    <div v-if="markers.length === 0" class="public-markers__empty">
      {{ t('publicLesson.markers.empty') }}
    </div>

    <ul v-else class="public-markers__list" role="list">
      <li
        v-for="marker in markers"
        :key="marker.id"
        class="public-markers__item"
        :class="{
          'public-markers__item--active': isActiveMarker(marker),
          'public-markers__item--highlighted': isHighlightedMarker(marker),
        }"
        role="listitem"
        tabindex="0"
        @click="$emit('seek', marker.lesson_time_seconds * 1000)"
        @keydown.enter="$emit('seek', marker.lesson_time_seconds * 1000)"
      >
        <span class="public-markers__time">{{ formatTime(marker.lesson_time_seconds) }}</span>
        <span class="public-markers__label">{{ marker.title }}</span>
        <span v-if="marker.category" class="public-markers__badge" :style="{ background: categoryColor(marker.category) }">
          {{ categoryLabel(marker.category) }}
        </span>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface PublicMarker {
  id: string
  title: string
  lesson_time_seconds: number
  category?: string
}

const props = defineProps<{
  markers: PublicMarker[]
  currentTimeMs?: number
  highlightedTime?: number | null
}>()

defineEmits<{
  seek: [timeMs: number]
}>()

const { t } = useI18n()

const CATEGORY_COLORS: Record<string, string> = {
  theory: '#3b82f6',
  formula: '#8b5cf6',
  example: '#10b981',
  practice: '#f59e0b',
  solution: '#ef4444',
  custom: '#64748b',
}

const CATEGORY_LABELS: Record<string, string> = {
  theory: 'publicLesson.markers.categoryTheory',
  formula: 'publicLesson.markers.categoryFormula',
  example: 'publicLesson.markers.categoryExample',
  practice: 'publicLesson.markers.categoryPractice',
  solution: 'publicLesson.markers.categorySolution',
  custom: 'publicLesson.markers.categoryCustom',
}

const sortedMarkers = computed(() =>
  [...props.markers].sort((a, b) => a.lesson_time_seconds - b.lesson_time_seconds),
)

function isActiveMarker(marker: PublicMarker): boolean {
  if (props.currentTimeMs == null) return false
  const currentSec = props.currentTimeMs / 1000
  const idx = sortedMarkers.value.findIndex(m => m.id === marker.id)
  if (idx === -1) return false
  const nextMarker = sortedMarkers.value[idx + 1]
  return currentSec >= marker.lesson_time_seconds &&
    (nextMarker ? currentSec < nextMarker.lesson_time_seconds : true)
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#94a3b8'
}

function categoryLabel(cat: string): string {
  const key = CATEGORY_LABELS[cat]
  return key ? t(key) : cat
}

function isHighlightedMarker(marker: PublicMarker): boolean {
  if (props.highlightedTime == null) return false
  return Math.abs(marker.lesson_time_seconds - props.highlightedTime) < 2
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.public-markers {
  padding: 16px 0;
}

.public-markers__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 12px;
}

.public-markers__count {
  font-size: 11px;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 6px;
  border-radius: 10px;
}

.public-markers__empty {
  font-size: 13px;
  color: #94a3b8;
  padding: 12px 0;
}

.public-markers__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.public-markers__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}

.public-markers__item:hover {
  background: #f1f5f9;
}

.public-markers__item--active {
  background: #ede9fe;
}

.public-markers__item:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: -2px;
}

.public-markers__time {
  font-size: 13px;
  font-weight: 700;
  color: #6366f1;
  font-variant-numeric: tabular-nums;
  min-width: 40px;
  flex-shrink: 0;
}

.public-markers__label {
  font-size: 14px;
  color: #0f172a;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-markers__badge {
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.public-markers__item--highlighted {
  animation: marker-pulse 1s ease-in-out 3;
  border-color: var(--primary, #10b981);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
}

@keyframes marker-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@media (max-width: 640px) {
  .public-markers__item {
    padding: 10px 8px;
  }
}
</style>
