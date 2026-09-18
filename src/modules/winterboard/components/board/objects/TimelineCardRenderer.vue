<!--
  TimelineCardRenderer — універсальна шкала подій як WBAsset (H2).

  ОДИН ТИП НА ВСІ ШКАЛИ. Окремий компонент під конкретну шкалу заборонений ТЗ
  §6.2: інакше кожна нова тема народжувала б свій майже-такий-самий рендерер,
  і спільний стандарт картки розповзся б на десять діалектів.

  ДЕТЕРМІНОВАНИЙ РЕНДЕР. Усе, що видно, походить з `asset.data`. Мережі тут
  немає й бути не може: картка має однаково малюватись у класі, в реплеї через
  рік і в PDF. Довантаження фактів у рендерер прямо заборонене (§9.3).

  POINTER-EVENTS (дзеркало theory_card):
    .timeline-card            pointer-events:none → Konva-проксі ловить drag
    .timeline-card__body      pointer-events:auto → скрол і вибір події
    кнопки                    @click.stop — інакше клік з'їдає проксі

  Редагування вчителем дає ОДИН `asset_update` через спільний шлях
  `update:asset → WBCanvas → store` (§9.3). Власного write-path немає.
-->
<template>
  <div
    ref="rootEl"
    class="timeline-card"
    :class="{ 'is-selected': isSelected, 'is-readonly': !interactive }"
    :style="textScaleStyle"
    :data-testid="`timeline-card-${asset.id}`"
  >
    <header class="timeline-card__header">
      <span class="timeline-card__icon">🕘</span>
      <span class="timeline-card__title">{{ data.title || labels.untitled }}</span>
      <button
        v-if="!hostWindowControls && !asset.locked && isSelected"
        type="button"
        class="timeline-card__delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <div ref="bodyEl" class="timeline-card__body">
      <div ref="flowEl" class="timeline-card__flow">
        <p v-if="!events.length" class="timeline-card__empty">{{ labels.empty }}</p>

        <!-- Вісь. `ordinal` — рівні проміжки; `linear` — відстань за часом. -->
        <ol
          v-else
          class="timeline-card__axis"
          :class="[`is-${data.orientation || 'horizontal'}`, { 'is-linear': data.layout === 'linear' }]"
        >
          <li
            v-for="(ev, i) in events"
            :key="ev.id"
            class="timeline-card__event"
            :class="{ 'is-active': ev.id === data.active_event_id }"
            :style="offsetStyle(i)"
          >
            <button
              type="button"
              class="timeline-card__dot"
              :aria-pressed="ev.id === data.active_event_id"
              @click.stop="selectEvent(ev.id)"
              @mousedown.stop
              @pointerdown.stop
            >
              <span class="timeline-card__date">{{ formatDate(ev.date_start, ev.date_end) }}</span>
              <span class="timeline-card__label">{{ ev.label }}</span>
            </button>
          </li>
        </ol>

        <!-- Розгорнута подія: опис і джерела. Підписи — мовою МАТЕРІАЛУ. -->
        <div v-if="activeEvent" class="timeline-card__detail">
          <p v-if="activeEvent.description" class="timeline-card__description">
            {{ activeEvent.description }}
          </p>
          <SourceList :sources="activeEvent.sources" :language="materialLanguage" />
        </div>

        <div class="timeline-card__nav" v-if="events.length > 1">
          <button
            type="button" class="timeline-card__navbtn"
            :disabled="activeIndex <= 0"
            @click.stop="step(-1)" @mousedown.stop @pointerdown.stop
          >← {{ labels.prev }}</button>
          <button
            type="button" class="timeline-card__navbtn"
            :disabled="activeIndex < 0 || activeIndex >= events.length - 1"
            @click.stop="step(1)" @mousedown.stop @pointerdown.stop
          >{{ labels.next }} →</button>
        </div>

        <!-- Джерела всієї шкали — окремо від джерел конкретної події. -->
        <SourceList :sources="data.sources" :language="materialLanguage" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAsset, TimelineCardData, WBTimelineDate, WBTimelineEvent } from '../../../types/winterboard'
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { cardTextScaleStyle, presentationScaleOf } from '../../../board/cardPresentation'
import { isMinimizedOnBoard } from '../../../board/objectStandard'
import { useCardContentFit } from '../../../composables/useCardContentFit'
import { TIMELINE_LABELS, formatTimelineDate } from '../../../board/timelinePresentation'
import SourceList from './SourceList.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{ asset: WBAsset; isSelected?: boolean; interactive?: boolean }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  'activate-linked': [ids: string[]]
  delete: []
  'request-height': [neededPx: number]
}>()

const rootEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const flowEl = ref<HTMLElement | null>(null)

const EMPTY: TimelineCardData = {
  version: 1, title: '', layout: 'ordinal', orientation: 'horizontal',
  events: [], active_event_id: null, sources: [],
}
const data = computed<TimelineCardData>(() => (props.asset.data as TimelineCardData) ?? EMPTY)
const events = computed<WBTimelineEvent[]>(() =>
  Array.isArray(data.value.events) ? data.value.events : [])

// Підписи — мовою МАТЕРІАЛУ, не UI-локалі: англомовна шкала в українському
// інтерфейсі не має підписуватись «Далі» (той самий принцип, що в H0).
const materialLanguage = computed(() => (data.value.content_language === 'en' ? 'en' : 'uk'))
const labels = computed(() => TIMELINE_LABELS[materialLanguage.value])

const activeIndex = computed(() =>
  events.value.findIndex(e => e.id === data.value.active_event_id))
