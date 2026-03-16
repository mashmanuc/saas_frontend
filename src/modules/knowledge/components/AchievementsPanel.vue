<!-- Knowledge: Achievements panel — grid of earned + locked badges
     Ref: Phase 15 B2.2 -->
<template>
  <section class="achievements-panel" :aria-label="$t('knowledge.achievement.title')">
    <h3 class="text-lg font-semibold mb-4">{{ $t('knowledge.achievement.title') }}</h3>

    <div v-if="achievements.length === 0" class="text-sm text-gray-500 py-4 text-center">
      {{ $t('knowledge.achievement.noData') }}
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" role="list">
      <AchievementBadge
        v-for="ach in sortedAchievements"
        :key="ach.achievement_type"
        :achievement="ach"
        role="listitem"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AchievementBadge, { type TutorAchievement } from './AchievementBadge.vue'

const props = defineProps<{
  achievements: TutorAchievement[]
}>()

const sortedAchievements = computed(() => {
  const earned = props.achievements
    .filter(a => a.earned_at != null)
    .sort((a, b) => new Date(b.earned_at!).getTime() - new Date(a.earned_at!).getTime())

  const locked = props.achievements
    .filter(a => a.earned_at == null)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))

  return [...earned, ...locked]
})
</script>
