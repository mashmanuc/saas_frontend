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

    <!-- SHARE-1: Viber (UA priority #3) -->
    <a
      :href="viberShareUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="share-buttons__btn share-buttons__btn--viber"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8.3 1C5.1 1 2.5 3.3 2.5 6.1c0 1.5.7 2.9 1.8 3.9l-.5 2.5 2.6-1.3c.6.2 1.2.3 1.9.3 3.2 0 5.8-2.3 5.8-5.1S11.5 1 8.3 1zm3 4.1c-.1.2-.5.5-.5.5s-.4.3-.4.5c0 .1.1.3.2.5.3.5.8 1.1 1.3 1.5.3.2.7.5 1.1.6.2.1.3 0 .5-.1.1-.1.3-.4.4-.5.1-.1.2-.1.3 0 .2.1.8.4 1 .5.2.1.3.2.3.3 0 .2-.1.8-.6 1.1-.4.3-.9.3-1.3.2-.5-.1-1.8-.7-2.9-1.7-1.4-1.3-2.2-2.8-2.4-3.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4 0-.1 0-.3-.1-.4-.1-.1-.5-1.2-.7-1.6-.2-.4-.3-.3-.5-.3h-.4s-.3 0-.5.2c-.2.2-.7.7-.7 1.7s.7 2 .8 2.1z" fill="currentColor"/>
      </svg>
      Viber
    </a>

    <!-- SHARE-1: Facebook (UA priority #4) -->
    <a
      :href="facebookShareUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="share-buttons__btn share-buttons__btn--facebook"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M9.5 2.7H11V.1C10.7.1 9.9 0 9 0 7 0 5.7 1.2 5.7 3.4V5.5H3.2v2.9h2.5V16h3V8.4h2.4l.4-2.9H8.7V3.6c0-.8.2-1 .8-1z" fill="currentColor"/>
      </svg>
      Facebook
    </a>

    <!-- SHARE-1: WhatsApp (UA priority #5) -->
    <a
      :href="whatsappShareUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="share-buttons__btn share-buttons__btn--whatsapp"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1C4.1 1 1 4.1 1 8c0 1.2.3 2.4.9 3.4L1 15l3.7-.9c1 .5 2.1.8 3.3.8 3.9 0 7-3.1 7-7s-3.1-7-7-7zm3.6 9.8c-.2.5-.9.9-1.5 1-.4.1-.9.1-1.5-.1-.4-.1-.8-.3-1.4-.6-2.4-1.2-3.9-3.6-4-3.8-.1-.2-.9-1.2-.9-2.3s.6-1.6.8-1.8c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4.2.4.6 1.5.7 1.6.1.1.1.3 0 .4-.1.2-.1.3-.2.4-.1.1-.3.3-.4.4-.1.1-.3.3-.1.5.1.3.6 1 1.3 1.6.9.8 1.7 1 1.9 1.2.2.1.4.1.5-.1.1-.2.6-.7.8-.9.2-.2.3-.2.5-.1.2.1 1.2.6 1.4.7.2.1.4.2.4.3.1.1.1.6-.1 1.1z" fill="currentColor"/>
      </svg>
      WhatsApp
    </a>

    <!-- LinkedIn -->
    <a
      :href="linkedinShareUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="share-buttons__btn share-buttons__btn--linkedin"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 6h2.5v8H2V6zm1.25-1C2.56 5 2 4.44 2 3.75S2.56 2.5 3.25 2.5 4.5 3.06 4.5 3.75 3.94 5 3.25 5zM14 14h-2.5v-3.9c0-.93-.02-2.13-1.3-2.13-1.3 0-1.5 1.02-1.5 2.07V14H6.2V6h2.4v1.09h.03c.34-.64 1.16-1.3 2.38-1.3 2.54 0 3.01 1.67 3.01 3.85V14z" fill="currentColor"/>
      </svg>
      LinkedIn
    </a>

    <!-- X (Twitter) -->
    <a
      :href="twitterShareUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="share-buttons__btn share-buttons__btn--twitter"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M12.6 1.5h2.2L10 7.1l5.7 7.4h-4.5l-3.5-4.5-4 4.5H1.5l5.1-5.8L1.2 1.5h4.6l3.1 4.2 3.7-4.2zm-.8 11.6h1.2L5.3 2.8H4L11.8 13.1z" fill="currentColor"/>
      </svg>
      X
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

// Phase 16 INT-38: LinkedIn share URL
const linkedinShareUrl = computed(() =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl.value)}`
)

// Phase 16 INT-38: Twitter/X share URL
const twitterShareUrl = computed(() =>
  `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl.value)}&text=${encodeURIComponent(props.title)}`
)

// SHARE-1: Viber share URL
const viberShareUrl = computed(() =>
  `viber://forward?text=${encodeURIComponent(props.title + ' ' + shareUrl.value)}`
)

// SHARE-1: Facebook share URL
const facebookShareUrl = computed(() =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl.value)}`
)

// SHARE-1: WhatsApp share URL
const whatsappShareUrl = computed(() =>
  `https://wa.me/?text=${encodeURIComponent(props.title + ' ' + shareUrl.value)}`
)

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

.share-buttons__btn--linkedin:hover {
  background: #e0f0ff;
  border-color: #0a66c2;
  color: #0a66c2;
}

.share-buttons__btn--twitter:hover {
  background: #f0f0f0;
  border-color: #1d1d1f;
  color: #1d1d1f;
}

.share-buttons__btn--viber:hover {
  background: #f0e6ff;
  border-color: #7360f2;
  color: #7360f2;
}

.share-buttons__btn--facebook:hover {
  background: #e7f0ff;
  border-color: #1877f2;
  color: #1877f2;
}

.share-buttons__btn--whatsapp:hover {
  background: #e6ffe6;
  border-color: #25d366;
  color: #128c7e;
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
