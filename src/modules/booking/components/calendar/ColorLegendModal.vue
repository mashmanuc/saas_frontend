<template>
  <div v-if="modelValue" class="modal-overlay" @click="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ t('calendar.legend.title') }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const modelValue = defineModel<boolean>()

const close = () => {
  modelValue.value = false
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

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
  background: #9C27B0;
}

.color-box.regular {
  background: #4CAF50;
}

.color-box.no-show {
  background: #757575;
}

.color-box.blocked {
  background: repeating-linear-gradient(
    45deg,
    #fafafa,
    #fafafa 5px,
    #f0f0f0 5px,
    #f0f0f0 10px
  );
  border: 1px dashed #ccc;
}

.color-box.past {
  background: #f5f5f5;
  opacity: 0.6;
}

.legend-item span {
  font-size: 14px;
  color: #333;
}
</style>
