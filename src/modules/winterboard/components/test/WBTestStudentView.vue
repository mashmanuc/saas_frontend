<template>
  <div v-if="testStore.activeTestSessionId && testStore.remotePageId" class="wb-test-student-view">
    <div class="wb-test-student-view__header">
      <h3 class="wb-test-student-view__title">
        {{ t('winterboard.test.studentView.title') }}
      </h3>
      <div class="wb-test-student-view__phase-badge" :class="`wb-test-student-view__phase-badge--${testStore.testPhase}`">
        {{ t(`winterboard.test.phase.${testStore.testPhase}`) }}
      </div>
    </div>

    <div v-if="testStore.testPhase === 'live'" class="wb-test-student-view__progress">
      <span class="wb-test-student-view__progress-text">
        {{ t('winterboard.test.studentView.progress', { answered: answeredCount, total: totalCount }) }}
      </span>
      <div class="wb-test-student-view__progress-bar">
        <div
          class="wb-test-student-view__progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <div v-if="testStore.testPhase === 'review' && gradeResult" class="wb-test-student-view__result">
      <div class="wb-test-student-view__score">
        <span class="wb-test-student-view__score-label">{{ t('winterboard.test.studentView.yourScore') }}</span>
        <span class="wb-test-student-view__score-value">
          {{ gradeResult.earnedPoints }} / {{ gradeResult.totalPoints }}
        </span>
        <span class="wb-test-student-view__score-percent">
          ({{ Math.round(gradeResult.percentage) }}%)
        </span>
      </div>
    </div>

    <div v-if="testStore.testPhase === 'live'" class="wb-test-student-view__hint">
      {{ t('winterboard.test.studentView.liveHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTestStore } from '../../board/state/testStore'

const { t } = useI18n()
const testStore = useTestStore()

const answeredCount = computed(() => {
  if (!testStore.remotePageId) return 0
  const answers = testStore.getPageAnswers(testStore.remotePageId)
  return answers.size
})

const totalCount = computed(() => testStore.remoteTestObjects.length)

const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return (answeredCount.value / totalCount.value) * 100
})

const gradeResult = computed(() => {
  if (!testStore.remotePageId) return null
  return testStore.getGradeResult(testStore.remotePageId)
})
</script>

<style scoped>
.wb-test-student-view {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 300px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 20px;
  z-index: 100;
}

.wb-test-student-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.wb-test-student-view__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
}

.wb-test-student-view__phase-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.wb-test-student-view__phase-badge--live {
  background: #dbeafe;
  color: #1e40af;
}

.wb-test-student-view__phase-badge--review {
  background: #d1fae5;
  color: #065f46;
}

.wb-test-student-view__progress {
  margin-bottom: 16px;
}

.wb-test-student-view__progress-text {
  display: block;
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.wb-test-student-view__progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.wb-test-student-view__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  transition: width 0.3s ease;
}

.wb-test-student-view__result {
  padding: 16px;
  background: #f0fdf4;
  border: 2px solid #86efac;
  border-radius: 8px;
  margin-bottom: 16px;
}

.wb-test-student-view__score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.wb-test-student-view__score-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.wb-test-student-view__score-value {
  font-size: 32px;
  font-weight: 700;
  color: #059669;
}

.wb-test-student-view__score-percent {
  font-size: 16px;
  color: #059669;
}

.wb-test-student-view__hint {
  padding: 12px;
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
}
</style>
