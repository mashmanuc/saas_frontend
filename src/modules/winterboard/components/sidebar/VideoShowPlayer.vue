<template>
  <!-- Власник 2026-09-28 («так»): відео з «Матеріалів» запускається кнопкою ▶ на весь екран —
       так само, як презентація (PresentationPlayer): темне тло, угорі назва й ×, Esc закриває.
       Лише цей екран: на дошку не кладеться й нічого не пише; керують кнопки самого відео. -->
  <Teleport to="body">
    <div
      ref="rootRef"
      class="video-show"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
      data-testid="video-show"
      @keydown="onKey"
    >
      <div class="video-show__header">
        <span class="video-show__title">{{ title }}</span>
        <button
          type="button"
          class="video-show__close"
          data-testid="video-show-close"
          :aria-label="t('winterboard.player.close')"
          :title="t('winterboard.player.close')"
          @click="emit('close')"
        >&#x2715;</button>
      </div>
      <div class="video-show__stage">
        <!-- autoplay: відкриття — це дотик учителя, тож браузер дає звук -->
        <video
          class="video-show__video"
          :src="src"
          controls
          autoplay
          playsinline
          controlslist="nodownload"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  src: string
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.preventDefault()
  emit('close')
}

onMounted(() => {
  rootRef.value?.focus()
  // Як у PresentationPlayer: сторінка під показом не прокручується
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
.video-show {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  outline: none;
}
.video-show__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}
.video-show__title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.video-show__close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
}
.video-show__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}
.video-show__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.video-show__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

/* ── Темна тема (Б-156, фаза 2): ті самі селектори, що вище, — кольори токенами теми.
   Згенеровано з правил цього файлу; світла й класична не змінюються. ── */
[data-theme="dark"] .video-show__close {
  color: var(--color-text-muted);
}
</style>