const activeEvent = computed(() =>
  activeIndex.value >= 0 ? events.value[activeIndex.value] : null)

const formatDate = (start: WBTimelineDate, end: WBTimelineDate | null) =>
  formatTimelineDate(start, end, materialLanguage.value)

/** `linear` розставляє події за часом; `ordinal` — рівномірно (default уроку). */
function offsetStyle(index: number): Record<string, string> {
  if (data.value.layout !== 'linear' || events.value.length < 2) return {}
  const years = events.value.map(e => e.date_start?.year).filter(y => typeof y === 'number')
  const min = Math.min(...years)
  const max = Math.max(...years)
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return {}
  const year = events.value[index]?.date_start?.year
  if (typeof year !== 'number') return {}
  return { '--timeline-offset': `${((year - min) / (max - min)) * 100}%` }
}

/** Вибір події — один `asset_update` спільним шляхом, без власного write-path. */
function selectEvent(id: string): void {
  if (!props.interactive) return
  const next = data.value.active_event_id === id ? null : id
  emit('update:asset', {
    ...props.asset,
    data: { ...data.value, active_event_id: next },
  } as WBAsset)
  if (next) {
    const event = events.value.find(item => item.id === next)
    if (event?.place_ids?.length) emit('activate-linked', event.place_ids)
  }
}

function step(delta: number): void {
  const i = activeIndex.value < 0 ? (delta > 0 ? -1 : events.value.length) : activeIndex.value
  const target = events.value[i + delta]
  if (target) selectEvent(target.id)
}

const hostWindowControls = useHostWindowControls()
const textScaleStyle = computed(() => cardTextScaleStyle(props.asset))

useCardContentFit({
  root: rootEl,
  body: bodyEl,
  flow: flowEl,
  canMeasure: () => props.interactive && !isMinimizedOnBoard(props.asset),
  sources: [
    () => data.value.title,
    () => JSON.stringify(events.value),
    () => data.value.active_event_id,
    () => data.value.layout,
    () => data.value.orientation,
    () => JSON.stringify(data.value.sources ?? []),
    () => data.value.content_language,
    () => presentationScaleOf(props.asset),
    () => props.asset.w,
  ],
  emitHeight: (neededPx) => emit('request-height', neededPx),
})

useExportCapture(() => props.asset?.id, (signal) => snapshotElement(rootEl.value, signal))
</script>

<style scoped>
.timeline-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  pointer-events: none; overflow: hidden;
}
.timeline-card.is-selected { border-color: #2563eb; }
.timeline-card__header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: #eff6ff; border-bottom: 1px solid #dbeafe;
}
.timeline-card__icon { font-size: calc(16px * var(--wb-card-text-scale, 1)); }
.timeline-card__title {
  flex: 1; font-weight: 600; color: #1e3a5f;
  font-size: calc(14px * var(--wb-card-text-scale, 1));
}
.timeline-card__delete {
  pointer-events: auto; background: none; border: none; cursor: pointer;
  font-size: 18px; line-height: 1; color: #64748b;
}
.timeline-card__body { flex: 1; overflow-y: auto; padding: 12px; pointer-events: auto; }
.timeline-card.is-readonly .timeline-card__body { pointer-events: none; }
.timeline-card__flow { display: flow-root; }
.timeline-card__empty { color: #64748b; font-size: calc(13px * var(--wb-card-text-scale, 1)); }

.timeline-card__axis { list-style: none; margin: 0; padding: 0; }
.timeline-card__axis.is-horizontal {
  display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px;
  border-bottom: 2px solid #cbd5e1;
}
.timeline-card__axis.is-vertical { display: flex; flex-direction: column; gap: 10px; }
.timeline-card__event { flex: 0 0 auto; margin-left: var(--timeline-offset, 0); }
.timeline-card__axis.is-horizontal.is-linear {
  position: relative; display: block; min-height: 76px; overflow-x: visible;
}
.timeline-card__axis.is-horizontal.is-linear .timeline-card__event {
  position: absolute; left: var(--timeline-offset, 0); margin-left: 0;
  transform: translateX(-50%);
}
.timeline-card__axis.is-vertical.is-linear {
  position: relative; display: block; min-height: 320px;
}
.timeline-card__axis.is-vertical.is-linear .timeline-card__event {
  position: absolute; top: var(--timeline-offset, 0); margin-left: 0;
  transform: translateY(-50%);
}
.timeline-card__dot {
  pointer-events: auto; display: flex; flex-direction: column; gap: 2px;
  background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;
  padding: 6px 10px; cursor: pointer; text-align: left; max-width: 220px;
}
.timeline-card__event.is-active .timeline-card__dot { border-color: #2563eb; background: #eff6ff; }
.timeline-card__date {
  font-size: calc(11px * var(--wb-card-text-scale, 1)); color: #64748b; font-variant-numeric: tabular-nums;
}
.timeline-card__label { font-size: calc(13px * var(--wb-card-text-scale, 1)); color: #0f172a; }
.timeline-card__detail { margin-top: 10px; }
.timeline-card__description {
  margin: 0 0 6px; font-size: calc(13px * var(--wb-card-text-scale, 1)); color: #334155;
}
.timeline-card__nav { display: flex; gap: 8px; margin-top: 10px; }
.timeline-card__navbtn {
  pointer-events: auto; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px;
  padding: 4px 10px; cursor: pointer; font-size: calc(12px * var(--wb-card-text-scale, 1));
}
.timeline-card__navbtn:disabled { opacity: 0.45; cursor: default; }
</style>
