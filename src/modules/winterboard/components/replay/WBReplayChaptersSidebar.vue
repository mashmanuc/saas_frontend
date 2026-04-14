<template>
  <aside class="wb-replay-chapters" aria-label="Розділи уроку">
    <h3 class="wb-replay-chapters__title">{{ t('replay.chaptersTitle', 'Розділи уроку') }}</h3>
    <ul v-if="markers.length > 0" class="wb-replay-chapters__list">
      <li
        v-for="m in markers"
        :key="m.id"
        class="wb-replay-chapters__item"
        :class="{ 'wb-replay-chapters__item--active': m.id === activeMarkerId }"
      >
        <button type="button" class="wb-replay-chapters__btn" @click="$emit('seek', m)">
          <span class="wb-replay-chapters__dot" />
          <span class="wb-replay-chapters__time">{{ formatTime(m) }}</span>
          <span class="wb-replay-chapters__name">{{ m.title || t('replay.untitledChapter', 'Розділ') }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="wb-replay-chapters__empty">
      {{ t('replay.noChapters', 'Розділів немає') }}
    </p>
  </aside>
</template>

<script setup lang="ts">
// A.2.5: WBReplayChaptersSidebar — лівий sidebar з розділами уроку (markers).
// Світла тема, узгоджена з WBReplayControls / WBReplayBanner.
import { useI18n } from 'vue-i18n'
import type { WBLessonMarker } from '../../types/winterboard'

defineProps<{
  markers: ReadonlyArray<WBLessonMarker>
  activeMarkerId: string | null
}>()

defineEmits<{
  seek: [marker: WBLessonMarker]
}>()

const { t } = useI18n({ useScope: 'global' })

function formatTime(m: WBLessonMarker): string {
  // Якщо у marker є timestamp_ms — показуємо MM:SS
  const ms = (m as { timestamp_ms?: number }).timestamp_ms
  if (typeof ms === 'number') {
    const total = Math.floor(ms / 1000)
    const mm = Math.floor(total / 60)
    const ss = total % 60
    return `${mm}:${ss.toString().padStart(2, '0')}`
  }
  return ''
}
</script>

<style scoped>
.wb-replay-chapters {
  width: var(--wb-replay-chapters-width, 240px);
  flex-shrink: 0;
  background: var(--color-surface, #ffffff);
  border-right: 1px solid var(--color-border, #e2e8f0);
  padding: var(--wb-active-spacing, 16px);
  overflow-y: auto;
}

.wb-replay-chapters__title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text, #0f172a);
}

.wb-replay-chapters__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-replay-chapters__btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-muted, #64748b);
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.wb-replay-chapters__btn:hover {
  background: var(--color-surface-alt, #f1f5f9);
  color: var(--color-text, #0f172a);
}

.wb-replay-chapters__item--active .wb-replay-chapters__btn {
  background: var(--color-info-bg, #dbeafe);
  color: var(--color-info-text, #1e40af);
  font-weight: 600;
}

.wb-replay-chapters__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border, #cbd5e1);
  flex-shrink: 0;
}
.wb-replay-chapters__item--active .wb-replay-chapters__dot {
  background: var(--color-info-text, #1e40af);
}

.wb-replay-chapters__time {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  min-width: 36px;
}

.wb-replay-chapters__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-replay-chapters__empty {
  font-size: 13px;
  color: var(--color-text-muted, #94a3b8);
  margin: 0;
}

/* R2: Mobile — full-width when inside bottom-sheet */
@media (max-width: 639px) {
  .wb-replay-chapters {
    width: 100%;
    border-right: none;
    padding: 12px;
    max-height: none;
  }
  .wb-replay-chapters__btn {
    min-height: 44px;
    padding: 10px 12px;
  }
}
</style>
