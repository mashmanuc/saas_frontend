<template>
  <div class="calendar-header-v2">
    <div class="header-message">
      <svg class="info-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z" fill="#1976D2"/>
      </svg>
      <span>{{ t('calendar.header.reminder') }}</span>
    </div>
    <div class="header-actions">
      <Button variant="primary" @click="$emit('open-quick-block')">
        {{ t('calendar.header.mark_free_time') }}
      </Button>
      <Button variant="ghost" @click="showLegend = true">
        {{ t('calendar.header.color_legend') }}
      </Button>
      <Button variant="ghost" @click="openVideoGuide">
        {{ t('calendar.header.video_guide') }}
      </Button>
    </div>
  </div>
  
  <ColorLegendModal v-model="showLegend" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
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
  background: var(--bg-secondary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  border-bottom: 1px solid var(--border-color);
}

.header-message {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--accent);
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
