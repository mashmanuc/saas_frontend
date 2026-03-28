<template>
  <div class="test-gap-fill">
    <!-- Render template parts with gaps in between -->
    <div class="test-gap-fill__template">
      <template v-for="(part, i) in templateParts" :key="i">
        <span class="test-gap-fill__text">{{ part }}</span>
        <template v-if="i < gapObj.gaps.length">
          <!-- Live mode: interactive input field -->
          <input
            v-if="mode === 'live'"
            class="test-gap-fill__input"
            :value="gapAnswers[i] ?? ''"
            placeholder="..."
            @input="onGapInput(i, $event)"
          />
          <!-- Review mode: readonly input + correct answer hint -->
          <template v-else-if="mode === 'review'">
            <input
              class="test-gap-fill__input test-gap-fill__input--readonly"
              :value="gapAnswers[i] ?? ''"
              readonly
            />
            <span class="test-gap-fill__blank">
              {{ gapObj.gaps[i]?.correctAnswer ?? '???' }}
            </span>
          </template>
          <!-- Edit mode: show correct answer -->
          <span v-else class="test-gap-fill__blank">
            {{ gapObj.gaps[i]?.correctAnswer ?? '???' }}
          </span>
        </template>
      </template>
    </div>
    <div v-if="mode === 'edit' && gapObj.gaps.length > 0" class="test-gap-fill__hint">
      {{ t('winterboard.test.gaps', { n: gapObj.gaps.length }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestGapFill } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestGapFill
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{ 'answer': [value: unknown] }>()

const gapObj = computed(() => props.testObject as WBTestGapFill)
const gapAnswers = computed<string[]>(() => (props.answer as string[]) ?? [])

// Split template by ___ markers
const templateParts = computed(() => {
  return (gapObj.value.template || '').split('___')
})

function onGapInput(index: number, e: Event) {
  if (props.mode !== 'live') return
  const newAnswers = [...gapAnswers.value]
  while (newAnswers.length <= index) newAnswers.push('')
  newAnswers[index] = (e.target as HTMLInputElement).value
  emit('answer', newAnswers)
}
</script>

<style scoped>
.test-gap-fill__template {
  font-size: 14px;
  color: #374151;
  line-height: 2.2;
  word-wrap: break-word;
}
.test-gap-fill__text {
  white-space: pre-wrap;
}
.test-gap-fill__input {
  display: inline-block;
  width: 100px;
  height: 30px;
  padding: 0 8px;
  border: 1.5px solid rgba(99, 102, 241, 0.4);
  border-radius: 6px;
  font-size: 13px;
  background: rgba(238, 242, 255, 0.6);
  color: #111827;
  outline: none;
  margin: 0 3px;
  vertical-align: middle;
  transition: all 0.15s ease;
}
.test-gap-fill__input:focus {
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}
.test-gap-fill__input--readonly {
  background: #f9fafb;
  border-color: #e5e7eb;
  cursor: default;
}
.test-gap-fill__blank {
  display: inline-block;
  padding: 2px 10px;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  margin: 0 3px;
}
.test-gap-fill__hint {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
  margin-top: 4px;
  padding-left: 2px;
}
</style>
