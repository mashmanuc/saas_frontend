<template>
  <div class="wb-follow-mode">
    <!-- Follow banner (top) -->
    <Transition name="wb-slide-down">
      <div
        v-if="isFollowing && followTarget"
        class="wb-follow-banner"
        role="status"
        aria-live="polite"
        :aria-label="t('winterboard.classroom.follow.following', { name: followTarget.displayName })"
      >
        <span
          class="wb-follow-banner__avatar"
          :style="{ background: followTarget.color }"
          :aria-hidden="true"
        >
          {{ avatarInitial }}
        </span>
        <span class="wb-follow-banner__text">
          {{ t('winterboard.classroom.follow.following', { name: followTarget.displayName }) }}
        </span>
        <span v-if="pageChangePulse" class="wb-follow-banner__pulse" aria-hidden="true" />
        <button
          type="button"
          class="wb-follow-banner__stop"
          :aria-label="t('winterboard.classroom.follow.stopFollowing')"
          @click="handleStopFollowing"
        >
          {{ t('winterboard.classroom.follow.stopFollowing') }}
        </button>
      </div>
    </Transition>

    <!-- Teacher disconnected banner -->
    <Transition name="wb-slide-down">
      <div
        v-if="teacherDisconnected"
        class="wb-follow-banner wb-follow-banner--disconnected"
        role="alert"
        aria-live="assertive"
      >
        <span class="wb-follow-banner__icon" aria-hidden="true">⚠</span>
        <span class="wb-follow-banner__text">
          {{ t('winterboard.classroom.follow.teacherDisconnected') }}
        </span>
      </div>
    </Transition>

    <!-- Return to teacher floating button (manual mode) -->
    <Transition name="wb-fade-up">
      <button
        v-if="showReturnButton"
        type="button"
        class="wb-follow-return"
        :aria-label="t('winterboard.classroom.follow.returnToTeacher')"
        @click="handleReturnToTeacher"
      >
        <span class="wb-follow-return__icon" aria-hidden="true">↑</span>
        <span class="wb-follow-return__text">
          {{ t('winterboard.classroom.follow.returnToTeacher') }}
        </span>
      </button>
    </Transition>

    <!-- Page change toast -->
    <Transition name="wb-toast">
      <div
        v-if="pageChangeToast"
        class="wb-follow-toast"
        role="status"
        aria-live="polite"
      >
        {{ pageChangeToast }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FollowTarget {
  userId: string
  displayName: string
  color: string
}

export interface WBFollowModeProps {
  /** Whether follow mode is currently active */
  isFollowing: boolean
  /** Current follow target info */
  followTarget: FollowTarget | null
  /** Whether the teacher cursor is present in the room */
  teacherPresent: boolean
  /** Whether the local user is a student */
  isStudent: boolean
  /** Current page index the teacher is on (for page change detection) */
  teacherPageIndex: number
  /** Total page count */
  pageCount: number
}

export interface WBFollowModeEmits {
  (e: 'start-following'): void
  (e: 'stop-following'): void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:FollowMode]'
const AUTO_REFOLLOW_DELAY_MS = 30_000
const PAGE_TOAST_DURATION_MS = 3_000

// ─── Props & Emits ──────────────────────────────────────────────────────────

const props = defineProps<WBFollowModeProps>()
const emit = defineEmits<WBFollowModeEmits>()
const { t } = useI18n()

// ─── State ──────────────────────────────────────────────────────────────────

const teacherDisconnected = ref(false)
const wasFollowingBeforeDisconnect = ref(false)
const pageChangePulse = ref(false)
const pageChangeToast = ref<string | null>(null)
const manualModeTimestamp = ref<number | null>(null)

let autoRefollowTimer: ReturnType<typeof setTimeout> | null = null
let pageToastTimer: ReturnType<typeof setTimeout> | null = null
let pulseTimer: ReturnType<typeof setTimeout> | null = null

// ─── Computed ───────────────────────────────────────────────────────────────

const avatarInitial = computed(() => {
  const name = props.followTarget?.displayName ?? ''
  return name.charAt(0).toUpperCase() || '?'
})

const showReturnButton = computed(() => {
  return props.isStudent && !props.isFollowing && props.teacherPresent && !teacherDisconnected.value
})

// ─── Handlers ───────────────────────────────────────────────────────────────

function handleStopFollowing(): void {
  emit('stop-following')
  manualModeTimestamp.value = Date.now()
  startAutoRefollowTimer()
  console.info(LOG, 'User stopped following, auto-refollow in 30s')
}

function handleReturnToTeacher(): void {
  clearAutoRefollowTimer()
  manualModeTimestamp.value = null
  emit('start-following')
  console.info(LOG, 'User returned to teacher')
}

// ─── Auto-refollow timer ────────────────────────────────────────────────────

function startAutoRefollowTimer(): void {
  clearAutoRefollowTimer()
  autoRefollowTimer = setTimeout(() => {
    if (!props.isFollowing && props.teacherPresent && props.isStudent) {
      emit('start-following')
      manualModeTimestamp.value = null
      console.info(LOG, 'Auto-refollow after 30s inactivity')
    }
  }, AUTO_REFOLLOW_DELAY_MS)
}

function clearAutoRefollowTimer(): void {
  if (autoRefollowTimer !== null) {
    clearTimeout(autoRefollowTimer)
    autoRefollowTimer = null
  }
}

// ─── Page change toast ──────────────────────────────────────────────────────

function showPageToast(pageIndex: number): void {
  const pageNum = pageIndex + 1
  pageChangeToast.value = t('winterboard.classroom.follow.movedToPage', { page: pageNum })

  if (pageToastTimer) clearTimeout(pageToastTimer)
  pageToastTimer = setTimeout(() => {
    pageChangeToast.value = null
  }, PAGE_TOAST_DURATION_MS)

  // Pulse animation on banner
  pageChangePulse.value = true
  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => {
    pageChangePulse.value = false
  }, 600)
}

