<template>
  <div class="wb-notifications" :aria-label="t('winterboard.a11y.notifications')">
    <!-- Persistent connection banner -->
    <Transition name="wb-notif-slide">
      <div
        v-if="connectionLost"
        class="wb-notifications__banner wb-notifications__banner--error"
        role="alert"
        aria-live="assertive"
      >
        <span class="wb-notifications__banner-icon" aria-hidden="true">⚡</span>
        <span>{{ t('winterboard.classroom.notifications.connectionLost') }}</span>
      </div>
    </Transition>

    <!-- Auto-save indicator (subtle, not toast) -->
    <Transition name="wb-notif-fade">
      <div
        v-if="showSavedIndicator"
        class="wb-notifications__saved"
        role="status"
        aria-live="polite"
      >
        <span class="wb-notifications__saved-dot" aria-hidden="true" />
        <span>{{ t('winterboard.classroom.notifications.saved') }}</span>
      </div>
    </Transition>

    <!-- Toast stack (max 3 visible) -->
    <TransitionGroup
      name="wb-notif-toast"
      tag="div"
      class="wb-notifications__stack"
    >
      <div
        v-for="toast in visibleToasts"
        :key="toast.id"
        class="wb-notifications__toast"
        :class="`wb-notifications__toast--${toast.style}`"
        :role="toast.important ? 'alert' : 'status'"
        :aria-live="toast.important ? 'assertive' : 'polite'"
      >
        <span class="wb-notifications__toast-text">{{ toast.message }}</span>
        <a
          v-if="toast.href"
          :href="toast.href"
          class="wb-notifications__toast-link"
        >
          {{ toast.linkText }}
        </a>
        <button
          type="button"
          class="wb-notifications__toast-close"
          :aria-label="t('winterboard.a11y.dismiss')"
          @click="dismissToast(toast.id)"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>

    <!-- Preferences toggle (bottom-left) -->
    <div v-if="showPreferences" class="wb-notifications__prefs">
      <button
        type="button"
        class="wb-notifications__pref-btn"
        :title="soundEnabled
          ? t('winterboard.classroom.notifications.soundOn')
          : t('winterboard.classroom.notifications.soundOff')"
        :aria-pressed="soundEnabled"
        @click="toggleSound"
      >
        {{ soundEnabled ? '🔊' : '🔇' }}
      </button>
      <button
        type="button"
        class="wb-notifications__pref-btn"
        :title="joinLeaveEnabled
          ? t('winterboard.classroom.notifications.joinLeaveOn')
          : t('winterboard.classroom.notifications.joinLeaveOff')"
        :aria-pressed="joinLeaveEnabled"
        @click="toggleJoinLeave"
      >
        {{ joinLeaveEnabled ? '👥' : '👤' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationStyle = 'info' | 'success' | 'warning' | 'error'

export interface ClassroomToast {
  id: string
  message: string
  style: NotificationStyle
  important: boolean
  href?: string
  linkText?: string
  duration: number
}

export interface WBClassroomNotificationsProps {
  /** Whether the WebSocket connection is lost */
  connectionLost: boolean
  /** Whether auto-save just completed (flash indicator) */
  justSaved: boolean
  /** Whether to show preferences toggles */
  showPreferences: boolean
}

export interface WBClassroomNotificationsEmits {
  (e: 'redirect', path: string): void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_VISIBLE_TOASTS = 3
const DEFAULT_TOAST_DURATION_MS = 4_000
const SAVED_INDICATOR_DURATION_MS = 2_000
const STORAGE_KEY_SOUND = 'wb-notif-sound'
const STORAGE_KEY_JOIN_LEAVE = 'wb-notif-join-leave'

// ─── Props & Emits ──────────────────────────────────────────────────────────

const props = defineProps<WBClassroomNotificationsProps>()
const emit = defineEmits<WBClassroomNotificationsEmits>()
const { t } = useI18n()

// ─── State ──────────────────────────────────────────────────────────────────

const toasts = ref<ClassroomToast[]>([])
const showSavedIndicator = ref(false)

const soundEnabled = ref(loadPref(STORAGE_KEY_SOUND, true))
const joinLeaveEnabled = ref(loadPref(STORAGE_KEY_JOIN_LEAVE, true))

let toastIdCounter = 0
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()
let savedTimer: ReturnType<typeof setTimeout> | null = null

// ─── Computed ───────────────────────────────────────────────────────────────

const visibleToasts = computed(() => toasts.value.slice(0, MAX_VISIBLE_TOASTS))

// ─── Preferences ────────────────────────────────────────────────────────────

function loadPref(key: string, defaultVal: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultVal
    return stored === 'true'
  } catch {
    return defaultVal
  }
}

function savePref(key: string, val: boolean): void {
  try {
    localStorage.setItem(key, String(val))
  } catch {
    // localStorage unavailable
  }
}

function toggleSound(): void {
  soundEnabled.value = !soundEnabled.value
  savePref(STORAGE_KEY_SOUND, soundEnabled.value)
}

function toggleJoinLeave(): void {
  joinLeaveEnabled.value = !joinLeaveEnabled.value
  savePref(STORAGE_KEY_JOIN_LEAVE, joinLeaveEnabled.value)
}

// ─── Toast management ───────────────────────────────────────────────────────

function addToast(opts: {
  message: string
  style?: NotificationStyle
  important?: boolean
  href?: string
  linkText?: string
  duration?: number
}): string {
  const id = `toast-${++toastIdCounter}`
  const toast: ClassroomToast = {
    id,
    message: opts.message,
    style: opts.style ?? 'info',
    important: opts.important ?? false,
    href: opts.href,
    linkText: opts.linkText,
    duration: opts.duration ?? DEFAULT_TOAST_DURATION_MS,
  }

  toasts.value = [toast, ...toasts.value]

  // Auto-dismiss
  if (toast.duration > 0) {
    const timer = setTimeout(() => dismissToast(id), toast.duration)
    toastTimers.set(id, timer)
  }

  // Play sound if enabled
  if (soundEnabled.value && !toast.important) {
    playChime()
  }

  return id
}

function dismissToast(id: string): void {
  const timer = toastTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    toastTimers.delete(id)
  }
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function clearAllToasts(): void {
  for (const timer of toastTimers.values()) clearTimeout(timer)
  toastTimers.clear()
  toasts.value = []
}

// ─── Notification methods (public API) ──────────────────────────────────────

function notifyJoin(name: string): void {
  if (!joinLeaveEnabled.value) return
  addToast({
    message: t('winterboard.classroom.notifications.joined', { name }),
    style: 'info',
  })
}

function notifyLeave(name: string): void {
  if (!joinLeaveEnabled.value) return
  addToast({
    message: t('winterboard.classroom.notifications.left', { name }),
    style: 'info',
  })
}

function notifyLocked(): void {
  addToast({
    message: t('winterboard.classroom.notifications.locked'),
    style: 'warning',
    important: true,
  })
}

function notifyUnlocked(): void {
  addToast({
    message: t('winterboard.classroom.notifications.unlocked'),
    style: 'success',
  })
}

function notifyKicked(): void {
  addToast({
    message: t('winterboard.classroom.notifications.kicked'),
    style: 'error',
    important: true,
    duration: 5_000,
  })
  // Redirect after short delay
  setTimeout(() => emit('redirect', '/winterboard'), 2_000)
}

function notifyEnded(): void {
  addToast({
    message: t('winterboard.classroom.notifications.ended'),
    style: 'warning',
    important: true,
    duration: 5_000,
  })
  // Redirect after short delay
  setTimeout(() => emit('redirect', '/winterboard'), 2_000)
}

function notifyExportReady(downloadUrl: string): void {
  addToast({
    message: t('winterboard.classroom.notifications.exportReady'),
    style: 'success',
    href: downloadUrl,
    linkText: 'Download',
    duration: 10_000,
  })
}

// ─── Sound ──────────────────────────────────────────────────────────────────

function playChime(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = 'sine'
    gain.gain.value = 0.05
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Audio not available
  }
}

// ─── Saved indicator ────────────────────────────────────────────────────────

watch(
  () => props.justSaved,
  (saved) => {
    if (!saved) return
    showSavedIndicator.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      showSavedIndicator.value = false
    }, SAVED_INDICATOR_DURATION_MS)
  },
)

