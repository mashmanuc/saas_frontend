<template>
  <div
    class="wb-test-overlay"
    :class="overlayClass"
    :style="overlayStyle"
  >
    <WBTestElement
      v-for="obj in testObjects"
      :key="obj.id"
      :test-object="obj"
      :mode="mode"
      :zoom="zoom"
      :is-selected="selectedTestId === obj.id"
      :answer="answers?.get(obj.id)"
      :grade-detail="gradeDetailMap.get(obj.id)"
      :check-result="checks?.get(obj.id)"
      @select="$emit('select-test', obj.id)"
      @update="$emit('update', $event)"
      @answer="$emit('answer', $event)"
      @check="$emit('check', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 37: WBTestOverlay — HTML overlay positioned over Konva canvas.
 * CSS transform syncs with canvas zoom/pan.
 *
 * pointer-events архітектура (Phase 38):
 *   overlay  → pointer-events: none  (кліки проходять крізь до canvas)
 *   elements → pointer-events: auto  (ловлять свої кліки)
 *   → canvas і тести працюють ОДНОЧАСНО, без переключення режимів
 *
 * Фази (edit/live/review) контролюють ЩО показується, а НЕ хто ловить кліки.
 */
import { computed } from 'vue'
import type { WBTestObject } from '../../types/winterboard'
import type { TestPhase, GradeResult } from '../../board/state/testStore'
import WBTestElement from './WBTestElement.vue'

const props = defineProps<{
  testObjects: WBTestObject[]
  zoom: number
  scrollX: number
  scrollY: number
  mode: TestPhase
  selectedTestId: string | null
  gradeResult?: GradeResult | null
  answers?: Map<string, unknown>
  /** Phase 38: per-element inline check results */
  checks?: Map<string, boolean>
}>()

const emit = defineEmits<{
  'update': [payload: { id: string; updates: Record<string, unknown> }]
  'answer': [payload: { objectId: string; answer: unknown }]
  'select-test': [id: string]
  'check': [objectId: string]
}>()

/** Map objectId → grade detail for quick lookup in review mode */
const gradeDetailMap = computed(() => {
  const map = new Map<string, GradeResult['details'][0]>()
  if (props.gradeResult?.details) {
    for (const d of props.gradeResult.details) {
      map.set(d.objectId, d)
    }
  }
  return map
})

const overlayClass = computed(() => ({
  'wb-test-overlay--edit': props.mode === 'edit',
  'wb-test-overlay--live': props.mode === 'live',
  'wb-test-overlay--review': props.mode === 'review',
}))

const overlayStyle = computed(() => ({
  transform: `scale(${props.zoom}) translate(${-props.scrollX}px, ${-props.scrollY}px)`,
  transformOrigin: '0 0',
}))

// deselect тепер відбувається через canvas click у WBSoloRoom (overlay = pointer-events:none)
</script>

<style scoped>
.wb-test-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 10;
  /* Phase 38: ЗАВЖДИ passthrough — кліки йдуть крізь до canvas.
     Тестові елементи самі ловлять свої кліки через pointer-events: auto. */
  pointer-events: none;
}
</style>
