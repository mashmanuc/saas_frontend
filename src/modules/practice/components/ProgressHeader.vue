<!-- ProgressHeader — XP / стрік / прогрес стежки. MVP, без анімацій. -->
<template>
  <div class="prog">
    <div class="prog__stats">
      <span class="prog__stat">{{ t('practice.stat.xp') }}: <strong>{{ profile?.xp ?? 0 }}</strong></span>
      <span class="prog__stat">{{ t('practice.stat.streak') }}: <strong>{{ profile?.current_streak ?? 0 }}</strong></span>
    </div>
    <template v-if="path">
      <div class="prog__bar" :aria-label="t('practice.stat.progress')">
        <div class="prog__fill" :style="{ width: pct + '%' }" />
      </div>
      <div class="prog__count">{{ done }} / {{ path.length }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GameProfile, PathState } from '../api/practiceApi'

const props = defineProps<{ profile: GameProfile | null; path: PathState | null }>()
const { t } = useI18n()

const done = computed(() => {
  if (!props.path) return 0
  return props.path.current_index ?? props.path.length
})
const pct = computed(() => {
  if (!props.path || !props.path.length) return 0
  return Math.round((done.value / props.path.length) * 100)
})
</script>

<style scoped>
.prog { display: flex; align-items: center; gap: 12px; padding: 12px 0; flex-wrap: wrap; }
.prog__stats { display: flex; gap: 16px; }
.prog__stat { font-size: 14px; }
.prog__bar { flex: 1; min-width: 120px; height: 8px; background: rgba(0,0,0,0.08); border-radius: 6px; overflow: hidden; }
.prog__fill { height: 100%; background: #3B6D11; transition: width 0.2s; }
.prog__count { font-size: 13px; opacity: 0.7; }
</style>
