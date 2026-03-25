<template>
  <div class="test-matching">
    <!-- Edit mode: show pairs with arrows -->
    <div v-if="mode === 'edit'" class="test-matching__preview">
      <div v-for="(left, i) in matchObj.leftItems" :key="i" class="test-matching__pair">
        <span class="test-matching__left">{{ left }}</span>
        <span class="test-matching__arrow">→</span>
        <span class="test-matching__right">{{ matchObj.rightItems[matchObj.correctPairs[i]] ?? '?' }}</span>
      </div>
    </div>

    <!-- Live / Review mode: dropdowns for each left item -->
    <div v-else class="test-matching__play">
      <div v-for="(left, i) in matchObj.leftItems" :key="i" class="test-matching__row">
        <span class="test-matching__left test-matching__left--play">{{ i + 1 }}. {{ left }}</span>
        <select
          class="test-matching__select"
          :value="currentPairs[i] ?? -1"
          :disabled="mode === 'review'"
          @change="onPairChange(i, $event)"
        >
          <option :value="-1" disabled>{{ t('winterboard.test.chooseAnswer') }}</option>
          <option
            v-for="(right, ri) in shuffledRight"
            :key="ri"
            :value="shuffledRight[ri].originalIndex"
          >
            {{ shuffledRight[ri].label }}
          </option>
        </select>
        <span
          v-if="mode === 'review'"
          class="test-matching__correct-hint"
        >
          ✓ {{ matchObj.rightItems[matchObj.correctPairs[i]] }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestMatching } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestMatching
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{ 'answer': [value: unknown] }>()

const matchObj = computed(() => props.testObject as WBTestMatching)
const currentPairs = computed<number[]>(() => (props.answer as number[]) ?? [])

/**
 * Перемішані варіанти правої колонки (щоб учень не бачив порядок).
 * Seed на основі id об'єкта — стабільний між рендерами.
 */
const shuffledRight = computed(() => {
  const items = matchObj.value.rightItems.map((label, i) => ({ label, originalIndex: i }))
  // Простий детермінований shuffle на основі id
  const seed = hashCode(matchObj.value.id)
  return deterministicShuffle(items, seed)
})

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    const j = s % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function onPairChange(leftIndex: number, e: Event) {
  if (props.mode !== 'live') return
  const rightIndex = Number((e.target as HTMLSelectElement).value)
  const newPairs = [...currentPairs.value]
  while (newPairs.length <= leftIndex) newPairs.push(-1)
  newPairs[leftIndex] = rightIndex
  emit('answer', newPairs)
}
</script>

<style scoped>
.test-matching__preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.test-matching__pair {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.test-matching__left {
  background: #eef2ff;
  color: #4f46e5;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
  min-width: 60px;
}

.test-matching__arrow {
  color: #9ca3af;
  font-size: 16px;
}

.test-matching__right {
  background: #dcfce7;
  color: #059669;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
}

.test-matching__play {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-matching__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.test-matching__left--play {
  flex: 1;
  min-width: 80px;
}

.test-matching__select {
  flex: 1;
  height: 34px;
  padding: 0 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  outline: none;
}

.test-matching__select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.test-matching__select:disabled {
  background: #f9fafb;
  cursor: default;
}

.test-matching__correct-hint {
  font-size: 11px;
  color: #059669;
  font-style: italic;
  white-space: nowrap;
}
</style>
