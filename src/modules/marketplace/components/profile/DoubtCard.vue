<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { computed } from 'vue'

interface Props {
  tutorName: string
}

defineProps<Props>()

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
  <div class="doubt-card">
    <div class="doubt-label">{{ t('marketplace.profileV3.doubt.label') }}</div>
    <p class="doubt-text">
      {{ t('marketplace.profileV3.doubt.text', { name: tutorName }) }}
    </p>
    <button class="btn-doubt" @click="handleClick">
      <MessageCircle :size="14" />
      {{ t('marketplace.profileV3.doubt.cta') }}
    </button>
  </div>
</template>

<style scoped>
.doubt-card {
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 1rem 1.125rem;
  opacity: 0.85;
  animation: fadeUp 0.35s ease 0.15s both;
}

.doubt-label {
  font-size: 0.6875rem;
  font-weight: 800;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.doubt-text {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 600;
  line-height: 1.55;
  margin: 0 0 0.625rem;
}

.btn-doubt {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem 0.875rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  transition: all 0.15s;
  font-family: inherit;
}
.btn-doubt:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
