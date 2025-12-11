<template>
  <div class="toast-stack" aria-live="polite">
    <TransitionGroup name="toast" tag="div">
      <article
        v-for="item in itemsWithMeta"
        :key="item.id"
        class="toast-card"
        :class="`toast-card--${item.type}`"
        :style="cardStyle(item)"
      >
        <div class="toast-icon" aria-hidden="true">
          {{ item.meta.icon }}
        </div>

        <div class="toast-body">
          <header>
            <p class="toast-title">{{ $t(`notify.types.${item.meta.labelKey}`) }}</p>
            <small>{{ item.meta.timestamp }}</small>
          </header>
          <p class="toast-message">
            {{ item.message }}
          </p>
          <div class="toast-progress">
            <div class="toast-progress__fill" :style="progressStyle(item)" />
          </div>
        </div>

        <button
          class="toast-dismiss"
          @click="dismiss(item.id)"
          :aria-label="$t('common.close')"
        >
          ×
        </button>
      </article>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useNotifyStore } from '../stores/notifyStore'

const notify = useNotifyStore()
const { items } = storeToRefs(notify)
const { t } = useI18n()

const TYPE_META = {
  success: { icon: '✨', accent: '#0ea355', labelKey: 'success' },
  error: { icon: '⛔', accent: '#ef4444', labelKey: 'error' },
  warning: { icon: '⚠️', accent: '#f59e0b', labelKey: 'warning' },
  info: { icon: '💡', accent: '#2563eb', labelKey: 'info' },
}

const toastMeta = (item) => {
  const meta = TYPE_META[item.type] || TYPE_META.info
  return {
    ...meta,
    timestamp: new Intl.DateTimeFormat(t('lang.en') ? 'en' : 'uk', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(item.timestamp),
  }
}

const itemsWithMeta = computed(() =>
  items.value.map((item) => ({
    ...item,
    meta: toastMeta(item),
  })),
)

const dismiss = (id) => notify.dismiss(id)

const cardStyle = (item) => ({
  '--toast-accent': item.meta.accent,
})

const progressStyle = (item) => {
  const elapsed = Date.now() - item.createdAt
  const progress = Math.max(0, Math.min(100, ((item.duration - elapsed) / item.duration) * 100))
  return {
    width: `${progress}%`,
  }
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: min(360px, 80vw);
  pointer-events: none;
}

.toast-card {
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 1.15rem;
  border: 1px solid color-mix(in srgb, var(--toast-accent) 40%, transparent);
  background: rgba(11, 17, 28, 0.92);
  color: #f8fafc;
  box-shadow: 0 25px 60px -30px rgba(11, 17, 28, 0.6);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.toast-card--success {
  background: linear-gradient(135deg, rgba(6, 79, 45, 0.95), rgba(15, 164, 92, 0.9));
}

.toast-card--error {
  background: linear-gradient(135deg, rgba(86, 13, 31, 0.95), rgba(207, 37, 62, 0.9));
}

.toast-card--warning {
  background: linear-gradient(135deg, rgba(92, 56, 8, 0.95), rgba(240, 146, 28, 0.9));
}

.toast-card--info {
  background: linear-gradient(135deg, rgba(13, 31, 86, 0.95), rgba(45, 93, 201, 0.9));
}

.toast-icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
  background: rgba(15, 15, 15, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.toast-body header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.toast-title {
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.01em;
}

.toast-body small {
  font-size: 0.75rem;
  opacity: 0.75;
}

.toast-message {
  margin: 0;
  font-size: 0.92rem;
}

.toast-progress {
  position: relative;
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  overflow: hidden;
}

.toast-progress__fill {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  transition: width 0.1s linear;
}

.toast-dismiss {
  color: inherit;
  opacity: 0.75;
  font-size: 1.3rem;
  line-height: 1;
  padding: 0.15rem;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.toast-dismiss:hover {
  opacity: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}
</style>
