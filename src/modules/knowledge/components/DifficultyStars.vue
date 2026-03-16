<!-- Knowledge: Difficulty stars (1-5) — read-only or interactive
     Ref: Phase 14 B1.1 / B1.2 shared sub-component -->
<template>
  <div
    class="difficulty-stars"
    :class="{ 'difficulty-stars--interactive': interactive }"
    :role="interactive ? 'slider' : 'img'"
    :aria-label="$t('knowledge.template.difficultyLabel')"
    :aria-valuemin="interactive ? 1 : undefined"
    :aria-valuemax="interactive ? 5 : undefined"
    :aria-valuenow="interactive ? level : undefined"
    :aria-valuetext="`${level} / 5`"
    :tabindex="interactive ? 0 : undefined"
    @keydown.left.prevent="interactive && changeLevel(level - 1)"
    @keydown.right.prevent="interactive && changeLevel(level + 1)"
  >
    <Star
      v-for="i in 5"
      :key="i"
      :size="size"
      :class="[
        i <= displayLevel ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
        interactive ? 'cursor-pointer' : '',
      ]"
      @click="interactive && changeLevel(i)"
      @mouseenter="interactive && (hovered = i)"
      @mouseleave="interactive && (hovered = 0)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Star } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  level: number
  interactive?: boolean
  size?: number
}>(), {
  interactive: false,
  size: 14,
})

const emit = defineEmits<{
  change: [level: number]
}>()

const hovered = ref(0)

const displayLevel = computed(() =>
  hovered.value > 0 ? hovered.value : props.level,
)

function changeLevel(v: number): void {
  const clamped = Math.max(1, Math.min(5, v))
  emit('change', clamped)
}
</script>

<style scoped>
.difficulty-stars {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}

.difficulty-stars--interactive:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
