<template>
  <div
    class="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    aria-live="polite"
  >
    <TransitionGroup name="toast" tag="div">
      <div
        v-for="item in itemsWithMeta"
        :key="item.id"
        class="toast-card"
        :style="{ '--toast-accent': item.meta.accent }"
      >
        <div class="toast-icon" aria-hidden="true">
          {{ item.meta.icon }}
        </div>

        <div class="flex-1 min-w-0">
          <p class="toast-title">{{ $t(`notify.types.${item.meta.labelKey}`) }}</p>
          <p class="toast-message">
            {{ item.message }}
          </p>
        </div>

        <button
          class="toast-dismiss"
          @click="dismiss(item.id)"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
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
useI18n() // ensure $t available in template

const TYPE_META = {
  success: { icon: '✔', accent: 'var(--success-bg)', labelKey: 'success' },
  error: { icon: '⚠', accent: 'var(--danger-bg)', labelKey: 'error' },
  warning: { icon: '!', accent: 'var(--warning-bg)', labelKey: 'warning' },
  info: { icon: 'ℹ', accent: 'var(--info-bg)', labelKey: 'info' },
}

const toastMeta = (type) => TYPE_META[type] || TYPE_META.info

const itemsWithMeta = computed(() =>
  items.value.map((item) => ({
    ...item,
    meta: toastMeta(item.type),
  }))
)

const dismiss = (id) => notify.dismiss(id)
</script>

<style scoped>
.toast-card {
  pointer-events: auto;
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, var(--toast-accent, var(--accent)) 40%, transparent);
  background-color: var(--toast-bg);
  color: var(--toast-text);
  box-shadow: 0 30px 70px -40px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(12px);
  align-items: center;
}

.toast-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  background-color: color-mix(in srgb, var(--toast-accent, var(--accent)) 80%, transparent);
  color: var(--accent-contrast);
}

.toast-title {
  font-weight: 600;
  text-transform: capitalize;
  margin-bottom: 0.15rem;
}

.toast-message {
  font-size: 0.875rem;
  opacity: 0.9;
  word-break: break-word;
}

.toast-dismiss {
  color: inherit;
  opacity: 0.7;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.125rem;
  transition: opacity 0.2s ease;
}

.toast-dismiss:hover {
  opacity: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}
</style>
