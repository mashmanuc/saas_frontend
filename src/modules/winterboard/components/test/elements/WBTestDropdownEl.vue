<template>
  <div class="test-dropdown">
    <select
      class="test-dropdown__select"
      :value="currentValue"
      :disabled="mode !== 'live'"
      @change="onSelect"
    >
      <option :value="-1" disabled>{{ t('winterboard.test.chooseAnswer') }}</option>
      <option
        v-for="(opt, i) in dropObj.options"
        :key="i"
        :value="i"
      >
        {{ opt }}
      </option>
    </select>
    <div v-if="mode === 'edit' || mode === 'review'" class="test-dropdown__hint">
      {{ t('winterboard.test.correct') }}: {{ dropObj.options[dropObj.correctIndex] }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestDropdown } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestDropdown
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{ 'answer': [value: unknown] }>()

const dropObj = computed(() => props.testObject as WBTestDropdown)

const currentValue = computed(() => {
  if (props.mode === 'edit') return dropObj.value.correctIndex
  return typeof props.answer === 'number' ? props.answer : -1
})

function onSelect(e: Event) {
  if (props.mode !== 'live') return
  emit('answer', Number((e.target as HTMLSelectElement).value))
}
</script>

<style scoped>
.test-dropdown__select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  outline: none;
}
.test-dropdown__select:focus {
  border-color: #6366f1;
}
.test-dropdown__select:disabled {
  background: #f9fafb;
  cursor: default;
}
.test-dropdown__hint {
  font-size: 11px;
  color: #059669;
  font-style: italic;
  margin-top: 2px;
}
</style>
