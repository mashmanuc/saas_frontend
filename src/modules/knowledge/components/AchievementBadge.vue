<!-- Knowledge: Achievement badge — earned/locked states, tooltip, progress
     Ref: Phase 15 B2.1 -->
<template>
  <div
    :class="['achievement-badge relative flex flex-col items-center p-3 rounded-xl border transition-all',
      isEarned ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-gray-50 opacity-60']"
    :aria-label="achievement.display_name + (isEarned ? ` — ${$t('knowledge.achievement.earned')}` : ` — ${$t('knowledge.achievement.locked')}`)"
    :aria-describedby="tooltipId"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
    @focus="showTooltip = true"
    @blur="showTooltip = false"
    tabindex="0"
  >
    <!-- Icon -->
    <div :class="['w-12 h-12 rounded-full flex items-center justify-center mb-2',
      isEarned ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-400']">
      <component :is="iconComponent" :size="24" />
    </div>

    <!-- Title -->
    <span :class="['text-xs font-medium text-center line-clamp-2',
      isEarned ? 'text-gray-800' : 'text-gray-500']">
      {{ achievement.display_name }}
    </span>

    <!-- Earned date or progress -->
    <span v-if="isEarned" class="text-[10px] text-gray-400 mt-0.5">
      {{ formatDate(achievement.earned_at!) }}
    </span>
    <div v-else-if="achievement.progress != null" class="w-full mt-1.5">
      <div class="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary-400 rounded-full transition-all"
          :style="{ width: `${Math.min(100, achievement.progress)}%` }"
          role="progressbar"
          :aria-valuenow="achievement.progress"
          :aria-valuemin="0"
          :aria-valuemax="100"
        />
      </div>
      <span class="text-[10px] text-gray-400 mt-0.5 block text-center">{{ achievement.progress }}%</span>
    </div>

    <!-- Tooltip -->
    <Transition name="fade">
      <div
        v-if="showTooltip"
        :id="tooltipId"
        role="tooltip"
        class="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg max-w-48 text-center whitespace-normal"
      >
        {{ achievement.description }}
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-gray-800 rotate-45" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trophy, GitFork, BookOpen, Star, Users, Package, Award, Flame, Heart } from 'lucide-vue-next'

export interface TutorAchievement {
  achievement_type: string
  display_name: string
  description: string
  icon: string
  earned_at: string | null
  progress: number | null
  metadata: Record<string, unknown>
}

const props = defineProps<{
  achievement: TutorAchievement
}>()

const { locale } = useI18n()

const showTooltip = ref(false)

const isEarned = computed(() => props.achievement.earned_at != null)

const tooltipId = computed(() => `achievement-tooltip-${props.achievement.achievement_type}`)

const ICON_MAP: Record<string, Component> = {
  trophy: Trophy,
  'git-fork': GitFork,
  'book-open': BookOpen,
  star: Star,
  users: Users,
  package: Package,
  award: Award,
  flame: Flame,
  heart: Heart,
}

const iconComponent = computed(() => ICON_MAP[props.achievement.icon] || Award)

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(
      locale.value === 'uk' ? 'uk-UA' : 'en-US',
      { day: 'numeric', month: 'short', year: 'numeric' },
    )
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
