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
        <button class="btn-primary" @click="$emit('open-quick-block')">
          <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 0v16M0 8h16" stroke="currentColor" stroke-width="2"/>
          </svg>
          {{ t('calendar.header.mark_free_time') }}
        </button>
        
        <button class="btn-link" @click="showLegend = true">
          {{ t('calendar.header.color_legend') }}
        </button>
        
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
      <WeekNavigation
        :week-start="weekStart"
        :week-end="weekEnd"
        :current-page="currentPage"
        :is-loading="isWeekLoading"
        :total-available-hours="totalAvailableHours"
        :has-availability="hasAvailability"
        @navigate="direction => emit('navigate', direction)"
        @today="emit('today')"
        @scroll-first-available="emit('scroll-first-available')"
        @open-availability="emit('open-availability')"
        @create-slot="emit('create-slot')"
        @show-guide="emit('show-guide')"
      />
    </div>
    
    <ColorLegendModal v-model="showLegend" />
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import ColorLegendModal from './ColorLegendModal.vue'
import WeekNavigation from './WeekNavigation.vue'

const props = defineProps<{
  weekStart?: string
  weekEnd?: string
  currentPage: number
  isWeekLoading: boolean
  totalAvailableHours?: number | null
  hasAvailability?: boolean
}>()

const emit = defineEmits<{
  'open-quick-block': []
  navigate: [direction: -1 | 1]
  today: []
  'scroll-first-available': []
  'open-availability': []
  'create-slot': []
  'show-guide': []
}>()

const { t } = useI18n()
const showLegend = ref(false)

const {
  weekStart,
  weekEnd,
  currentPage,
  isWeekLoading,
  totalAvailableHours,
  hasAvailability,
} = toRefs(props)
</script>

<style scoped>
.calendar-header-v2 {
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
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
  color: #616161;
  font-size: 14px;
}

.icon-info {
  color: #2196F3;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-primary .icon {
  flex-shrink: 0;
}

.btn-link {
  background: none;
  border: none;
  color: #2196F3;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-link:hover {
  background: rgba(33, 150, 243, 0.1);
  text-decoration: underline;
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
  
  .btn-primary,
  .btn-link {
    width: 100%;
    justify-content: center;
  }
}
</style>
