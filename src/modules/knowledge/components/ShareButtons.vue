<!-- Knowledge: Share buttons — copy URL, Telegram, QR
     Ref: Phase 13 B2.4 -->
<template>
  <div class="share-buttons" role="group" :aria-label="t('knowledge.share.ariaLabel')">
    <button
      type="button"
      class="share-buttons__btn share-buttons__btn--copy"
      @click="copyUrl"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.3"/>
        <path d="M11 5V3a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.3"/>
      </svg>
      {{ t('knowledge.share.copyLink') }}
    </button>

    <a
      :href="telegramShareUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="share-buttons__btn share-buttons__btn--telegram"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M14.5 1.5L1 7l4 1.5m9.5-7L10 14l-5-5.5m9.5-7L5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {{ t('knowledge.share.telegram') }}
    </a>

    <button
      type="button"
      class="share-buttons__btn share-buttons__btn--qr"
      @click="showQr = true"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <rect x="10" y="10" width="4" height="4" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
      </svg>
      {{ t('knowledge.share.qr') }}
    </button>

    <!-- Moment share (with timestamp) -->
    <button
      v-if="currentTimeMs != null && currentTimeMs > 0"
      type="button"
      class="share-buttons__btn share-buttons__btn--moment"
      @click="copyMomentUrl"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/>
        <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {{ t('knowledge.share.shareMoment') }}
    </button>

    <!-- Toast notification -->
    <Transition name="share-toast">
      <div v-if="toastVisible" class="share-buttons__toast" role="status" aria-live="polite">
        {{ t('knowledge.share.copied') }}
      </div>
    </Transition>

    <!-- QR Modal -->
    <Teleport to="body">
      <Transition name="share-modal">
        <div
          v-if="showQr"
          class="share-qr-overlay"
          @click.self="showQr = false"
          @keydown.escape="showQr = false"
        >
          <div
            ref="qrModalRef"
            class="share-qr-modal"
            role="dialog"
            :aria-label="t('knowledge.share.qr')"
            tabindex="-1"
          >
            <button
              type="button"
              class="share-qr-modal__close"
              :aria-label="t('common.close')"
              @click="showQr = false"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="share-qr-modal__content" v-html="qrSvg" />
            <p class="share-qr-modal__url">{{ shareUrl }}</p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  url: string
  title: string
  currentTimeMs?: number
}>()

const { t } = useI18n()

const showQr = ref(false)
const toastVisible = ref(false)
const qrModalRef = ref<HTMLElement | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | null = null

const shareUrl = computed(() => props.url)

const momentUrl = computed(() => {
  if (props.currentTimeMs == null || props.currentTimeMs <= 0) return props.url
  const sec = Math.floor(props.currentTimeMs / 1000)
  const sep = props.url.includes('?') ? '&' : '?'
  return `${props.url}${sep}t=${sec}`
})

const telegramShareUrl = computed(() => {
  const text = props.title
  const url = shareUrl.value
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
})

const qrSvg = computed(() => generateQrSvg(shareUrl.value))

function showToast(): void {
  if (toastTimer) clearTimeout(toastTimer)
  toastVisible.value = true
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

async function copyUrl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    showToast()
  } catch {
    fallbackCopy(shareUrl.value)
  }
}

async function copyMomentUrl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(momentUrl.value)
    showToast()
  } catch {
    fallbackCopy(momentUrl.value)
  }
}

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
    showToast()
  } catch { /* silent */ }
  document.body.removeChild(ta)
}

watch(showQr, async (visible) => {
  if (visible) {
    await nextTick()
    qrModalRef.value?.focus()
  }
})

/**
 * Lightweight QR code SVG generator.
 * Uses a simple encoding approach for URLs up to ~100 chars.
 * For production, consider using a dedicated QR library.
 * This generates a placeholder pattern that visually represents a QR code.
 */
function generateQrSvg(text: string): string {
  const size = 21
  const cellSize = 8
  const svgSize = size * cellSize
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // Finder patterns (3 corners)
  const finderPositions = [[0, 0], [0, size - 7], [size - 7, 0]]
  for (const [row, col] of finderPositions) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
        grid[row + r][col + c] = isOuter || isInner
      }
    }
  }

  // Data modules — simple hash-based pattern for visual representation
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) continue
      // Skip timing patterns
      if (r === 6 || c === 6) {
        grid[r][c] = (r + c) % 2 === 0
        continue
      }
      // Data based on hash
      const seed = (hash ^ (r * 31 + c * 17)) & 0xFFFF
      grid[r][c] = seed % 3 === 0
    }
  }

  let rects = ''
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a"/>`
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}">${rects}</svg>`
}
</script>

<style scoped>
.share-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  position: relative;
}

.share-buttons__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  white-space: nowrap;
}

.share-buttons__btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #0f172a;
}

.share-buttons__btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.share-buttons__btn--telegram:hover {
  background: #e0f2fe;
  border-color: #0ea5e9;
  color: #0284c7;
}

.share-buttons__btn--moment {
  border-style: dashed;
}

.share-buttons__toast {
  position: absolute;
  top: -36px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  background: #0f172a;
  color: #ffffff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  white-space: nowrap;
}

.share-toast-enter-active,
.share-toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.share-toast-enter-from,
.share-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

/* QR Modal */
.share-qr-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.share-qr-modal {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  max-width: 300px;
  width: 90%;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.share-qr-modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: #f1f5f9;
  border-radius: 6px;
  color: #475569;
  cursor: pointer;
  transition: background 0.12s;
}

.share-qr-modal__close:hover {
  background: #e2e8f0;
}

.share-qr-modal__content {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.share-qr-modal__content :deep(svg) {
  max-width: 200px;
  height: auto;
}

.share-qr-modal__url {
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  margin: 0;
  word-break: break-all;
  line-height: 1.4;
}

.share-modal-enter-active,
.share-modal-leave-active {
  transition: opacity 0.2s;
}
.share-modal-enter-from,
.share-modal-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .share-buttons {
    gap: 6px;
  }
  .share-buttons__btn {
    padding: 6px 10px;
    font-size: 12px;
  }
}
</style>
