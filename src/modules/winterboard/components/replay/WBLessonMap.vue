<template>
  <aside class="wb-lesson-map" data-testid="lesson-map">
    <header class="wb-lesson-map__header">
      <button
        type="button"
        class="wb-lesson-map__toggle"
        :aria-expanded="!collapsed"
        :aria-label="collapsed ? t('winterboard.lessonMap.expand') : t('winterboard.lessonMap.collapse')"
        @click="toggleCollapsed"
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
          class="wb-lesson-map__chevron"
          :class="{ 'wb-lesson-map__chevron--collapsed': collapsed }"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3 class="wb-lesson-map__heading">{{ t('winterboard.lessonMap.title') }}</h3>
      </button>
      <button
        v-if="canEdit && !collapsed"
        type="button"
        class="wb-lesson-map__add"
        :aria-label="t('winterboard.lessonMap.addMarker')"
        :title="t('winterboard.lessonMap.addMarker')"
        @click="$emit('create')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </header>

    <div v-show="!collapsed" class="wb-lesson-map__list">
      <div
        v-for="marker in sortedMarkers"
        :key="marker.id"
        class="wb-lesson-map__item"
        :class="{ 'wb-lesson-map__item--active': marker.id === activeMarkerId }"
        role="button"
        tabindex="0"
        @click="$emit('seek', marker)"
        @keydown.enter="$emit('seek', marker)"
      >
        <div class="wb-lesson-map__thumb">
          <img
            v-if="marker.thumbnail_url"
            :src="marker.thumbnail_url"
            alt=""
            class="wb-lesson-map__thumb-img"
            loading="lazy"
          />
          <div v-else class="wb-lesson-map__thumb-placeholder">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/>
              <circle cx="7" cy="9" r="1.5" stroke="currentColor" stroke-width="1"/>
              <path d="M2 13l4-3 3 2 4-4 5 5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="wb-lesson-map__info">
          <span class="wb-lesson-map__title">{{ marker.title }}</span>
          <span
            class="wb-lesson-map__badge"
            :style="{ backgroundColor: CATEGORY_COLORS[marker.category] || CATEGORY_COLORS.custom }"
          >
            {{ t(`winterboard.lessonMap.category.${marker.category}`) }}
          </span>
        </div>
        <button
          v-if="canEdit"
          type="button"
          class="wb-lesson-map__delete"
          :aria-label="t('winterboard.lessonMap.deleteMarker')"
          @click.stop="$emit('delete', marker.id)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="markers.length === 0 && !collapsed" class="wb-lesson-map__empty">
      {{ t('winterboard.lessonMap.empty') }}
    </div>

    <!-- Onboarding hint (shown once) -->
    <div
      v-if="showOnboardingHint && markers.length === 0 && !collapsed"
      class="wb-lesson-map__hint"
    >
      <p>{{ t('winterboard.lessonMap.onboardingHint') }}</p>
      <button
        type="button"
        class="wb-lesson-map__hint-dismiss"
        @click="dismissHint"
      >
        {{ t('winterboard.lessonMap.dismiss') }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
// WBLessonMap — Lesson navigation sidebar for replay mode
// Ref: DAY4_AGENT_B.md B5.1
// Zone: AGENT-B (components/replay/)

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBLessonMarker, LessonMarkerCategory } from '../../types/winterboard'

const props = defineProps<{
  markers: WBLessonMarker[]
  activeMarkerId: string | null
  canEdit: boolean
}>()

defineEmits<{
  (e: 'seek', marker: WBLessonMarker): void
  (e: 'create'): void
  (e: 'delete', id: string): void
}>()

const { t } = useI18n({ useScope: 'global' })

// B2.4: Onboarding hint — shown once for new users
const HINT_STORAGE_KEY = 'wb:lesson-map-hint-dismissed'

const showOnboardingHint = ref((() => {
  try {
    return localStorage.getItem(HINT_STORAGE_KEY) !== 'true'
  } catch {
    return true
  }
})())

function dismissHint(): void {
  showOnboardingHint.value = false
  try {
    localStorage.setItem(HINT_STORAGE_KEY, 'true')
  } catch { /* ignore */ }
}

// A2.1: Collapsed state with localStorage persist (expanded by default)
const STORAGE_KEY = 'wb:lesson-map-collapsed'

const collapsed = ref((() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
})())

watch(collapsed, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch { /* localStorage not available */ }
})

function toggleCollapsed(): void {
  collapsed.value = !collapsed.value
}

const CATEGORY_COLORS: Record<LessonMarkerCategory | string, string> = {
  theory: '#3b82f6',
  formula: '#8b5cf6',
  example: '#10b981',
  practice: '#f59e0b',
  solution: '#ef4444',
  custom: '#6b7280',
}

const sortedMarkers = computed(() =>
  [...props.markers].sort((a, b) => a.order - b.order || a.operation_index - b.operation_index),
)
</script>

<style scoped>
.wb-lesson-map {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  min-width: 280px;
  z-index: 20;
  background: #0f172a;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wb-lesson-map__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #1e293b;
}

.wb-lesson-map__heading {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.wb-lesson-map__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
}

.wb-lesson-map__chevron {
  transition: transform 0.15s ease;
  color: #94a3b8;
}

.wb-lesson-map__chevron--collapsed {
  transform: rotate(-90deg);
}

.wb-lesson-map__add {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-lesson-map__add:hover {
  background: #334155;
  color: #f1f5f9;
}

.wb-lesson-map__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-lesson-map__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.wb-lesson-map__item:hover {
  background: #1e293b;
}

.wb-lesson-map__item--active {
  background: #1e293b;
  border-left-color: #3b82f6;
}

.wb-lesson-map__thumb {
  width: 80px;
  min-width: 80px;
  height: 45px;
  border-radius: 4px;
  overflow: hidden;
  background: #1e293b;
}

.wb-lesson-map__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-lesson-map__thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
}

.wb-lesson-map__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-lesson-map__title {
  font-size: 13px;
  font-weight: 500;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-lesson-map__badge {
  display: inline-block;
  width: fit-content;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: #fff;
  text-transform: capitalize;
}

.wb-lesson-map__delete {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #475569;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.wb-lesson-map__item:hover .wb-lesson-map__delete {
  opacity: 1;
}

.wb-lesson-map__delete:hover {
  background: #ef4444;
  color: #fff;
}

.wb-lesson-map__empty {
  padding: 24px 16px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.wb-lesson-map__hint {
  margin: 0.75rem;
  padding: 0.75rem;
  background: var(--wb-info-bg, #dbeafe);
  border: 1px solid var(--wb-info-border, #93c5fd);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--wb-info-text, #1e40af);
}

.wb-lesson-map__hint p {
  margin: 0;
}

.wb-lesson-map__hint-dismiss {
  display: block;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid var(--wb-info-border, #93c5fd);
  border-radius: 4px;
  color: var(--wb-info-text, #1e40af);
  font-size: 0.75rem;
  cursor: pointer;
}

.wb-lesson-map__hint-dismiss:hover {
  background: var(--wb-info-border, #93c5fd);
  color: #fff;
}
</style>
