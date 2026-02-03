<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  bio: string
}

const props = defineProps<Props>()

const { t } = useI18n()

const bioText = computed(() => {
  if (props.bio && props.bio.trim().length > 0) {
    return props.bio
  }
  return t('marketplace.profile.about.notProvided')
})

const isEmpty = computed(() => !props.bio || props.bio.trim().length === 0)
</script>

<template>
  <section class="profile-about">
    <h2>{{ t('marketplace.catalog.tabs.about') }}</h2>
    <p class="bio" :class="{ 'bio-empty': isEmpty }" v-html="bioText" />
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
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.bio :deep(p) {
  margin: 0 0 1rem;
}

.bio :deep(p:last-child) {
  margin-bottom: 0;
}

.bio-empty {
  color: var(--text-muted);
  font-style: italic;
}
</style>
