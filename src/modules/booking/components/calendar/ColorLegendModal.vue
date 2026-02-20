<template>
  <Modal :open="!!modelValue" :title="t('calendar.legend.title')" size="sm" @close="close">
    <div class="legend-items">
        <div class="legend-item">
          <div class="color-box first" />
          <span>{{ t('calendar.legend.first_lesson') }}</span>
        </div>
        <div class="legend-item">
          <div class="color-box regular" />
          <span>{{ t('calendar.legend.regular_lesson') }}</span>
        </div>
        <div class="legend-item">
          <div class="color-box no-show" />
          <span>{{ t('calendar.legend.no_show') }}</span>
        </div>
        <div class="legend-item">
          <div class="color-box blocked" />
          <span>{{ t('calendar.legend.blocked_time') }}</span>
        </div>
        <div class="legend-item">
          <div class="color-box past" />
          <span>{{ t('calendar.legend.past_time') }}</span>
        </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'

const { t } = useI18n()

const modelValue = defineModel<boolean>()

const close = () => {
  modelValue.value = false
}
</script>

<style scoped>
.legend-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-box {
  width: 40px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.color-box.first {
  background: var(--calendar-first-lesson, #9C27B0);
}

.color-box.regular {
  background: var(--calendar-regular-lesson, #4CAF50);
}

.color-box.no-show {
  background: var(--calendar-no-show, #757575);
}

.color-box.blocked {
  background: repeating-linear-gradient(
    45deg,
    var(--bg-secondary, #fafafa),
    var(--bg-secondary, #fafafa) 5px,
    var(--bg-tertiary, #f0f0f0) 5px,
    var(--bg-tertiary, #f0f0f0) 10px
  );
  border: 1px dashed var(--border-color);
}

.color-box.past {
  background: var(--bg-secondary);
  opacity: 0.6;
}

.legend-item span {
  font-size: 14px;
  color: var(--text-primary);
}
</style>
