<!-- PracticeHomeView (/practice) — чузер теми → PracticePathView. MVP, без карти/світів. -->
<template>
  <div class="phome">
    <h1 class="phome__title">{{ t('practice.title') }}</h1>

    <PracticePathView v-if="selectedTopic" :topic="selectedTopic" @back="onBack" />

    <template v-else>
      <ProgressHeader :profile="store.profile" :path="null" />
      <p class="phome__hint">{{ t('practice.chooseTopic') }}</p>
      <div v-for="world in store.topicWorlds" :key="world.world_id" class="phome__world">
        <h2 class="phome__world-title">{{ world.world_title }}</h2>
        <div class="phome__grid">
          <button
            v-for="topic in world.topics"
            :key="topic.slug"
            type="button"
            class="phome__topic"
            @click="selectedTopic = topic.slug"
          >
            {{ topic.label }}
          </button>
        </div>
      </div>
    </template>

    <CelebrationModal
      v-if="store.pendingUnlocks.length"
      :key="store.pendingUnlocks[0].id"
      :artifact="store.pendingUnlocks[0]"
      @close="store.dismissUnlock()"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePracticeStore } from '../stores/practiceStore'
import CelebrationModal from '../components/CelebrationModal.vue'
import ProgressHeader from '../components/ProgressHeader.vue'
import PracticePathView from '../components/PracticePathView.vue'

const { t } = useI18n()
const store = usePracticeStore()
const selectedTopic = ref<string | null>(null)

onMounted(() => {
  store.loadProfile()
  store.loadTopics()  // #2: server-authoritative теми
})

function onBack() {
  selectedTopic.value = null
  store.reset()
  store.loadProfile()
}
</script>

<style scoped>
.phome { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
.phome__title { font-size: 22px; font-weight: 500; margin-bottom: 12px; }
.phome__hint { font-size: 14px; opacity: 0.7; margin: 12px 0; }
.phome__world { margin-bottom: 20px; }
.phome__world-title { font-size: 15px; font-weight: 600; opacity: 0.85; margin: 0 0 8px; }
.phome__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.phome__topic { padding: 14px 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; background: transparent; cursor: pointer; font-size: 14px; text-align: left; }
.phome__topic:hover { border-color: #3B6D11; background: rgba(59,109,17,0.05); }
</style>
