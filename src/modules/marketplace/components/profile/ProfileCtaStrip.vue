<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { computed } from 'vue'

interface Props {
  availableSlots?: number
  nextSlotLabel?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  availableSlots: 0,
  nextSlotLabel: null,
})

const { t } = useI18n()
const auth = useAuthStore()
const isAuthenticated = computed(() => auth.isAuthenticated)

const emit = defineEmits<{
  (e: 'scroll-calendar'): void
  (e: 'login-required'): void
}>()

function handleClick() {
  if (!isAuthenticated.value) {
    emit('login-required')
  } else {
    emit('scroll-calendar')
  }
}
</script>

<template>
  <div class="cta-strip">
    <div class="strip-info">
      <div class="strip-text">
        {{ t('marketplace.profileV3.ctaStrip.slotsThisWeek', { n: availableSlots || 8 }) }}
      </div>
      <div v-if="nextSlotLabel" class="strip-sub">
        {{ t('marketplace.profileV3.ctaStrip.nearest', { slot: nextSlotLabel }) }}
      </div>
    </div>
    <button class="btn-strip" @click="handleClick">
      {{ t('marketplace.profileV3.ctaStrip.pickTime') }} →
    </button>
  </div>
</template>

<style scoped>
.cta-strip {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 1.125rem 1.375rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: var(--shadow-sm, 0 1px 8px rgba(0,0,0,0.06));
  animation: fadeUp 0.35s ease 0.15s both;
}

.strip-text {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-primary);
}
.strip-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-top: 0.125rem;
}

.btn-strip {
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  border: none;
  border-radius: 10px;
  padding: 0.625rem 1.125rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  font-family: inherit;
}
.btn-strip:hover {
  background: var(--accent-hover);
}

@media (max-width: 500px) {
  .cta-strip {
    flex-direction: column;
    text-align: center;
  }
  .btn-strip { width: 100%; }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
