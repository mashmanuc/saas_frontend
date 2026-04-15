<template>
  <section
    class="dashboard-hero"
    :class="[`dashboard-hero--${cta.urgency}`, `dashboard-hero--${cta.type}`]"
    :data-testid="`dashboard-hero-${cta.type}`"
  >
    <div class="dashboard-hero__body">
      <h2 class="dashboard-hero__title">
        <span v-if="cta.urgency === 'high'" class="dashboard-hero__pulse" aria-hidden="true"></span>
        {{ titleText }}
      </h2>
      <p v-if="cta.subtitle" class="dashboard-hero__subtitle">
        {{ cta.subtitle }}
      </p>
    </div>

    <div class="dashboard-hero__action">
      <a
        :href="cta.action_url"
        class="dashboard-hero__btn"
        :class="`dashboard-hero__btn--${cta.urgency}`"
        :data-testid="`dashboard-hero-btn-${cta.type}`"
        :aria-busy="isNavigating ? 'true' : 'false'"
        @click.prevent="handleCtaClick"
      >
        {{ labelText }}
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { PrimaryCta } from '../api/dashboard'
import apiClient from '@/utils/apiClient'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  cta: PrimaryCta
}>()

const { t } = useI18n()
const router = useRouter()

// ============================================================
// Fix #3: Countdown drift — anchor на Date.now() замість decrement
// ============================================================
// Зберігаємо `startsAtMs` як абсолютний timestamp.
// На кожен tick remaining = startsAtMs - Date.now() — не дрейфує при throttled setInterval.
const startsAtMs = ref<number | null>(null)
const nowTick = ref(Date.now())
let tickInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (props.cta.type === 'join_lesson' && !props.cta.metadata?.is_in_progress) {
    const starts = Number(props.cta.metadata?.starts_in_seconds)
    if (!Number.isNaN(starts) && starts > 0) {
      startsAtMs.value = Date.now() + starts * 1000
      // Тік раз на 15с — смуги між «мин» точніші на UI
      tickInterval = setInterval(() => {
        nowTick.value = Date.now()
      }, 15_000)
    }
  }
})

onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval)
})

const titleText = computed(() => {
  if (props.cta.type === 'join_lesson') {
    if (props.cta.metadata?.is_in_progress) {
      return t('dashboard.cta.join_lesson.in_progress')
    }
    if (startsAtMs.value !== null) {
      const remainingMs = startsAtMs.value - nowTick.value
      if (remainingMs <= 60_000) {
        return t('dashboard.cta.join_lesson.now')
      }
      const mins = Math.ceil(remainingMs / 60_000)
      return t('dashboard.cta.join_lesson.minutes', {
        minutes: mins,
        ...props.cta.title_params,
      })
    }
  }
  return t(props.cta.title_key, props.cta.title_params as Record<string, unknown>)
})

const labelText = computed(() => t(props.cta.label_key))

// ============================================================
// Fix #2: Dead link protection — preflight перед navigation
// ============================================================
const isNavigating = ref(false)

async function handleCtaClick() {
  if (isNavigating.value) return
  isNavigating.value = true

  try {
    // Preflight тільки для CTA-типів, де URL веде у classroom (конкретний booking),
    // який може бути видалений/скасований між рендером і кліком.
    // Для resume_draft/resume_last_lesson — URL веде на список з ?open=, тож preflight не потрібен.
    const needsPreflight =
      props.cta.type === 'join_lesson' ||
      props.cta.type === 'prepare_lesson'

    if (needsPreflight) {
      const ok = await preflightCheck(props.cta)
      if (!ok) {
        notifyError(t('dashboard.cta.dead_link'))
        // Ресет snapshot щоб home зʼявив оновлений CTA (урок міг перетекти у статус completed тощо)
        router.replace({ path: router.currentRoute.value.path, query: { _: String(Date.now()) } })
        return
      }
    }

    await router.push(props.cta.action_url)
  } catch (err) {
    console.warn('[DashboardHero] navigation failed:', err)
    notifyError(t('dashboard.cta.dead_link'))
  } finally {
    isNavigating.value = false
  }
}

