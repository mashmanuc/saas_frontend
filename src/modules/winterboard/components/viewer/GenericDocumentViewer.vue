<template>
  <div
    class="doc-viewer"
    :style="{ width: viewerWidth + 'px' }"
    role="region"
    :aria-label="title"
  >
    <!-- Resize handle (right edge) -->
    <div
      class="doc-viewer__resize"
      @mousedown.prevent="startResize"
      @touchstart.prevent="startResize"
    />

    <!-- Header -->
    <div class="doc-viewer__header">
      <span class="doc-viewer__title">{{ title }}</span>
      <span class="doc-viewer__counter">
        {{ currentIndex + 1 }} / {{ items.length }}
      </span>
      <button
        class="doc-viewer__btn doc-viewer__btn--close"
        type="button"
        :aria-label="t('winterboard.player.close')"
        @click="emit('close')"
      >
        &#x2715;
      </button>
    </div>

    <!-- Stage -->
    <div class="doc-viewer__stage">
      <button
        class="doc-viewer__nav doc-viewer__nav--prev"
        type="button"
        :disabled="currentIndex === 0"
        :aria-label="t('winterboard.player.prev')"
        @click.stop="prev"
      >
        &#x276E;
      </button>

      <div class="doc-viewer__slide-wrap">
        <Transition name="doc-slide" mode="out-in">
          <img
            :key="currentItem.url"
            :src="currentItem.url"
            :alt="itemLabel(currentIndex)"
            class="doc-viewer__slide-img"
            draggable="false"
          />
        </Transition>
      </div>

      <button
        class="doc-viewer__nav doc-viewer__nav--next"
        type="button"
        :disabled="currentIndex === items.length - 1"
        :aria-label="t('winterboard.player.next')"
        @click.stop="next"
      >
        &#x276F;
      </button>
    </div>

    <!-- Thumbnail strip (windowed for 50+ items) -->
    <div class="doc-viewer__strip" ref="stripRef">
      <template v-for="entry in stripEntries" :key="entry.type === 'gap' ? `gap-${entry.after}` : entry.index">
        <div v-if="entry.type === 'gap'" class="doc-viewer__strip-gap">&#8230;</div>
        <div
          v-else
          class="doc-viewer__thumb"
          :class="{ 'doc-viewer__thumb--active': entry.index === currentIndex }"
          :data-index="entry.index"
          @click="goto(entry.index)"
        >
          <img :src="entry.url" :alt="itemLabel(entry.index)" loading="lazy" />
          <span class="doc-viewer__thumb-num">{{ entry.index + 1 }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewerSlide } from '../../types/winterboard'

// ─── Props / Emits ───────────────────────────────────────────────────────────

const props = defineProps<{
  mode: 'presentation' | 'pdf' | 'document'
  title: string
  items: ViewerSlide[]
  startIndex: number
}>()

const emit = defineEmits<{
  close: []
  'width-change': [width: number]
}>()

// ─── i18n ────────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── State ───────────────────────────────────────────────────────────────────

const stripRef = ref<HTMLElement | null>(null)

/** Clamped start index: never out of bounds */
const clamped = computed(() =>
  Math.max(0, Math.min(props.startIndex, props.items.length - 1))
)

const currentIndex = ref(clamped.value)
const currentItem = computed(() => props.items[currentIndex.value] ?? props.items[0])

