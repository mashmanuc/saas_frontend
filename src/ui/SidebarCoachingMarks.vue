<template>
  <Teleport to="body">
    <Transition name="coach-fade">
      <div
        v-if="visible && currentStep"
        class="sidebar-coaching-overlay"
        @click.self="nextStep"
      >
        <div
          class="sidebar-coaching-tooltip"
          :style="tooltipPosition"
        >
          <div class="sidebar-coaching-tooltip__step">
            {{ currentStepIndex + 1 }}/{{ steps.length }}
          </div>
          <p class="sidebar-coaching-tooltip__text">
            {{ $t(currentStep.text) }}
          </p>
          <div class="sidebar-coaching-tooltip__actions">
            <button
              type="button"
              class="sidebar-coaching-tooltip__btn sidebar-coaching-tooltip__btn--skip"
              @click="dismiss"
            >
              {{ $t('sidebarCoaching.skip') }}
            </button>
            <button
              type="button"
              class="sidebar-coaching-tooltip__btn sidebar-coaching-tooltip__btn--next"
              @click="nextStep"
            >
              {{ isLastStep ? $t('sidebarCoaching.done') : $t('sidebarCoaching.next') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useOnboardingHints, TutorHintId } from '@/composables/useOnboardingHints'

interface CoachingStep {
  target: string
  text: string
}

const steps: CoachingStep[] = [
  {
    target: '[href="/knowledge"]',
    text: 'sidebarCoaching.step1',
  },
  {
    target: '[href="/tutor/schedule"]',
    text: 'sidebarCoaching.step2',
  },
  {
    target: '[href="/winterboard/dashboard"]',
    text: 'sidebarCoaching.step3',
  },
]

const { isHintVisible, dismissHint } = useOnboardingHints()

const visible = ref(false)
const currentStepIndex = ref(0)
const tooltipTop = ref(0)
const tooltipLeft = ref(0)

const currentStep = computed(() => steps[currentStepIndex.value] ?? null)
const isLastStep = computed(() => currentStepIndex.value >= steps.length - 1)

const tooltipPosition = computed(() => ({
  top: `${tooltipTop.value}px`,
  left: `${tooltipLeft.value}px`,
}))

function positionTooltip() {
  const step = currentStep.value
  if (!step) return

  const el = document.querySelector(step.target)
  if (!el) {
    // Target not found — skip to next or dismiss
    if (!isLastStep.value) {
      currentStepIndex.value++
      nextTick(positionTooltip)
    } else {
      dismiss()
    }
    return
  }

  const rect = el.getBoundingClientRect()
  tooltipTop.value = rect.top + rect.height / 2 - 40
  tooltipLeft.value = rect.right + 12
}

function nextStep() {
  if (isLastStep.value) {
    dismiss()
    return
  }
  currentStepIndex.value++
  nextTick(positionTooltip)
}

function dismiss() {
  visible.value = false
  dismissHint(TutorHintId.SIDEBAR_COACHING)
}

onMounted(() => {
  if (isHintVisible(TutorHintId.SIDEBAR_COACHING)) {
    // Delay slightly to let sidebar render
    setTimeout(() => {
      visible.value = true
      nextTick(positionTooltip)
    }, 800)
  }
})

onBeforeUnmount(() => {
  visible.value = false
})
</script>

<style scoped>
.sidebar-coaching-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.3);
}

.sidebar-coaching-tooltip {
  position: absolute;
  width: 280px;
  padding: 16px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 10000;
}

.sidebar-coaching-tooltip__step {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary, #64748b);
  margin-bottom: 8px;
}

.sidebar-coaching-tooltip__text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, #0f172a);
  margin: 0 0 14px;
}

.sidebar-coaching-tooltip__actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.sidebar-coaching-tooltip__btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.sidebar-coaching-tooltip__btn--skip {
  background: transparent;
  color: var(--text-secondary, #64748b);
}

.sidebar-coaching-tooltip__btn--skip:hover {
  background: var(--bg-secondary, #f1f5f9);
}

.sidebar-coaching-tooltip__btn--next {
  background: var(--accent, #6366f1);
  color: #fff;
}

.sidebar-coaching-tooltip__btn--next:hover {
  opacity: 0.9;
}

/* Transition */
.coach-fade-enter-active { transition: opacity 0.3s ease; }
.coach-fade-leave-active { transition: opacity 0.2s ease; }
.coach-fade-enter-from,
.coach-fade-leave-to { opacity: 0; }
</style>
