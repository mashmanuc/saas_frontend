<template>
  <Teleport to="body">
    <div class="grade-modal-backdrop" @click.self="$emit('close')">
      <div class="grade-modal">
        <div class="grade-modal__header">
          <h2 class="grade-modal__title">{{ t('winterboard.test.results.title') }}</h2>
          <button type="button" class="grade-modal__close" @click="$emit('close')">×</button>
        </div>

        <!-- Score -->
        <div class="grade-modal__score" :class="scoreClass">
          <div class="grade-modal__score-value">
            {{ result.earnedPoints }} / {{ result.totalPoints }}
          </div>
          <div class="grade-modal__score-pct">
            {{ result.percentage.toFixed(0) }}%
          </div>
        </div>

        <!-- Progress bar -->
        <div class="grade-modal__bar">
          <div class="grade-modal__bar-fill" :style="{ width: result.percentage + '%' }" :class="scoreClass"></div>
        </div>

        <!-- Per-question results -->
        <div class="grade-modal__details">
          <div
            v-for="(detail, i) in result.details"
            :key="detail.objectId"
            class="grade-modal__item"
            :class="detail.correct ? 'grade-modal__item--correct' : 'grade-modal__item--wrong'"
          >
            <span class="grade-modal__item-icon">{{ detail.correct ? '✅' : '❌' }}</span>
            <span class="grade-modal__item-label">{{ getLabel(detail.objectId, i) }}</span>
            <span class="grade-modal__item-pts">{{ detail.points }} / {{ getMaxPoints(detail.objectId) }} {{ t('winterboard.test.results.pts') }}</span>
          </div>
        </div>

        <button type="button" class="grade-modal__btn" @click="$emit('close')">{{ t('winterboard.test.results.close') }}</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestObject } from '../../types/winterboard'
import type { GradeResult } from '../../utils/testGrading'

const { t } = useI18n()

const props = defineProps<{
  result: GradeResult
  testObjects: WBTestObject[]
}>()

defineEmits<{ 'close': [] }>()

const scoreClass = computed(() => {
  const pct = props.result.percentage
  if (pct >= 80) return 'grade-modal--good'
  if (pct >= 50) return 'grade-modal--ok'
  return 'grade-modal--bad'
})

function getMaxPoints(objectId: string): number {
  const obj = props.testObjects.find(t => t.id === objectId)
  return obj?.points ?? 0
}

/** Повертає label запитання або fallback "Запитання N" */
function getLabel(objectId: string, index: number): string {
  const obj = props.testObjects.find(t => t.id === objectId)
  if (obj?.label) return obj.label
  // Fallback: тип + номер
  const typeKey = obj?.type ? `winterboard.test.typeBadge.${obj.type}` : ''
  const typeName = typeKey ? t(typeKey) : ''
  return `${typeName || t('winterboard.test.results.question')} ${index + 1}`
}
</script>

<style scoped>
.grade-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.grade-modal {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}
.grade-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.grade-modal__title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.grade-modal__close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  color: #6b7280;
}
.grade-modal__score {
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
}
.grade-modal__score-value {
  font-size: 28px;
  font-weight: 800;
}
.grade-modal__score-pct {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.8;
}
.grade-modal--good { background: #dcfce7; color: #059669; }
.grade-modal--good .grade-modal__bar-fill { background: #059669; }
.grade-modal--ok { background: #fef3c7; color: #d97706; }
.grade-modal--ok .grade-modal__bar-fill { background: #d97706; }
.grade-modal--bad { background: #fee2e2; color: #dc2626; }
.grade-modal--bad .grade-modal__bar-fill { background: #dc2626; }
.grade-modal__bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 16px;
}
.grade-modal__bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.grade-modal__details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}
.grade-modal__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
}
.grade-modal__item--correct { background: #f0fdf4; }
.grade-modal__item--wrong { background: #fef2f2; }
.grade-modal__item-icon {
  font-size: 16px;
  width: 22px;
  flex-shrink: 0;
}
.grade-modal__item-label {
  font-weight: 600;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.grade-modal__item-pts {
  color: #6b7280;
  margin-left: auto;
}
.grade-modal__btn {
  width: 100%;
  padding: 10px;
  background: #111827;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.grade-modal__btn:hover { background: #1f2937; }
</style>
