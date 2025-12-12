<template>
  <div class="mobile-compact">
    <!-- Tab switcher -->
    <div class="mobile-compact__tabs">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'video' }"
        @click="activeTab = 'video'"
      >
        <span class="icon">📹</span>
        {{ $t('classroom.tabs.video') }}
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'board' }"
        @click="activeTab = 'board'"
      >
        <span class="icon">📋</span>
        {{ $t('classroom.tabs.board') }}
      </button>
    </div>

    <!-- Content -->
    <div
      class="mobile-compact__content"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <Transition :name="transitionName">
        <div v-if="activeTab === 'video'" key="video" class="content-panel">
          <slot name="video"></slot>
        </div>
        <div v-else key="board" class="content-panel">
          <slot name="board"></slot>
        </div>
      </Transition>
    </div>

    <!-- Swipe indicator -->
    <div class="mobile-compact__indicator">
      <span
        class="indicator-dot"
        :class="{ 'indicator-dot--active': activeTab === 'video' }"
      ></span>
      <span
        class="indicator-dot"
        :class="{ 'indicator-dot--active': activeTab === 'board' }"
      ></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

type Tab = 'video' | 'board'

// State
const activeTab = ref<Tab>('video')
const touchStartX = ref(0)
const touchDeltaX = ref(0)

// Computed
const transitionName = computed(() => {
  return touchDeltaX.value > 0 ? 'slide-right' : 'slide-left'
})

// Touch handlers for swipe
function handleTouchStart(e: TouchEvent): void {
  touchStartX.value = e.touches[0].clientX
}

function handleTouchMove(e: TouchEvent): void {
  touchDeltaX.value = e.touches[0].clientX - touchStartX.value
}

function handleTouchEnd(): void {
  const threshold = 50

  if (Math.abs(touchDeltaX.value) > threshold) {
    if (touchDeltaX.value > 0 && activeTab.value === 'board') {
      activeTab.value = 'video'
    } else if (touchDeltaX.value < 0 && activeTab.value === 'video') {
      activeTab.value = 'board'
    }
  }

  touchDeltaX.value = 0
}
</script>

<style scoped>
.mobile-compact {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.mobile-compact__tabs {
  display: flex;
  padding: 8px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn--active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.mobile-compact__content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.content-panel {
  position: absolute;
  inset: 0;
  padding: 8px;
}

.mobile-compact__indicator {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-bg-secondary);
}

.indicator-dot {
  width: 8px;
  height: 8px;
  background: var(--color-border);
  border-radius: 50%;
  transition: all 0.2s;
}

.indicator-dot--active {
  background: var(--color-primary);
  transform: scale(1.2);
}

.icon {
  font-size: 1rem;
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}

.slide-left-enter-from {
  transform: translateX(100%);
}

.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-right-enter-from {
  transform: translateX(-100%);
}

.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
