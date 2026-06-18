<!--
  PracticeProgressionView (/practice/worlds) — host F2 каркасу: таби Світи / Колекція.
  Працює коли backend FEATURE_PRACTICE_PROGRESSION=ON; інакше API 404 → 'unavailable'.
  Це інженерний каркас — візуал (мапа/трофейна кімната) накладе клод-дизайн.
-->
<template>
  <div class="prog">
    <h1 class="prog__title">{{ t('practice.title') }}</h1>

    <div class="prog__tabs">
      <button
        type="button"
        class="prog__tab"
        :class="{ 'is-active': tab === 'worlds' }"
        @click="tab = 'worlds'"
      >{{ t('practice.progress.worldsTab') }}</button>
      <button
        type="button"
        class="prog__tab"
        :class="{ 'is-active': tab === 'collection' }"
        @click="tab = 'collection'"
      >{{ t('practice.progress.collectionTab') }}</button>
    </div>

    <div v-if="store.status === 'loading'" class="prog__msg">{{ t('practice.progress.loading') }}</div>
    <div v-else-if="store.status === 'unavailable'" class="prog__msg">{{ t('practice.progress.unavailable') }}</div>
    <div v-else-if="store.status === 'error'" class="prog__msg prog__msg--err">{{ store.error }}</div>

    <template v-else-if="store.status === 'ready'">
      <WorldsMap v-if="tab === 'worlds'" :worlds="store.worlds" />
      <ArtifactCollection v-else-if="store.collection" :collection="store.collection" :worlds="store.worlds" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePracticeWorldsStore } from '../stores/practiceWorldsStore'
import ArtifactCollection from '../components/ArtifactCollection.vue'
import WorldsMap from '../components/WorldsMap.vue'

const { t } = useI18n()
const store = usePracticeWorldsStore()
const tab = ref<'worlds' | 'collection'>('worlds')

onMounted(() => store.load())
</script>

<style scoped>
.prog { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
.prog__title { font-size: 22px; font-weight: 500; margin-bottom: 12px; }
.prog__tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.prog__tab { padding: 8px 14px; border: 1px solid var(--border-color, rgba(0,0,0,0.12)); border-radius: 8px; background: transparent; cursor: pointer; font-size: 14px; color: var(--text-secondary, #555); }
.prog__tab.is-active { background: var(--accent, #047857); color: #fff; border-color: var(--accent, #047857); }
.prog__msg { padding: 24px 0; color: var(--text-secondary, #555); }
.prog__msg--err { color: #a02d2d; }
</style>
