<script setup lang="ts">
import { Shield } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { computed } from 'vue'

const { t } = useI18n()
const auth = useAuthStore()
const isAuthenticated = computed(() => auth.isAuthenticated)

const emit = defineEmits<{
  (e: 'inquiry'): void
  (e: 'login-required'): void
}>()

function handleClick() {
  if (!isAuthenticated.value) {
    emit('login-required')
  } else {
    emit('inquiry')
  }
}
</script>

<template>
  <div class="new-tutor-card">
    <div class="nt-badge">
      {{ t('marketplace.profileV3.newTutor.badge') }}
    </div>
    <p class="nt-text">
      {{ t('marketplace.profileV3.newTutor.description') }}
    </p>
    <div class="nt-guarantee">
      <Shield :size="14" />
      {{ t('marketplace.profileV3.newTutor.guarantee') }}
    </div>
    <button class="btn-ghost-sm" @click="handleClick">
      {{ t('marketplace.profileV3.newTutor.pickTime') }} ↓
    </button>
  </div>
</template>

<style scoped>
.new-tutor-card {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm, 0 1px 8px rgba(0,0,0,0.06));
  padding: 1.25rem 1.375rem;
  animation: fadeUp 0.35s ease 0.15s both;
}

.nt-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  border-radius: 6px;
  padding: 0.2rem 0.5625rem;
  font-size: 0.6875rem;
  font-weight: 800;
  margin-bottom: 0.625rem;
}

.nt-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 600;
  line-height: 1.6;
  margin: 0 0 0.875rem;
}

.nt-guarantee {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.btn-ghost-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 11px;
  padding: 0.5625rem 0.875rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.15s;
  font-family: inherit;
}
.btn-ghost-sm:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
