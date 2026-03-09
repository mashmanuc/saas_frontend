<template>
  <div class="dashboard-greeting">
    <h1 class="greeting-title">
      {{ greeting }}, {{ userName }}
    </h1>
    <p class="greeting-subtitle">
      {{ formattedDate }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'

const { t, locale } = useI18n()
const auth = useAuthStore()

const userName = computed(() => {
  return auth.user?.first_name || auth.user?.email?.split('@')[0] || ''
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return t('dashboard.greeting.morning')
  if (hour < 18) return t('dashboard.greeting.afternoon')
  return t('dashboard.greeting.evening')
})

const formattedDate = computed(() => {
  return new Intl.DateTimeFormat(locale.value || 'uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
})
</script>

<style scoped>
.dashboard-greeting {
  padding: 0;
}

.greeting-title {
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 600;
  color: var(--text-primary, var(--color-text-body));
  line-height: 1.3;
}

.greeting-subtitle {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, var(--color-text-muted));
  margin-top: var(--space-2xs, 4px);
}
</style>
