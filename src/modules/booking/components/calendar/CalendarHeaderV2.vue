<template>
  <div class="calendar-header-v2">
    <div class="header-content">
      <div class="info-message">
        <svg class="icon-info" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9V9h2v6zm0-8H9V5h2v2z" fill="currentColor"/>
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
        
        <a 
          href="https://www.youtube.com/watch?v=example" 
          target="_blank" 
          rel="noopener noreferrer"
          class="btn-link"
        >
          {{ t('calendar.header.video_guide') }}
        </a>
      </div>
    </div>

    <div class="week-navigation-wrapper">
      <WeekNavigationSimple
        :week-start="weekStart"
        :week-end="weekEnd"
        :current-page="currentPage"
        :is-loading="isWeekLoading"
        @navigate="handleNavigate"
        @today="handleToday"
      />
    </div>
    
    <ColorLegendModal v-model="showLegend" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import ColorLegendModal from './ColorLegendModal.vue'
import WeekNavigationSimple from './WeekNavigationSimple.vue'

const props = defineProps<{
  weekStart?: string
  weekEnd?: string
  currentPage: number
  isWeekLoading: boolean
}>()

const emit = defineEmits<{
  'open-quick-block': []
  navigate: [direction: -1 | 1]
  today: []
}>()

const { t } = useI18n()
const showLegend = ref(false)

function handleNavigate(direction: -1 | 1) {
  console.log('[CalendarHeaderV2] handleNavigate called', { direction })
  emit('navigate', direction)
  console.log('[CalendarHeaderV2] navigate event emitted')
}

function handleToday() {
  console.log('[CalendarHeaderV2] handleToday called')
  emit('today')
  console.log('[CalendarHeaderV2] today event emitted')
}
</script>

<style scoped>
.calendar-header-v2 {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 24px 24px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.week-navigation-wrapper {
  margin-top: 16px;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.info-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.icon-info {
  color: var(--accent);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
