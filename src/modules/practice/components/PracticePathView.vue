<!-- PracticePathView — рантайм практики по темі: header + PuzzleCard. MVP. -->
<template>
  <div class="ppath">
    <button type="button" class="ppath__back" @click="emit('back')">← {{ t('practice.back') }}</button>

    <ProgressHeader :profile="store.profile" :path="store.path" />

    <div v-if="store.status === 'loading'" class="ppath__msg">{{ t('practice.loading') }}</div>

    <div v-else-if="store.status === 'error'" class="ppath__err">
      {{ store.error }}
      <button type="button" class="ppath__retry" @click="store.startTopic(topic)">{{ t('practice.card.retry') }}</button>
    </div>

    <div v-else-if="store.status === 'done'" class="ppath__done">
      <p>{{ t('practice.completed') }}</p>
      <button type="button" class="pcard__btn ppath__btn" @click="emit('back')">{{ t('practice.chooseAnother') }}</button>
    </div>

    <PuzzleCard
      v-else-if="store.currentPuzzle"
      :puzzle="store.currentPuzzle"
      :result="store.lastResult"
      :submitting="store.status === 'submitting'"
      @submit="onSubmit"
      @next="onNext"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePracticeStore } from '../stores/practiceStore'
import ProgressHeader from './ProgressHeader.vue'
import PuzzleCard from './PuzzleCard.vue'

const props = defineProps<{ topic: string }>()
const emit = defineEmits<{ (e: 'back'): void }>()
const { t } = useI18n()
const store = usePracticeStore()

onMounted(() => store.startTopic(props.topic))

function onSubmit(answer: Record<string, any>) {
  store.submit(answer)
}
function onNext() {
  store.loadNext(props.topic)
}
</script>

<style scoped>
.ppath { display: flex; flex-direction: column; gap: 8px; }
.ppath__back { align-self: flex-start; background: none; border: none; cursor: pointer; font-size: 14px; opacity: 0.7; padding: 4px 0; }
.ppath__msg { padding: 24px 0; opacity: 0.7; }
.ppath__err { padding: 16px 0; color: #a02d2d; }
.ppath__retry { margin-left: 12px; }
.ppath__done { padding: 24px 0; text-align: center; }
.ppath__btn { margin-top: 12px; }
</style>