// Label differs per mode: "Slide N" vs "Page N"
function itemLabel(i: number): string {
  const key = props.mode === 'presentation' ? 'winterboard.viewer.slide' : 'winterboard.viewer.page'
  return t(key, { n: i + 1 })
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function prev() {
  if (currentIndex.value > 0) currentIndex.value--
}

function next() {
  if (currentIndex.value < props.items.length - 1) currentIndex.value++
}

function goto(i: number) {
  currentIndex.value = i
}

// ─── FIX 4: Keyboard via window listener (no Teleport → no guaranteed focus) ─

function onKey(e: KeyboardEvent) {
  // Ignore if user is typing in an input/textarea
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
  if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
}

// ─── FIX 3: Resize (user-controlled width) ──────────────────────────────────

const MIN_WIDTH = 300
const MAX_WIDTH_RATIO = 0.7

const viewerWidth = ref(480)

function startResize(e: MouseEvent | TouchEvent) {
  const startX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const startWidth = viewerWidth.value

  function onMove(ev: MouseEvent | TouchEvent) {
    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
    // Handle is on right edge: dragging right = bigger
    const dx = clientX - startX
    const maxWidth = window.innerWidth * MAX_WIDTH_RATIO
    viewerWidth.value = Math.round(
      Math.max(MIN_WIDTH, Math.min(startWidth + dx, maxWidth))
    )
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onUp)
    emit('width-change', viewerWidth.value)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.addEventListener('touchmove', onMove)
  document.addEventListener('touchend', onUp)
}

// ─── Thumbnail strip windowing (±5 + first/last) ─────────────────────────────

type StripThumb = { type: 'thumb'; index: number; url: string }
type StripGap   = { type: 'gap'; after: number }
type StripEntry = StripThumb | StripGap

const WINDOW_RADIUS = 5
const WINDOWING_THRESHOLD = 50

const stripEntries = computed<StripEntry[]>(() => {
  const total = props.items.length
  if (total <= WINDOWING_THRESHOLD) {
    return props.items.map(item => ({ type: 'thumb' as const, index: item.index, url: item.url }))
  }

  const cur = currentIndex.value
  const visibleSet = new Set<number>()
  visibleSet.add(0)
  visibleSet.add(total - 1)
  for (let i = Math.max(0, cur - WINDOW_RADIUS); i <= Math.min(total - 1, cur + WINDOW_RADIUS); i++) {
    visibleSet.add(i)
  }

  const sorted = Array.from(visibleSet).sort((a, b) => a - b)
  const result: StripEntry[] = []

  for (let j = 0; j < sorted.length; j++) {
    const idx = sorted[j]
    if (j > 0 && idx - sorted[j - 1] > 1) {
      result.push({ type: 'gap', after: sorted[j - 1] })
    }
    result.push({ type: 'thumb', index: idx, url: props.items[idx]?.url ?? '' })
  }

  return result
})

// ─── Auto-scroll strip to active thumb ───────────────────────────────────────

watch(currentIndex, async (i) => {
  await nextTick()
  const strip = stripRef.value
  if (!strip) return
  const thumb = strip.querySelector<HTMLElement>(`[data-index="${i}"]`)
  thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
})

// ─── Preload adjacent items (no ref storage) ─────────────────────────────────

watch(currentIndex, (i) => {
  for (const pi of [i - 1, i + 1]) {
    const item = props.items[pi]
    if (item?.url) new Image().src = item.url
  }
}, { immediate: true })

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.doc-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 300px;
  flex-shrink: 0;
  background: #1e293b;
  border-right: 2px solid #334155;
  position: relative;
  outline: none;
}

/* ── Resize handle ── */
.doc-viewer__resize {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 30;
}

.doc-viewer__resize:hover,
.doc-viewer__resize:active {
  background: rgba(59, 130, 246, 0.4);
}

/* ── Header ── */
.doc-viewer__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #0f172a;
  flex-shrink: 0;
}

.doc-viewer__title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-viewer__counter {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.doc-viewer__btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.1s, background 0.1s;
}

.doc-viewer__btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* ── Stage ── */
.doc-viewer__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  min-height: 0;
  background: #1e293b;
}

.doc-viewer__slide-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.doc-viewer__slide-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  user-select: none;
}

/* ── Navigation buttons ── */
.doc-viewer__nav {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.doc-viewer__nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
}

.doc-viewer__nav:disabled {
  opacity: 0.2;
  cursor: default;
}

/* ── Thumbnail strip ── */
.doc-viewer__strip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  overflow-x: auto;
  flex-shrink: 0;
  background: #0f172a;
  scrollbar-width: thin;
  scrollbar-color: #475569 transparent;
}

.doc-viewer__strip::-webkit-scrollbar { height: 4px }
.doc-viewer__strip::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px }

.doc-viewer__thumb {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  border-radius: 3px;
  padding: 3px;
  border: 2px solid transparent;
  transition: border-color 0.1s, background 0.1s;
}

.doc-viewer__thumb:hover {
  background: rgba(255, 255, 255, 0.08);
}

.doc-viewer__thumb--active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
}

.doc-viewer__thumb img {
  width: 60px;
  height: 45px;
  object-fit: cover;
  border-radius: 2px;
}

.doc-viewer__thumb-num {
  font-size: 9px;
  color: #94a3b8;
}

.doc-viewer__thumb--active .doc-viewer__thumb-num {
  color: #93c5fd;
}

.doc-viewer__strip-gap {
  flex-shrink: 0;
  color: #475569;
  font-size: 14px;
  padding: 0 2px;
  user-select: none;
}

/* ── Slide transition ── */
.doc-slide-enter-active,
.doc-slide-leave-active {
  transition: opacity 0.12s ease;
}

.doc-slide-enter-from,
.doc-slide-leave-to {
  opacity: 0;
}
</style>
