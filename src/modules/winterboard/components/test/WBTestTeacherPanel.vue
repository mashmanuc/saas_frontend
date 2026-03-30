<template>
  <div v-if="testStore.activeTestSessionId" class="wb-test-teacher-panel">
    <div class="wb-test-teacher-panel__header">
      <h3 class="wb-test-teacher-panel__title">
        {{ t('winterboard.test.teacherPanel.title') }}
      </h3>
      <div class="wb-test-teacher-panel__phase-badge" :class="`wb-test-teacher-panel__phase-badge--${testStore.testPhase}`">
        {{ t(`winterboard.test.phase.${testStore.testPhase}`) }}
      </div>
    </div>

    <div class="wb-test-teacher-panel__stats">
      <div class="wb-test-teacher-panel__stat">
        <span class="wb-test-teacher-panel__stat-label">{{ t('winterboard.test.teacherPanel.totalStudents') }}</span>
        <span class="wb-test-teacher-panel__stat-value">{{ studentProgress.size }}</span>
      </div>
      <div class="wb-test-teacher-panel__stat">
        <span class="wb-test-teacher-panel__stat-label">{{ t('winterboard.test.teacherPanel.totalQuestions') }}</span>
        <span class="wb-test-teacher-panel__stat-value">{{ testStore.remoteTestObjects.length }}</span>
      </div>
    </div>

    <div class="wb-test-teacher-panel__students">
      <h4 class="wb-test-teacher-panel__subtitle">{{ t('winterboard.test.teacherPanel.studentProgress') }}</h4>
      <div v-if="studentProgress.size === 0" class="wb-test-teacher-panel__empty">
        {{ t('winterboard.test.teacherPanel.noStudents') }}
      </div>
      <div v-else class="wb-test-teacher-panel__student-list">
        <div
          v-for="student in sortedStudents"
          :key="student.studentId"
          class="wb-test-teacher-panel__student"
        >
          <div class="wb-test-teacher-panel__student-header">
            <span class="wb-test-teacher-panel__student-name">{{ student.studentName }}</span>
            <span class="wb-test-teacher-panel__student-progress">
              {{ student.answeredCount }} / {{ student.totalCount }}
            </span>
          </div>
          <div class="wb-test-teacher-panel__progress-bar">
            <div
              class="wb-test-teacher-panel__progress-fill"
              :style="{ width: `${(student.answeredCount / student.totalCount) * 100}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="wb-test-teacher-panel__actions">
      <button
        v-if="testStore.testPhase === 'live'"
        class="wb-test-teacher-panel__btn wb-test-teacher-panel__btn--primary"
        :disabled="studentProgress.size === 0"
        @click="handleGrade"
      >
        {{ t('winterboard.test.teacherPanel.grade') }}
      </button>
      <button
        class="wb-test-teacher-panel__btn wb-test-teacher-panel__btn--danger"
        @click="handleEnd"
      >
        {{ t('winterboard.test.teacherPanel.endTest') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTestStore } from '../../board/state/testStore'

const { t } = useI18n()
const testStore = useTestStore()

const emit = defineEmits<{
  grade: []
  end: []
}>()

const studentProgress = computed(() => testStore.studentProgress)

const sortedStudents = computed(() => {
  return Array.from(studentProgress.value.values()).sort((a, b) => {
    // Sort by completion percentage (descending), then by name
    const aPercent = a.answeredCount / a.totalCount
    const bPercent = b.answeredCount / b.totalCount
    if (aPercent !== bPercent) {
      return bPercent - aPercent
    }
    return a.studentName.localeCompare(b.studentName)
  })
})

function handleGrade() {
  emit('grade')
}

function handleEnd() {
  emit('end')
}
</script>

<style scoped>
.wb-test-teacher-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 320px;
  max-height: calc(100vh - 100px);
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 20px;
  overflow-y: auto;
  z-index: 100;
}

.wb-test-teacher-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.wb-test-teacher-panel__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
}

.wb-test-teacher-panel__phase-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.wb-test-teacher-panel__phase-badge--edit {
  background: #e5e7eb;
  color: #6b7280;
}

.wb-test-teacher-panel__phase-badge--live {
  background: #dbeafe;
  color: #1e40af;
}

.wb-test-teacher-panel__phase-badge--review {
  background: #d1fae5;
  color: #065f46;
}

.wb-test-teacher-panel__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.wb-test-teacher-panel__stat {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.wb-test-teacher-panel__stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.wb-test-teacher-panel__stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.wb-test-teacher-panel__students {
  margin-bottom: 20px;
}

.wb-test-teacher-panel__subtitle {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px 0;
}

.wb-test-teacher-panel__empty {
  padding: 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

.wb-test-teacher-panel__student-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-test-teacher-panel__student {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.wb-test-teacher-panel__student-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.wb-test-teacher-panel__student-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.wb-test-teacher-panel__student-progress {
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
}

.wb-test-teacher-panel__progress-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.wb-test-teacher-panel__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  transition: width 0.3s ease;
}

.wb-test-teacher-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-test-teacher-panel__btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.wb-test-teacher-panel__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wb-test-teacher-panel__btn--primary {
  background: #2563eb;
  color: white;
}

.wb-test-teacher-panel__btn--primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.wb-test-teacher-panel__btn--danger {
  background: #ef4444;
  color: white;
}

.wb-test-teacher-panel__btn--danger:hover:not(:disabled) {
  background: #dc2626;
}
</style>
