<script setup lang="ts">
import { CalendarDays, MessageCircle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { computed } from 'vue'

interface Props {
  tutorName: string
  hourlyRate: number
  currency?: string
  responseTimeHours?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  currency: 'UAH',
  responseTimeHours: null,
})

const { t } = useI18n()
const auth = useAuthStore()
const isAuthenticated = computed(() => auth.isAuthenticated)

const emit = defineEmits<{
  (e: 'scroll-calendar'): void
  (e: 'inquiry'): void
  (e: 'login-required'): void
}>()

const priceText = computed(() => {
  const cur = props.currency === 'UAH' ? t('marketplace.profileV3.cta.uah') : props.currency
  return `${props.hourlyRate} ${cur}/${t('marketplace.profileV3.cta.hour')}`
})

const responseText = computed(() => {
  if (props.responseTimeHours && props.responseTimeHours > 0) {
    return t('marketplace.profileV3.hero.respondsIn', { hours: props.responseTimeHours })
  }
  return null
})

function handleBook() {
  if (!isAuthenticated.value) {
    emit('login-required')
  } else {
    emit('inquiry')
  }
}

function handleAsk() {
  if (!isAuthenticated.value) {
    emit('login-required')
  } else {
    emit('inquiry')
  }
}
</script>

<template>
  <div class="sticky-bar">
    <div class="sticky-left">
      <span class="sticky-name">{{ tutorName }}</span>
      <span class="sticky-price">· {{ priceText }}</span>
      <span v-if="responseText" class="sticky-price">· {{ responseText }}</span>
    </div>
    <div class="sticky-right">
      <button class="btn-sticky-ghost" @click="handleAsk">
        <MessageCircle :size="14" />
        {{ t('marketplace.profileV3.cta.askFirst') }}
      </button>
      <button class="btn-sticky-main" @click="handleBook">
        <CalendarDays :size="14" />
        {{ t('marketplace.profileV3.sticky.book') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sticky-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--border-color);
  padding: 0.625rem 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.07);
}

.sticky-left {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.sticky-name {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--text-primary);
}
.sticky-price {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.sticky-right {
  display: flex;
  gap: 0.5rem;
}

.btn-sticky-ghost {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 9px;
  padding: 0.5625rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.btn-sticky-ghost:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
}

.btn-sticky-main {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  border: none;
  border-radius: 9px;
  padding: 0.5625rem 1.125rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}
.btn-sticky-main:hover {
  background: var(--accent-hover);
}

@media (max-width: 600px) {
  .sticky-bar {
    padding: 0.5rem 1rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  .sticky-left { display: none; }
  .sticky-right { width: 100%; }
  .btn-sticky-main { flex: 1; justify-content: center; }
  .btn-sticky-ghost { flex: 1; justify-content: center; }
}
</style>