async function preflightCheck(cta: PrimaryCta): Promise<boolean> {
  try {
    if (cta.type === 'join_lesson' || cta.type === 'prepare_lesson') {
      const bookingId = cta.metadata?.booking_id as string | undefined
      if (!bookingId) return true // no id — skip preflight, just navigate
      await apiClient.get(`/v1/booking/bookings/${bookingId}/`)
      return true
    }
    if (cta.type === 'resume_draft' || cta.type === 'resume_last_lesson') {
      const lessonId = cta.metadata?.lesson_id as string | undefined
      if (!lessonId) return true
      await apiClient.get(`/v1/knowledge/my-lessons/${lessonId}/`)
      return true
    }
    return true
  } catch (err: unknown) {
    const httpErr = err as { response?: { status?: number } }
    const status = httpErr?.response?.status
    // Лише 404 / 410 — явно «мертве» посилання.
    // 403, 500, network — пропускаємо: можуть бути транзитивні (auth, backend hiccup).
    // Краще дати юзеру спробувати, ніж блокувати на помилковому сигналі.
    if (status === 404 || status === 410) {
      return false
    }
    return true
  }
}
</script>

<style scoped>
.dashboard-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg, 16px);
  padding: clamp(16px, 3vw, 32px);
  border-radius: var(--radius-lg, 12px);
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.dashboard-hero--high {
  border-color: var(--color-error, #dc2626);
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.04), rgba(220, 38, 38, 0.02));
}

.dashboard-hero--medium {
  border-color: var(--color-warning, #ea580c);
  background: linear-gradient(135deg, rgba(234, 88, 12, 0.04), rgba(234, 88, 12, 0.02));
}

.dashboard-hero--low {
  border-color: var(--border-color, #e5e7eb);
}

.dashboard-hero__body {
  flex: 1;
  min-width: 0;
}

.dashboard-hero__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 8px);
  margin: 0 0 var(--space-xs, 4px);
  font-size: clamp(1.25rem, 2.5vw, 1.75rem);
  font-weight: 700;
  color: var(--text-primary, #111827);
  line-height: 1.2;
}

.dashboard-hero__subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary, #6b7280);
}

.dashboard-hero__pulse {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-error, #dc2626);
  box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6);
  animation: hero-pulse 1.6s infinite;
  flex-shrink: 0;
}

@keyframes hero-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(220, 38, 38, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
  }
}

.dashboard-hero__action {
  flex-shrink: 0;
}

.dashboard-hero__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  min-width: 160px;
  padding: 0 var(--space-lg, 24px);
  border-radius: var(--radius-md, 8px);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.1s ease, background 0.2s ease, opacity 0.2s ease;
  cursor: pointer;
}

.dashboard-hero__btn[aria-busy='true'] {
  opacity: 0.7;
  cursor: progress;
}

.dashboard-hero__btn--high {
  background: var(--color-error, #dc2626);
  color: #fff;
}
.dashboard-hero__btn--high:hover {
  background: color-mix(in srgb, var(--color-error, #dc2626) 88%, #000);
}

.dashboard-hero__btn--medium {
  background: var(--color-warning, #ea580c);
  color: #fff;
}
.dashboard-hero__btn--medium:hover {
  background: color-mix(in srgb, var(--color-warning, #ea580c) 88%, #000);
}

.dashboard-hero__btn--low {
  background: var(--accent, #10b981);
  color: #fff;
}
.dashboard-hero__btn--low:hover {
  background: color-mix(in srgb, var(--accent, #10b981) 88%, #000);
}

.dashboard-hero__btn:active {
  transform: translateY(1px);
}

@media (max-width: 640px) {
  .dashboard-hero {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  .dashboard-hero__title {
    justify-content: center;
  }
  .dashboard-hero__btn {
    width: 100%;
  }
}
</style>