// ─── Watchers ───────────────────────────────────────────────────────────────

// Teacher disconnect/reconnect
watch(
  () => props.teacherPresent,
  (present, wasPresentBefore) => {
    if (!present && wasPresentBefore) {
      // Teacher disconnected
      teacherDisconnected.value = true
      wasFollowingBeforeDisconnect.value = props.isFollowing
      console.info(LOG, 'Teacher disconnected')
    } else if (present && !wasPresentBefore && teacherDisconnected.value) {
      // Teacher reconnected
      teacherDisconnected.value = false
      if (wasFollowingBeforeDisconnect.value && props.isStudent) {
        emit('start-following')
        console.info(LOG, 'Teacher reconnected, auto-resume follow')
      }
      wasFollowingBeforeDisconnect.value = false
    }
  },
)

// Teacher page change → toast
watch(
  () => props.teacherPageIndex,
  (newIdx, oldIdx) => {
    if (typeof oldIdx === 'number' && newIdx !== oldIdx && props.isFollowing) {
      showPageToast(newIdx)
    }
  },
)

// Keyboard: Escape to stop following
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.isFollowing) {
    handleStopFollowing()
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  clearAutoRefollowTimer()
  if (pageToastTimer) clearTimeout(pageToastTimer)
  if (pulseTimer) clearTimeout(pulseTimer)
})
</script>

<style scoped>
/* ── Follow banner ─────────────────────────────────────────────────────────── */

.wb-follow-mode {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 50;
}

.wb-follow-mode > * {
  pointer-events: auto;
}

.wb-follow-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(34, 197, 94, 0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.wb-follow-banner--disconnected {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.4);
}

.wb-follow-banner__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.wb-follow-banner__icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.wb-follow-banner__text {
  font-weight: 500;
}

.wb-follow-banner__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  animation: wb-follow-pulse 0.6s ease-out;
}

@keyframes wb-follow-pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}

.wb-follow-banner__stop {
  margin-left: 4px;
  padding: 3px 10px;
  background: rgba(0, 0, 0, 0.08);
  border: none;
  border-radius: 5px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-follow-banner__stop:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* ── Return to teacher button ──────────────────────────────────────────────── */

.wb-follow-return {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--wb-brand, #2563eb);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transition: background 0.15s ease, transform 0.15s ease;
}

.wb-follow-return:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.wb-follow-return:active {
  transform: translateY(0);
}

.wb-follow-return__icon {
  font-size: 1rem;
}

/* ── Page change toast ─────────────────────────────────────────────────────── */

.wb-follow-toast {
  position: absolute;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  color: white;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* ── Transitions ───────────────────────────────────────────────────────────── */

.wb-slide-down-enter-active,
.wb-slide-down-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.wb-slide-down-enter-from { transform: translateX(-50%) translateY(-16px); opacity: 0; }
.wb-slide-down-enter-to { transform: translateX(-50%) translateY(0); opacity: 1; }
.wb-slide-down-leave-from { transform: translateX(-50%) translateY(0); opacity: 1; }
.wb-slide-down-leave-to { transform: translateX(-50%) translateY(-16px); opacity: 0; }

.wb-fade-up-enter-active,
.wb-fade-up-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.wb-fade-up-enter-from { transform: translateY(8px); opacity: 0; }
.wb-fade-up-enter-to { transform: translateY(0); opacity: 1; }
.wb-fade-up-leave-from { transform: translateY(0); opacity: 1; }
.wb-fade-up-leave-to { transform: translateY(8px); opacity: 0; }

.wb-toast-enter-active,
.wb-toast-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.wb-toast-enter-from { transform: translateX(-50%) translateY(8px); opacity: 0; }
.wb-toast-enter-to { transform: translateX(-50%) translateY(0); opacity: 1; }
.wb-toast-leave-from { transform: translateX(-50%) translateY(0); opacity: 1; }
.wb-toast-leave-to { transform: translateX(-50%) translateY(8px); opacity: 0; }

/* ── Reduced motion ────────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-slide-down-enter-active,
  .wb-slide-down-leave-active,
  .wb-fade-up-enter-active,
  .wb-fade-up-leave-active,
  .wb-toast-enter-active,
  .wb-toast-leave-active {
    transition: none;
  }

  .wb-follow-banner__pulse {
    animation: none;
  }

  .wb-follow-return {
    transition: none;
  }
}
</style>
