<template>
  <div class="calendar-header-v2">
    <div class="header-message">
      <svg class="info-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z" fill="#1976D2"/>
      </svg>
      <span>{{ t('calendar.header.reminder') }}</span>
    </div>
    <div class="header-actions">
      <button class="btn-primary" @click="$emit('open-quick-block')">
        {{ t('calendar.header.mark_free_time') }}
      </button>
      <button class="btn-link" @click="showLegend = true">
        {{ t('calendar.header.color_legend') }}
      </button>
      <button class="btn-link" @click="openVideoGuide">
        {{ t('calendar.header.video_guide') }}
      </button>
    </div>
  </div>
  
  <ColorLegendModal v-model="showLegend" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ColorLegendModal from './ColorLegendModal.vue'

const { t } = useI18n()
const showLegend = ref(false)

defineEmits<{
  'open-quick-block': []
}>()

const openVideoGuide = () => {
  window.open('https://www.youtube.com/watch?v=calendar-guide', '_blank')
}
</script>

<style scoped>
.calendar-header-v2 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #f5f7fa;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid #e0e0e0;
}

.header-message {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #1976D2;
  font-size: 14px;
}

.info-icon {
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn-primary {
  padding: 10px 20px;
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #1565C0;
}

.btn-link {
  padding: 8px 16px;
  background: transparent;
  color: #1976D2;
  border: none;
  font-size: 14px;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.btn-link:hover {
  color: #1565C0;
}

@media (max-width: 768px) {
  .calendar-header-v2 {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
