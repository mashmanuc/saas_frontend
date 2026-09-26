<template>
  <div
    class="wb-youtube-player"
    :style="{ width: '100%', height: '100%' }"
  >
    <!-- Шапка НАД плеєром — завжди: правила YouTube (Required Minimum
         Functionality) забороняють будь-що перед плеєром і його кнопками.
         Раніше підпис лежав поверх панелі з прогресом, а кнопки картки
         «— ⛶ ×» (4 px від верху, 20 px заввишки) — на плеєрі. Шапка 28 px
         вміщує їх цілком. -->
    <div class="wb-youtube-player__title" :class="{ 'wb-youtube-player__title--blocked': blocked }">
      {{ blocked ? t('winterboard.youtube.tapToStart') : (obj.title || t('winterboard.youtube.untitled')) }}
    </div>
    <iframe
      v-if="videoId"
      ref="frameRef"
      :src="embedUrl"
      width="100%"
      height="100%"
      frameborder="0"
      allow="autoplay; encrypted-media; fullscreen"
      allowfullscreen
      loading="lazy"
      class="wb-youtube-player__iframe"
      :class="{ 'wb-youtube-player__iframe--inert': pressHeld }"
    />
    <div v-else class="wb-youtube-player__error">
      <svg width="32" height="32" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 8l5 3-5 3V8z" fill="currentColor"/>
      </svg>
      <span>{{ t('winterboard.youtube.invalidUrl') }}</span>
    </div>
    <!-- Браузер не дав стартувати зі звуком за командою з пульта: кажемо, що
         робити, а не мовчимо. Шапка картки стає підказкою, а банер — у смузі
         застосунку вгорі: жоден із них не може лягти на плеєр (правила YouTube). -->
    <Teleport to="body">
      <div v-if="blocked" class="wb-youtube-blocked" role="status">
        {{ t('winterboard.youtube.tapToStart') }}
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// YouTubePlayerObject — renders YouTube embed iframe on the board
// Ref: DAY2_AGENT_B.md B3.1
// Zone: AGENT-B (components/board/objects/YouTubePlayerObject.vue)

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseYouTubeVideoId, getYouTubeEmbedUrl } from '../../../utils/youtubeParser'
import {
  registerYouTubeFrame,
  unregisterYouTubeFrame,
  ytPlayStates,
} from '../../../board/youtubeRemoteControl'

// ─── Types ──────────────────────────────────────────────────────────────────
// WBAsset.type='youtube_player' will be added by Agent A in Day 3.
// Until then, use a local interface extension.

export interface WBYouTubeAsset {
  id: string
  type: 'youtube_player'
  src: string
  youtubeUrl: string
  x: number
  y: number
  w: number
  h: number
  title?: string
  locked?: boolean
  lockedBy?: string
  zIndex?: number
}

const props = defineProps<{
  obj: WBYouTubeAsset
  isTutor: boolean
}>()

const { t } = useI18n({ useScope: 'global' })

// ─── Computed ───────────────────────────────────────────────────────────────

const videoId = computed(() => parseYouTubeVideoId(props.obj.youtubeUrl))
const embedUrl = computed(() => videoId.value ? getYouTubeEmbedUrl(videoId.value) : '')

// ─── Керування з пульта (V1 2026-09-26) ─────────────────────────────────────
// Плеєр реєструється за id асета; ▶/⏸ з пульта йдуть через youtubeRemoteControl
// (документований YouTube IFrame Player API).
const frameRef = ref<HTMLIFrameElement | null>(null)
watch(
  [frameRef, () => props.obj.id],
  ([frame, id], [prevFrame, prevId]) => {
    if (prevFrame && prevId) unregisterYouTubeFrame(prevId, prevFrame)
    if (frame && id) registerYouTubeFrame(id, frame)
  },
  { flush: 'post' },
)
const blocked = computed(() => ytPlayStates[props.obj.id] === 'blocked')

// ─── Натискання на дошці (рішення власника 2026-09-26) ──────────────────────
// У звичайному режимі кнопки плеєра натискаються, а картку тягнуть за шапку.
// Поки кнопка вказівника, натиснута в документі дошки, не відпущена, плеєр
// вказівник не приймає: інакше рух і відпускання над ним дістаються iframe
// YouTube (Chrome, перевірено) — перетягування «прилипає» до курсора.
// Натискання всередині самого плеєра сюди не доходять — його кнопки працюють.
const pressHeld = ref(false)
function onPressStart(): void { pressHeld.value = true }
function onPressEnd(): void { pressHeld.value = false }
onMounted(() => {
  window.addEventListener('pointerdown', onPressStart, true)
  window.addEventListener('pointerup', onPressEnd, true)
  window.addEventListener('pointercancel', onPressEnd, true)
  window.addEventListener('blur', onPressEnd)
})

onBeforeUnmount(() => {
  if (frameRef.value) unregisterYouTubeFrame(props.obj.id, frameRef.value)
  window.removeEventListener('pointerdown', onPressStart, true)
  window.removeEventListener('pointerup', onPressEnd, true)
  window.removeEventListener('pointercancel', onPressEnd, true)
  window.removeEventListener('blur', onPressEnd)
})
</script>

<style scoped>
.wb-youtube-player {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.wb-youtube-player__iframe {
  border: none;
  flex: 1;
}

.wb-youtube-player__iframe--inert {
  pointer-events: none;
}

.wb-youtube-player__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  color: #94a3b8;
  font-size: 13px;
  background: #1e293b;
}

.wb-youtube-player__title {
  flex: 0 0 28px;
  height: 28px;
  box-sizing: border-box;
  /* праворуч місце під кнопки картки «— ⛶ ×», щоб назва не йшла під них */
  padding: 6px 84px 6px 10px;
  background: #0f172a;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

.wb-youtube-player__title--blocked {
  background: #b45309;
  font-weight: 700;
}
</style>

<style>
/* Банер блокування живе в body (Teleport), тому не scoped. Стоїть у зеленій
   смузі застосунку (не над дошкою) — не може перекрити жоден плеєр. */
.wb-youtube-blocked {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1200;
  padding: 10px 18px;
  border-radius: 10px;
  background: #b45309;
  color: #fff;
  font: 600 15px/1.3 system-ui, sans-serif;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
</style>
