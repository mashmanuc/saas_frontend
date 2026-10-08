<!--
  WBImageReadingButton — кнопка «Що прочитав Інтегралик» у тулбарі виділення (одна картинка)
  і невелике спливне вікно з ImageReadingBlock.
  ТЗ: saas_docs/domains/intent/TZ_IMAGE_READING_CORRECTOR_2026-10-08.md §5.

  Чому окремий компонент: правило «хто бачить» (imageReadingAccess.js) читає стори
  користувача й маршрут, а тулбар без них. Тулбар монтує цю кнопку лише коли кімната
  передала `imageReading` — тобто кімната сама її обробляє.

  Вікно закривається Esc, кліком поза ним і зміною виділення. Клавіші всередині вікна
  до дошки не доходять (@keydown.stop): слухач дошки висить на document, і Backspace
  у кнопці вікна інакше видалив би виділену картинку. Стан дошки й ops не змінюються.
-->
<template>
  <button
    v-if="allowed"
    ref="btnRef"
    type="button"
    class="wb-image-reading-btn"
    :class="{ 'wb-image-reading-btn--active': open }"
    data-testid="selection-image-reading"
    :title="t('winterboard.imageReading.open')"
    :aria-label="t('winterboard.imageReading.open')"
    :aria-expanded="open ? 'true' : 'false'"
    @click="toggle"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M4.8 6h6.4M4.8 8.5h6.4M4.8 11h3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>

  <Teleport to="body">
    <template v-if="allowed && open">
      <div
        class="wb-image-reading-backdrop"
        data-testid="image-reading-backdrop"
        @pointerdown.stop
        @click="close"
      />
      <div
        ref="popoverRef"
        class="wb-image-reading-popover"
        :style="popoverStyle"
        role="dialog"
        :aria-label="t('winterboard.imageReading.open')"
        tabindex="-1"
        data-testid="image-reading-popover"
        @pointerdown.stop
        @keydown.stop="onKeydown"
      >
        <ImageReadingBlock
          :board-id="boardId"
          :board-owner-id="boardOwnerId"
          :object-id="objectId"
          :image-src="imageSrc"
          @unavailable="onUnavailable"
        />
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useProfileStore } from '@/modules/profile/store/profileStore'
import { canSeeImageReading } from '@/modules/intent/imageReadingAccess'
import ImageReadingBlock from '../sidebar/properties/ImageReadingBlock.vue'

const props = defineProps<{
  boardId: string
  boardOwnerId: string | number | null
  objectId: string
  imageSrc: string
}>()

const { t } = useI18n()
const auth = useAuthStore()
const profile = useProfileStore()
const route = useRoute()

// Сервер відповів «не для вас» або Інтегралик на ньому вимкнено — кнопку для цієї дошки ховаємо.
const unavailableBoard = ref<string | null>(null)

const allowed = computed(() => unavailableBoard.value !== props.boardId && canSeeImageReading({
  user: auth.user,
  route,
  settings: profile.settings,
  boardOwnerId: props.boardOwnerId,
}))

function onUnavailable() {
  unavailableBoard.value = props.boardId
  close()
}

const open = ref(false)
const btnRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const anchor = ref<{ left: number; top: number; bottom: number } | null>(null)

const POPOVER_WIDTH = 320
const GAP = 6

async function toggle() {
  if (open.value) {
    close()
    return
  }
  const rect = btnRef.value?.getBoundingClientRect()
  anchor.value = rect ? { left: rect.left, top: rect.top, bottom: rect.bottom } : null
  open.value = true
  await nextTick()
  popoverRef.value?.focus()
}

function close() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  // Esc у полі тексту блока скасовує лише правку (preventDefault) — вікно лишається.
  if (e.key === 'Escape' && !e.defaultPrevented) close()
}

// Інша картинка — інше прочитане: вікно попередньої не лишаємо.
watch(() => props.objectId, close)

const popoverStyle = computed(() => {
  const a = anchor.value
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const left = Math.max(8, Math.min(a ? a.left : 8, vw - POPOVER_WIDTH - 8))
  const below = a ? vh - a.bottom - GAP - 8 : vh - 16
  const above = a ? a.top - GAP - 8 : 0
  // Під кнопкою, якщо там є місце; інакше над нею.
  if (!a || below >= 240 || below >= above) {
    return { left: `${left}px`, top: `${a ? a.bottom + GAP : 8}px`, maxHeight: `${Math.max(160, below)}px` }
  }
  return { left: `${left}px`, bottom: `${vh - a.top + GAP}px`, maxHeight: `${Math.max(160, above)}px` }
})
</script>

<style scoped>
/* Той самий вигляд, що .wb-selection-toolbar__btn (scoped-стилі тулбара сюди не доходять). */
.wb-image-reading-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-image-reading-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.wb-image-reading-btn--active {
  background: rgba(99, 102, 241, 0.6);
  color: #ffffff;
}

/* Нижче за вікно формули (z-index 100), вище за тулбар виділення (50). */
.wb-image-reading-backdrop {
  position: fixed;
  inset: 0;
  z-index: 59;
}

.wb-image-reading-popover {
  position: fixed;
  z-index: 60;
  width: 320px;
  max-width: calc(100vw - 16px);
  overflow-y: auto;
  padding: 0 12px 12px;
  background: var(--wb-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  outline: none;
}

/* Блок має верхню межу для панелі властивостей; у вікні вона зайва. */
.wb-image-reading-popover :deep(.image-reading) {
  border-top: none;
}
</style>
