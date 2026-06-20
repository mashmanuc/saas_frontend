<!--
  PracticeCampaignView (/practice/campaign) — F3 World-System host.
  Вантажить кампанію + асет-манифест з /campaign/; рендерить CampaignMap.
  backend FEATURE_PRACTICE_PROGRESSION=OFF → API 404 → 'unavailable'.
-->
<template>
  <div class="camp">
    <div v-if="store.status === 'loading'" class="camp__msg">{{ t('practice.progress.loading') }}</div>
    <div v-else-if="store.status === 'unavailable'" class="camp__msg">{{ t('practice.progress.unavailable') }}</div>
    <div v-else-if="store.status === 'error'" class="camp__msg camp__msg--err">{{ store.error }}</div>
    <CampaignMap
      v-else-if="store.status === 'ready' && store.campaign"
      :campaign="store.campaign"
      :manifest="store.manifest"
      @play="onPlay"
    />

    <CampaignStepPlayer
      v-if="playing"
      :world="playing.world"
      :step="playing.step"
      @close="playing = null"
      @advance="onAdvance"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePracticeCampaignStore } from '../stores/practiceCampaignStore'
import type { CampaignState } from '../api/practiceApi'
import CampaignMap from '../components/CampaignMap.vue'
import CampaignStepPlayer from '../components/CampaignStepPlayer.vue'

const { t } = useI18n()
const store = usePracticeCampaignStore()
const playing = ref<{ world: number; step: number } | null>(null)

function onPlay(payload: { world: number; step: number }) {
  playing.value = payload
}

// correct → закрити вікно, тоді (наступний tick, оверлей уже зник) застосувати новий
// стан → watcher карти → пішак повільно ковзає на наступну сходинку (видимий перехід).
function onAdvance(newCampaign: CampaignState) {
  playing.value = null
  nextTick(() => store.applyCampaign(newCampaign))
}

onMounted(() => store.load())
</script>

<style scoped>
.camp { min-height: 60vh; }
.camp__msg { padding: 32px 16px; text-align: center; color: var(--text-secondary, #555); }
.camp__msg--err { color: #a02d2d; }
</style>
