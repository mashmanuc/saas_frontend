<template>
  <div class="test-input">
    <input
      :type="inputObj.inputType || 'text'"
      class="test-input__field"
      :placeholder="inputObj.placeholder || t('winterboard.test.inputPlaceholder')"
      :value="mode === 'live' || mode === 'review' ? String(answer ?? '') : inputObj.correctAnswer || ''"
      :readonly="mode !== 'live'"
      @input="onInput"
    />
    <div v-if="mode === 'edit' && inputObj.correctAnswer" class="test-input__hint">
      {{ t('winterboard.test.answer') }}: {{ inputObj.correctAnswer }}
    </div>
    <div v-if="mode === 'review' && inputObj.correctAnswer" class="test-input__hint test-input__hint--correct">
      {{ t('winterboard.test.answer') }}: {{ inputObj.correctAnswer }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestInput } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestInput
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{ 'answer': [value: unknown] }>()

const inputObj = computed(() => props.testObject as WBTestInput)

function onInput(e: Event) {
  if (props.mode !== 'live') return
  emit('answer', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.test-input__field {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: #fafafa;
  color: #111827;
  outline: none;
  transition: all 0.15s ease;
}
.test-input__field:focus {
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
.test-input__field[readonly] {
  background: #f9fafb;
  cursor: default;
}
.test-input__hint {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
  padding-left: 2px;
}
.test-input__hint--correct {
  color: #6366f1;
}
</style>
