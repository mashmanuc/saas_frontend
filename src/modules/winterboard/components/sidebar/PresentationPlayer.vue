<template>
  <Teleport to="body">
    <div
      class="pres-player"
      role="dialog"
      aria-modal="true"
      :aria-label="item.title"
      @keydown="onKey"
      tabindex="-1"
      ref="playerRef"
    >
      <!-- Header -->
      <div class="pres-player__header">
        <span class="pres-player__title">{{ item.title }}</span>
        <span class="pres-player__counter">{{ currentIndex + 1 }} / {{ slides.length }}</span>
        <button
          class="pres-player__close"
          type="button"
          :aria-label="t('winterboard.player.close')"
          @click="$emit('close')"
        >
          &#x2715;
        </button>
      </div>

      <!-- Slide area -->
      <div class="pres-player__stage" @click.self="$emit('close')">
        <button
          class="pres-player__nav pres-player__nav--prev"
          type="button"
          :disabled="currentIndex === 0"
          :aria-label="t('winterboard.player.prev')"
          @click.stop="prev"
        >
          &#x276E;
        </button>

        <div class="pres-player__slide-wrap">
          <img
            :key="currentSlide.image_url"
            :src="currentSlide.image_url"
            :alt="t('winterboard.slideSelector.slideAlt', { n: currentIndex + 1 })"
            class="pres-player__slide-img"
            draggable="false"
          />
        </div>

        <button
          class="pres-player__nav pres-player__nav--next"
          type="button"
          :disabled="currentIndex === slides.length - 1"
          :aria-label="t('winterboard.player.next')"
          @click.stop="next"
        >
          &#x276F;
        </button>
      </div>

      <!-- Thumbnail strip -->
      <div class="pres-player__strip" ref="stripRef">
        <div
          v-for="(slide, i) in slides"
          :key="slide.image_url"
          class="pres-player__thumb"
          :class="{ 'pres-player__thumb--active': i === currentIndex }"
          @click="goto(i)"
        >
          <img :src="slide.image_url" :alt="`${i + 1}`" loading="lazy" />
          <span class="pres-player__thumb-num">{{ i + 1 }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AllowedContentItem } from '../../types/sidebar'

const props = defineProps<{
  item: AllowedContentItem
  startIndex?: number
}>()

defineEmits<{ close: [] }>()

const { t } = useI18n()
const playerRef = ref<HTMLElement | null>(null)
const stripRef = ref<HTMLElement | null>(null)
const currentIndex = ref(props.startIndex ?? 0)

const slides = computed(() => {
  const s = props.item.slides ?? {}
  return Object.entries(s)
    .map(([idx, data]) => ({ index: parseInt(idx, 10), image_url: data.image_url }))
    .sort((a, b) => a.index - b.index)
})

const currentSlide = computed(() => slides.value[currentIndex.value] ?? slides.value[0])

function prev() {
  if (currentIndex.value > 0) currentIndex.value--
}
function next() {
  if (currentIndex.value < slides.value.length - 1) currentIndex.value++
}
function goto(i: number) {
  currentIndex.value = i
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev() }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next() }
  if (e.key === 'Escape') { e.preventDefault(); /* emit handled by parent */ }
}

// Auto-scroll thumbnail strip to keep active thumb visible
watch(currentIndex, async (i) => {
  await nextTick()
  const strip = stripRef.value
  if (!strip) return
  const thumb = strip.children[i] as HTMLElement | undefined
  thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
})

onMounted(() => {
  playerRef.value?.focus()
  // Prevent body scroll while player is open
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
.pres-player {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  outline: none;
}

/* ── Header ── */
.pres-player__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}
.pres-player__title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pres-player__counter {
  font-size: 13px;
  color: #94a3b8;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.pres-player__close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.1s, background 0.1s;
}
.pres-player__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* ── Stage ── */
.pres-player__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  min-height: 0;
}
.pres-player__slide-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.pres-player__slide-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  user-select: none;
}

/* ── Navigation buttons ── */
.pres-player__nav {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, transform 0.1s;
}
.pres-player__nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.08);
}
.pres-player__nav:disabled {
  opacity: 0.25;
  cursor: default;
}

/* ── Thumbnail strip ── */
.pres-player__strip {
  display: flex;
  gap: 6px;
  padding: 8px 16px;
  overflow-x: auto;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.5);
  scrollbar-width: thin;
  scrollbar-color: #475569 transparent;
}
.pres-player__strip::-webkit-scrollbar { height: 4px }
.pres-player__strip::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px }

.pres-player__thumb {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  border-radius: 4px;
  padding: 4px;
  border: 2px solid transparent;
  transition: border-color 0.1s, background 0.1s;
}
.pres-player__thumb:hover {
  background: rgba(255, 255, 255, 0.1);
}
.pres-player__thumb--active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
}
.pres-player__thumb img {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: 2px;
}
.pres-player__thumb-num {
  font-size: 10px;
  color: #94a3b8;
}
.pres-player__thumb--active .pres-player__thumb-num {
  color: #93c5fd;
}
</style>
