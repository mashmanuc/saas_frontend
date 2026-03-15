<template>
  <Transition name="wb-hints-fade">
    <div
      v-if="visible"
      class="wb-onboarding-hints"
      data-testid="onboarding-hints"
    >
      <!-- Hint 1: Toolbar -->
      <div class="wb-hint wb-hint--toolbar">
        <span class="wb-hint__arrow wb-hint__arrow--left">&larr;</span>
        <span class="wb-hint__text">{{ t('winterboard.onboarding.toolbar') }}</span>
      </div>

      <!-- Hint 2: Materials sidebar -->
      <div class="wb-hint wb-hint--materials">
        <span class="wb-hint__text">{{ t('winterboard.onboarding.materials') }}</span>
        <span class="wb-hint__arrow wb-hint__arrow--right">&rarr;</span>
      </div>

      <!-- Hint 3: Replay button -->
      <div class="wb-hint wb-hint--replay">
        <span class="wb-hint__text">{{ t('winterboard.onboarding.replay') }}</span>
        <span class="wb-hint__arrow wb-hint__arrow--down">&darr;</span>
      </div>

      <!-- Hint 4: Center — selection -->
      <div class="wb-hint wb-hint--center">
        <span class="wb-hint__text">{{ t('winterboard.onboarding.selection') }}</span>
      </div>

      <!-- Dismiss button -->
      <button
        type="button"
        class="wb-hint__dismiss"
        @click="dismiss"
      >
        {{ t('winterboard.onboarding.dismiss') }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const STORAGE_KEY = 'wb-hints-seen'

const props = defineProps<{
  isEmpty: boolean
}>()

const { t } = useI18n({ useScope: 'global' })

const visible = ref(false)

onMounted(() => {
  if (props.isEmpty && localStorage.getItem(STORAGE_KEY) !== 'true') {
    visible.value = true
  }
})

function dismiss(): void {
  visible.value = false
  localStorage.setItem(STORAGE_KEY, 'true')
}

defineExpose({ dismiss })
</script>

<style scoped>
.wb-onboarding-hints {
  position: fixed;
  inset: 0;
  z-index: 55;
  pointer-events: none;
}

.wb-hint {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(15, 23, 42, 0.88);
  color: white;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
}

.wb-hint--toolbar {
  left: 80px;
  top: 50%;
  transform: translateY(-50%);
}

.wb-hint--materials {
  right: 80px;
  top: 40%;
  transform: translateY(-50%);
}

.wb-hint--replay {
  right: 24px;
  bottom: 130px;
}

.wb-hint--center {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.wb-hint__arrow {
  font-size: 1.25rem;
  line-height: 1;
  opacity: 0.7;
}

.wb-hint__dismiss {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 24px;
  background: var(--wb-brand, #6366f1);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.15s;
}

.wb-hint__dismiss:hover {
  background: var(--primary-hover, #4f46e5);
}

.wb-hints-fade-enter-active { transition: opacity 0.3s ease; }
.wb-hints-fade-leave-active { transition: opacity 0.2s ease; }
.wb-hints-fade-enter-from,
.wb-hints-fade-leave-to { opacity: 0; }
</style>
