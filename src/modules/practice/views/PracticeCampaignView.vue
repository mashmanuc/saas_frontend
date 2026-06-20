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
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePracticeCampaignStore } from '../stores/practiceCampaignStore'
import CampaignMap from '../components/CampaignMap.vue'

const { t } = useI18n()
const store = usePracticeCampaignStore()

onMounted(() => store.load())
</script>

<style scoped>
.camp { min-height: 60vh; }
.camp__msg { padding: 32px 16px; text-align: center; color: var(--text-secondary, #555); }
.camp__msg--err { color: #a02d2d; }
</style>
