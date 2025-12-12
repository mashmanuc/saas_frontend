<script setup lang="ts">
// TASK FX3: Conflict UI Indicator
import { ref, computed, watch, onMounted } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/boardStore'

const boardStore = useBoardStore()

const hasConflicts = computed(() => boardStore.recentConflicts?.length > 0)
const conflictCount = computed(() => boardStore.recentConflicts?.length || 0)
const canShowDetails = computed(() => conflictCount.value <= 10)

const isVisible = ref(false)
const autoDismissTimer = ref<ReturnType<typeof setTimeout> | null>(null)

watch(hasConflicts, (has) => {
  if (has) {
    isVisible.value = true
    startAutoDismiss()
  }
})

onMounted(() => {
  if (hasConflicts.value) {
    isVisible.value = true
    startAutoDismiss()
  }
})

function startAutoDismiss() {
  if (autoDismissTimer.value) {
    clearTimeout(autoDismissTimer.value)
  }
  autoDismissTimer.value = setTimeout(() => {
    dismiss()
  }, 10000) // Auto-dismiss after 10 seconds
}

function showDetails() {
  // TODO: Open conflict details modal
  console.log('Show conflict details')
}

function dismiss() {
  isVisible.value = false
  if (autoDismissTimer.value) {
    clearTimeout(autoDismissTimer.value)
  }
  boardStore.clearRecentConflicts?.()
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="isVisible && hasConflicts"
      class="conflict-indicator"
      :class="{ 'conflict-indicator--warning': conflictCount > 5 }"
    >
      <AlertTriangle class="icon" :size="18" />
      <span class="text">
        {{ conflictCount }} conflict{{ conflictCount > 1 ? 's' : '' }} resolved
      </span>
      <button v-if="canShowDetails" class="details-btn" @click="showDetails">
        Details
      </button>
      <button class="dismiss-btn" @click="dismiss">
        <X class="icon-sm" :size="16" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.conflict-indicator {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  font-size: 0.875rem;
}

.conflict-indicator--warning {
  background: #fee2e2;
  border-color: #ef4444;
}

.conflict-indicator--warning .icon {
  color: #ef4444;
}

.icon {
  color: #f59e0b;
  flex-shrink: 0;
}

.text {
  color: #92400e;
}

.conflict-indicator--warning .text {
  color: #991b1b;
}

.details-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  color: inherit;
  transition: background 0.2s;
}

.details-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.dismiss-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.dismiss-btn:hover {
  opacity: 1;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
