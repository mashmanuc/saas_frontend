<template>
  <div class="lesson-links-view">
    <nav class="lesson-links-tabs" aria-label="Tutor profile steps">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.id"
        :to="tab.to"
        class="lesson-links-tab"
        :class="{
          'lesson-links-tab--active': tab.id === activeTab,
          'lesson-links-tab--publish': tab.id === 'publish'
        }"
      >
        {{ t(tab.labelKey) }}
      </RouterLink>
    </nav>

    <LessonLinksEditor @cancel="handleCancel" />
  </div>

  <div class="lesson-links-navigation">
    <Button
      v-if="previousTab"
      variant="outline"
      pill
      @click="goToTab(previousTab)"
    >
      {{ t(previousTab.labelKey) }}
    </Button>
    <Button
      v-if="nextTab"
      variant="danger"
      pill
      @click="goToTab(nextTab)"
    >
      {{ t(nextTab.labelKey) }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LessonLinksEditor from '@/modules/booking/components/lessonLinks/LessonLinksEditor.vue'
import Button from '@/ui/Button.vue'

const { t } = useI18n()
const router = useRouter()
const activeTab = 'lesson-links'
const tabs = [
  { id: 'photo', labelKey: 'marketplace.profile.editor.photoTitle', to: { name: 'marketplace-my-profile', query: { step: 'photo' } } },
  { id: 'basic', labelKey: 'marketplace.profile.editor.basicTitle', to: { name: 'marketplace-my-profile', query: { step: 'basic' } } },
  { id: 'subjects', labelKey: 'marketplace.profile.editor.subjectsLanguagesTitle', to: { name: 'marketplace-my-profile', query: { step: 'subjects' } } },
  { id: 'pricing', labelKey: 'marketplace.profile.editor.pricingTitle', to: { name: 'marketplace-my-profile', query: { step: 'pricing' } } },
  { id: 'video', labelKey: 'marketplace.profile.editor.videoTitle', to: { name: 'marketplace-my-profile', query: { step: 'video' } } },
  { id: 'privacy', labelKey: 'marketplace.profile.editor.privacyTitle', to: { name: 'marketplace-my-profile', query: { step: 'privacy' } } },
  {
    id: 'lesson-links',
    labelKey: 'marketplace.profile.editor.lessonLinksTitle',
    to: { name: 'tutor-lesson-links' },
  },
  {
    id: 'publish',
    labelKey: 'marketplace.profile.publish',
    to: { name: 'marketplace-my-profile', query: { step: 'publish' } },
  }
]
const previousTab = tabs.find((tab) => tab.id === 'privacy')
const nextTab = tabs.find((tab) => tab.id === 'publish')

function goToTab(tab?: (typeof tabs)[number]) {
  if (!tab) return
  router.push(tab.to)
}

function handleCancel() {
  if (previousTab) {
    goToTab(previousTab)
  } else {
    router.back()
  }
}
</script>

<style scoped>
.lesson-links-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.lesson-links-tab {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
}

.lesson-links-tab--active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.lesson-links-tab--publish {
  border-color: var(--danger);
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 20%, transparent);
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(185, 28, 28, 0.15);
}

.lesson-links-tab--publish.lesson-links-tab--active {
  border-color: var(--danger);
  color: white;
  background: var(--danger);
  box-shadow: 0 6px 16px rgba(185, 28, 28, 0.3);
}

.lesson-links-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  min-height: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.lesson-links-navigation {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
}


@media (max-width: 640px) {
  .lesson-links-view {
    padding: 16px;
  }

  .lesson-links-navigation {
    flex-direction: column;
    align-items: stretch;
  }

  .nav-button {
    width: 100%;
    text-align: center;
  }
}
</style>
