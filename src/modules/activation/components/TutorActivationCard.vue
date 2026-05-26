<template>
  <Transition name="tutor-card-fade">
    <div v-if="isVisible" class="tutor-activation-card">
      <!-- Dismiss button (24h) -->
      <button
        class="tutor-activation-card__dismiss"
        title="Нагадати завтра"
        aria-label="Закрити"
        @click="dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- ── State A: Intent not set ─────────────────────────────── -->
      <template v-if="intentPending">
        <div class="tutor-activation-card__body">
          <p class="tutor-activation-card__eyebrow">Розкажи про себе</p>
          <h3 class="tutor-activation-card__title">Що ти хочеш робити на M4SH?</h3>
        </div>
        <div class="tutor-activation-card__intents">
          <button
            v-for="opt in INTENT_OPTIONS"
            :key="opt.value"
            class="tutor-activation-card__intent-btn"
            :disabled="isSaving"
            @click="selectIntent(opt.value)"
          >
            <span class="tutor-activation-card__intent-icon" aria-hidden="true">{{ opt.icon }}</span>
            {{ opt.label }}
          </button>
        </div>
      </template>

      <!-- ── State B: Intent set → Start card ───────────────────── -->
      <template v-else>
        <div class="tutor-activation-card__body">
          <p class="tutor-activation-card__eyebrow">Перший крок</p>
          <h3 class="tutor-activation-card__title">Створи свій перший інтерактивний урок</h3>
          <p class="tutor-activation-card__desc">
            Генеруй завдання для НМТ та веди заняття у реальному часі
          </p>
        </div>
        <div class="tutor-activation-card__footer">
          <!-- Студія уроків — тут спочатку створюється контент, потім відкривається дошка -->
          <router-link
            :to="{ name: 'winterboard-boards' }"
            class="tutor-activation-card__cta"
          >
            Відкрити студію уроків
          </router-link>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useActivation } from '@/modules/activation/composables/useActivation'
import type { PrimaryIntent } from '@/types/activation'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /** draft_lessons з dashboard snapshot — ховаємо картку якщо урок вже є */
  hasLesson?: boolean
}>()

// ── Activation ────────────────────────────────────────────────────────────────

const { state, recordIntent, dismissHint } = useActivation()

// ── Intent options (тільки tutor-path, SSOT §7) ───────────────────────────────

const INTENT_OPTIONS: Array<{ value: PrimaryIntent; label: string; icon: string }> = [
  { value: 'teach',          label: 'Підготувати урок',                     icon: '📝' },
  { value: 'find_tutor',     label: 'Працювати з учнями онлайн',            icon: '👥' },
  { value: 'prepare_nmt',    label: 'Створювати інтерактивні матеріали',    icon: '🎨' },
  { value: 'exploring',      label: 'Просто дивлюсь платформу',             icon: '👀' },
]

// ── Visibility ────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'tutor_activation_card_dismissed_until'

function isDismissed(): boolean {
  const until = localStorage.getItem(DISMISS_KEY)
  if (!until) return false
  return Date.now() < Number(until)
}

const dismissed = ref(isDismissed())

const isVisible = computed<boolean>(() => {
  if (dismissed.value) return false
  if (props.hasLesson) return false   // урок вже є — ціль досягнута
  return true
})

const intentPending = computed<boolean>(() => !state.value?.intent_set_at)

// ── Actions ───────────────────────────────────────────────────────────────────

const isSaving = ref(false)

async function selectIntent(intent: PrimaryIntent): Promise<void> {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await recordIntent(intent)
    // Після intent → показуємо Start card (intentPending стане false автоматично)
  } finally {
    isSaving.value = false
  }
}

function dismiss(): void {
  // 24h dismiss — localStorage для UX, API для analytics (non-blocking)
  const until = Date.now() + 24 * 60 * 60 * 1000
  localStorage.setItem(DISMISS_KEY, String(until))
  dismissed.value = true

  // fire-and-forget (INV-ACT-10)
  void dismissHint('hint.tutor_start', false)
}
</script>

<style scoped>
.tutor-activation-card {
  position: relative;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-lg, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 12px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

/* ── Dismiss ── */
.tutor-activation-card__dismiss {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted, #9ca3af);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tutor-activation-card__dismiss:hover {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary, #111827);
}

/* ── Body ── */
.tutor-activation-card__eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-primary, #2563eb);
  margin: 0;
}
.tutor-activation-card__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #111827);
  margin: 4px 0 0;
  padding-right: 24px; /* space for dismiss */
}
.tutor-activation-card__desc {
  font-size: 14px;
  color: var(--text-muted, #6b7280);
  margin: 4px 0 0;
}

/* ── Intent buttons ── */
.tutor-activation-card__intents {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.tutor-activation-card__intent-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  background: var(--bg-secondary, #f9fafb);
  color: var(--text-primary, #111827);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: left;
}
.tutor-activation-card__intent-btn:hover:not(:disabled) {
  border-color: var(--color-primary, #2563eb);
  background: var(--bg-card, #fff);
}
.tutor-activation-card__intent-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.tutor-activation-card__intent-icon {
  font-size: 16px;
  flex-shrink: 0;
}

/* ── CTA ── */
.tutor-activation-card__footer {
  display: flex;
}
.tutor-activation-card__cta {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  background: var(--color-primary, #2563eb);
  color: #fff;
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
}
.tutor-activation-card__cta:hover {
  background: var(--color-primary-dark, #1d4ed8);
}

/* ── Transition ── */
.tutor-card-fade-enter-active,
.tutor-card-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.tutor-card-fade-enter-from,
.tutor-card-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