// ─── Cleanup ────────────────────────────────────────────────────────────────

onBeforeUnmount(() => {
  clearAllToasts()
  if (savedTimer) clearTimeout(savedTimer)
})

// ─── Expose public API ──────────────────────────────────────────────────────

defineExpose({
  notifyJoin,
  notifyLeave,
  notifyLocked,
  notifyUnlocked,
  notifyKicked,
  notifyEnded,
  notifyExportReady,
  addToast,
  dismissToast,
  clearAllToasts,
  soundEnabled,
  joinLeaveEnabled,
})
</script>

<style scoped>
/* ── Container ─────────────────────────────────────────────────────────────── */

.wb-notifications {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 60;
  overflow: hidden;
}

.wb-notifications > * {
  pointer-events: auto;
}

/* ── Connection banner ─────────────────────────────────────────────────────── */

.wb-notifications__banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 16px;
  font-size: 0.8125rem;
  font-weight: 500;
  z-index: 10;
}

.wb-notifications__banner--error {
  background: rgba(239, 68, 68, 0.95);
  color: white;
}

.wb-notifications__banner-icon {
  font-size: 0.875rem;
}

/* ── Saved indicator ───────────────────────────────────────────────────────── */

.wb-notifications__saved {
  position: absolute;
  top: 8px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  font-size: 0.6875rem;
  color: #16a34a;
  font-weight: 500;
}

