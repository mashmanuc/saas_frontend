<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  bio: string
}

const props = defineProps<Props>()

const { t } = useI18n()

const bioHtml = computed(() => {
  const v = typeof props.bio === 'string' ? props.bio.trim() : ''
  return v.length > 0 ? v : `<p>${t('common.notSpecified')}</p>`
})
</script>

<template>
  <section class="profile-about">
    <h2>{{ t('marketplace.catalog.tabs.about') }}</h2>
    <div class="bio" v-html="bioHtml" />
  </section>
</template>

<style scoped>
.profile-about {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

h2 {
  font: var(--font-headline);
  margin: 0 0 1rem;
  color: var(--text-primary);
}

.bio {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--text-secondary);
}

.bio :deep(p) {
  margin: 0 0 1rem;
}

.bio :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
