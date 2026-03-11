<!-- WB Responsive Phase 3 B7: Auto-hide overlay for display mode
     Ref: winterboard_dev/responsive/PHASE3.md B7.4
     Fades out header/footer after inactivity in display mode.
     Touch/move/key resets the timer and shows UI. -->
<template>
  <Transition name="wb-autohide">
    <div
      v-if="!uiVisible"
      class="wb-autohide-overlay"
      @pointerdown="emit('show')"
      @pointermove="emit('show')"
    >
      <div class="wb-autohide-overlay__hint" aria-live="polite">
        {{ t('winterboard.responsive.tapToShowUI') }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  uiVisible?: boolean
}

withDefaults(defineProps<Props>(), {
  uiVisible: true,
})

const emit = defineEmits<{
  show: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.wb-autohide-overlay {
  position: fixed;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: auto;
  padding-bottom: 24px;
}

.wb-autohide-overlay__hint {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  opacity: 0.7;
}

.wb-autohide-enter-active,
.wb-autohide-leave-active {
  transition: opacity 0.3s ease;
}
.wb-autohide-enter-from,
.wb-autohide-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .wb-autohide-enter-active,
  .wb-autohide-leave-active {
    transition: none;
  }
}
</style>
