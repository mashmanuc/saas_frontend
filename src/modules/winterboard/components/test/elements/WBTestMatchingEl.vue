<template>
  <div class="test-matching">
    <!-- Edit mode: show pairs with arrows -->
    <div v-if="mode === 'edit'" class="test-matching__preview">
      <div v-for="(left, i) in matchObj.leftItems" :key="i" class="test-matching__pair">
        <span class="test-matching__num">{{ i + 1 }}.</span>
        <span class="test-matching__left" v-html="renderTextWithLatex(left)" />
        <span class="test-matching__arrow">→</span>
        <span class="test-matching__right" v-html="renderTextWithLatex(matchObj.rightItems[matchObj.correctPairs[i]] ?? '?')" />
      </div>
    </div>

    <!-- Live / Review mode: custom dropdowns for each left item -->
    <div v-else class="test-matching__play">
      <div v-for="(left, i) in matchObj.leftItems" :key="i" class="test-matching__row">
        <span
          class="test-matching__left test-matching__left--play"
          v-html="`${i + 1}. ${renderTextWithLatex(left)}`"
        />

        <!-- Custom dropdown (replaces native <select> so LaTeX renders) -->
        <div
          class="test-matching__custom-select"
          :class="{ 'test-matching__custom-select--open': openDropdown === i, 'test-matching__custom-select--disabled': mode === 'review' }"
        >
          <button
            type="button"
            class="test-matching__select-btn"
            :disabled="mode === 'review'"
            @click.stop="toggleDropdown(i)"
          >
            <span
              v-if="currentPairs[i] !== undefined && currentPairs[i] >= 0"
              class="test-matching__select-value"
              v-html="renderTextWithLatex(getSelectedLabel(i))"
            />
            <span v-else class="test-matching__select-placeholder">{{ t('winterboard.test.chooseAnswer') }}</span>
            <span class="test-matching__select-arrow" :class="{ 'test-matching__select-arrow--open': openDropdown === i }">▾</span>
          </button>

          <div v-if="openDropdown === i" class="test-matching__dropdown">
            <button
              v-for="item in shuffledRight"
              :key="item.originalIndex"
              type="button"
              class="test-matching__dropdown-option"
              :class="{ 'test-matching__dropdown-option--selected': currentPairs[i] === item.originalIndex }"
              @click.stop="selectOption(i, item.originalIndex)"
              v-html="renderTextWithLatex(item.label)"
            />
          </div>
        </div>

        <!-- Review: correct answer hint -->
        <span v-if="mode === 'review'" class="test-matching__correct-hint">
          ✓ <span v-html="renderTextWithLatex(matchObj.rightItems[matchObj.correctPairs[i]] ?? '')" />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
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
const openDropdown = ref<number | null>(null)

const shuffledRight = computed(() => {
  const items = matchObj.value.rightItems.map((label, i) => ({ label, originalIndex: i }))
  const seed = hashCode(matchObj.value.id)
  return deterministicShuffle(items, seed)
})

function getSelectedLabel(leftIndex: number): string {
  const originalIndex = currentPairs.value[leftIndex]
  return matchObj.value.rightItems[originalIndex] ?? ''
}

function toggleDropdown(i: number) {
  if (props.mode !== 'live') return
  openDropdown.value = openDropdown.value === i ? null : i
}

function selectOption(leftIndex: number, rightIndex: number) {
  const newPairs = [...currentPairs.value]
  while (newPairs.length <= leftIndex) newPairs.push(-1)
  newPairs[leftIndex] = rightIndex
  emit('answer', newPairs)
  openDropdown.value = null
}

function closeDropdown(e: MouseEvent) {
  if (openDropdown.value !== null) {
    openDropdown.value = null
  }
}

onMounted(() => document.addEventListener('click', closeDropdown))
onBeforeUnmount(() => document.removeEventListener('click', closeDropdown))

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
</script>

<style scoped>
/* ── Edit mode ── */
.test-matching__preview {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.test-matching__pair {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 2px 0;
}

.test-matching__num {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  width: 16px;
}

.test-matching__left {
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  padding: 4px 10px;
  border-radius: 7px;
  font-weight: 600;
  font-size: 13px;
}

.test-matching__arrow {
  color: #c4b5fd;
  font-size: 13px;
  flex-shrink: 0;
}

.test-matching__right {
  background: rgba(99, 102, 241, 0.06);
  color: #4f46e5;
  padding: 4px 10px;
  border-radius: 7px;
  font-weight: 600;
  font-size: 13px;
}

/* ── Play / Review mode ── */
.test-matching__play {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.test-matching__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.test-matching__left--play {
  flex: 1;
  min-width: 60px;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}

/* ── Custom dropdown ── */
.test-matching__custom-select {
  flex: 1;
  position: relative;
}

.test-matching__select-btn {
  width: 100%;
  min-height: 34px;
  padding: 4px 10px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  background: #fafafa;
  color: #111827;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.test-matching__custom-select--open .test-matching__select-btn,
.test-matching__select-btn:focus {
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  outline: none;
}

.test-matching__custom-select--disabled .test-matching__select-btn {
  background: #f9fafb;
  cursor: default;
  color: #6b7280;
}

.test-matching__select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.test-matching__select-placeholder {
  flex: 1;
  color: #9ca3af;
  font-style: italic;
}

.test-matching__select-arrow {
  flex-shrink: 0;
  font-size: 11px;
  color: #9ca3af;
  transition: transform 0.15s ease;
}

.test-matching__select-arrow--open {
  transform: rotate(180deg);
}

/* ── Dropdown panel ── */
.test-matching__dropdown {
  position: absolute;
  top: calc(100% + 3px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
  max-height: 220px;
  overflow-y: auto;
}

.test-matching__dropdown-option {
  width: 100%;
  padding: 7px 12px;
  font-size: 13px;
  color: #111827;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  line-height: 1.4;
  transition: background 0.1s ease;
}

.test-matching__dropdown-option:hover {
  background: rgba(99, 102, 241, 0.06);
}

.test-matching__dropdown-option--selected {
  background: rgba(99, 102, 241, 0.1);
  color: #4338ca;
  font-weight: 500;
}

/* ── Review correct hint ── */
.test-matching__correct-hint {
  font-size: 11px;
  color: #6366f1;
  font-style: italic;
  white-space: nowrap;
  opacity: 0.85;
  flex-shrink: 0;
}
</style>
