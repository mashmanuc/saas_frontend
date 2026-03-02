<template>
  <div class="learning-content-view">
    <header class="learning-content-header">
      <h1>{{ t('learningContent.panel.title') }}</h1>
      <p class="subtitle">{{ t('learningContent.view.subtitle') }}</p>
    </header>

    <div class="learning-content-container">
      <ContentPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ContentPanel from '../components/ContentPanel.vue'

const { t } = useI18n()
</script>

<style scoped>
.learning-content-view {
  min-height: 100vh;
  background: var(--bg-primary, #ffffff);
  padding: 2rem;
}

.learning-content-header {
  max-width: 1400px;
  margin: 0 auto 2rem;
}

.learning-content-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary, #1a202c);
  margin: 0 0 0.5rem 0;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.learning-content-container {
  max-width: 1400px;
  margin: 0 auto;
  background: var(--card-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  height: calc(100vh - 200px);
}

@media (max-width: 768px) {
  .learning-content-view {
    padding: 1rem;
  }

  .learning-content-header h1 {
    font-size: 1.5rem;
  }

  .learning-content-container {
    height: calc(100vh - 150px);
  }
}
</style>