.wb-notifications__saved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

/* ── Toast stack ───────────────────────────────────────────────────────────── */

.wb-notifications__stack {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 320px;
  z-index: 5;
}

.wb-notifications__toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.wb-notifications__toast--info {
  background: rgba(15, 23, 42, 0.85);
  color: white;
}

.wb-notifications__toast--success {
  background: rgba(34, 197, 94, 0.9);
  color: white;
}

.wb-notifications__toast--warning {
  background: rgba(234, 179, 8, 0.9);
  color: #422006;
}

.wb-notifications__toast--error {
  background: rgba(239, 68, 68, 0.9);
  color: white;
}

.wb-notifications__toast-text {
  flex: 1;
}

.wb-notifications__toast-link {
  color: inherit;
  text-decoration: underline;
  font-weight: 600;
  white-space: nowrap;
}

.wb-notifications__toast-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 4px;
  color: inherit;
  font-size: 0.625rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.wb-notifications__toast-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* ── Preferences ───────────────────────────────────────────────────────────── */

.wb-notifications__prefs {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  gap: 4px;
}

.wb-notifications__pref-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-notifications__pref-btn:hover {
  background: rgba(255, 255, 255, 1);
}

/* ── Transitions ───────────────────────────────────────────────────────────── */

.wb-notif-slide-enter-active,
.wb-notif-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.wb-notif-slide-enter-from { transform: translateY(-100%); opacity: 0; }
.wb-notif-slide-leave-to { transform: translateY(-100%); opacity: 0; }

.wb-notif-fade-enter-active,
.wb-notif-fade-leave-active {
  transition: opacity 0.3s ease;
}
.wb-notif-fade-enter-from,
.wb-notif-fade-leave-to { opacity: 0; }

.wb-notif-toast-enter-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.wb-notif-toast-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.wb-notif-toast-enter-from { transform: translateX(40px); opacity: 0; }
.wb-notif-toast-leave-to { transform: translateX(40px); opacity: 0; }
.wb-notif-toast-move {
  transition: transform 0.2s ease;
}

/* ── Reduced motion ────────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-notif-slide-enter-active,
  .wb-notif-slide-leave-active,
  .wb-notif-fade-enter-active,
  .wb-notif-fade-leave-active,
  .wb-notif-toast-enter-active,
  .wb-notif-toast-leave-active,
  .wb-notif-toast-move {
    transition: none;
  }
}
</style>
