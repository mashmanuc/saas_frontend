<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="wb-drag-ghost"
      :class="{ 'wb-drag-ghost--dropping': dropping }"
      :style="ghostStyle"
      aria-hidden="true"
      @animationend="onAnimationEnd"
    >
      <div class="wb-drag-ghost__card">
        <img
          v-if="info.thumbnail_url"
          :src="info.thumbnail_url"
          class="wb-drag-ghost__thumb"
          draggable="false"
        />
        <span v-else class="wb-drag-ghost__icon">{{ categoryEmoji }}</span>
        <span class="wb-drag-ghost__label">{{ info.title }}</span>
      </div>
      <div class="wb-drag-ghost__ring" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface GhostInfo {
  asset_category: string
  thumbnail_url: string | null
  title: string
}

const CATEGORY_EMOJIS: Record<string, string> = {
  image: '🖼',
  pdf: '📄',
  audio: '🎵',
  video: '▶️',
  presentation: '📊',
  problem: '📐',
}

const active = ref(false)
const dropping = ref(false)
const pos = ref({ x: -9999, y: -9999 })
const info = ref<GhostInfo>({ asset_category: 'image', thumbnail_url: null, title: '' })

const categoryEmoji = computed(() => CATEGORY_EMOJIS[info.value.asset_category] ?? '📎')

const ghostStyle = computed(() => ({
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
}))

// ── Event handlers ──────────────────────────────────────────────────────────

function onPreview(e: Event) {
  const detail = (e as CustomEvent<GhostInfo>).detail
  info.value = { ...detail }
  dropping.value = false
  active.value = true
}

function onStop() {
  if (!active.value) return
  // Trigger drop pop animation
  dropping.value = true
  // If animation doesn't fire (e.g. off-screen), fallback cleanup
  const timer = setTimeout(() => {
    active.value = false
    dropping.value = false
  }, 400)
  // cleared in onAnimationEnd
  stopTimer.value = timer
}

const stopTimer = ref<ReturnType<typeof setTimeout> | null>(null)

function onAnimationEnd(e: AnimationEvent) {
  if (e.animationName === 'ghostDrop') {
    if (stopTimer.value !== null) {
      clearTimeout(stopTimer.value)
      stopTimer.value = null
    }
    active.value = false
    dropping.value = false
  }
}

function onDragOver(e: DragEvent) {
  if (!active.value || dropping.value) return
  // Offset slightly so ghost doesn't cover the cursor
  pos.value = {
    x: e.clientX + 18,
    y: e.clientY - 60,
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('wb-drag-preview', onPreview)
  window.addEventListener('wb-drag-stop', onStop)
  document.addEventListener('dragover', onDragOver)
})

onUnmounted(() => {
  window.removeEventListener('wb-drag-preview', onPreview)
  window.removeEventListener('wb-drag-stop', onStop)
  document.removeEventListener('dragover', onDragOver)
  if (stopTimer.value !== null) clearTimeout(stopTimer.value)
})
</script>

<style scoped>
/* ── Ghost container — positioned fixed, follows cursor ── */
.wb-drag-ghost {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  user-select: none;
  transform-origin: top left;
  animation: ghostAppear 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.wb-drag-ghost--dropping {
  animation: ghostDrop 0.32s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

/* ── Card: the actual preview element ── */
.wb-drag-ghost__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.96);
  border: 2px solid #3b82f6;
  border-radius: 12px;
  padding: 10px;
  min-width: 90px;
  max-width: 160px;
  box-shadow:
    0 0 0 1px rgba(59, 130, 246, 0.15),
    0 8px 32px rgba(59, 130, 246, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(6px);
  transform: rotate(-3deg) scale(0.9);
  transition: box-shadow 0.15s;
}

/* ── Thumbnail ── */
.wb-drag-ghost__thumb {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* ── Emoji icon fallback ── */
.wb-drag-ghost__icon {
  font-size: 36px;
  line-height: 1;
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

/* ── Label ── */
.wb-drag-ghost__label {
  font-size: 11px;
  font-weight: 600;
  color: #1e293b;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  font-family: system-ui, -apple-system, sans-serif;
}

/* ── Pulsing glow ring ── */
.wb-drag-ghost__ring {
  position: absolute;
  inset: -6px;
  border-radius: 16px;
  border: 2px solid rgba(59, 130, 246, 0.5);
  animation: ghostPulse 1.2s ease-in-out infinite;
  pointer-events: none;
}

/* ─────────────────────────────── Animations ─────────────────────────────── */

@keyframes ghostAppear {
  0% {
    opacity: 0;
    transform: scale(0.6) translateY(10px);
  }
  60% {
    opacity: 1;
    transform: scale(1.04) translateY(-2px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes ghostDrop {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  30% {
    opacity: 1;
    transform: scale(1.18) translateY(-8px);
  }
  60% {
    opacity: 0.7;
    transform: scale(0.85) translateY(4px);
  }
  100% {
    opacity: 0;
    transform: scale(0.6) translateY(12px);
  }
}

@keyframes ghostPulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 0.15;
    transform: scale(1.08);
  }
}
</style>
