<template>
  <div class="availability-legend" role="complementary" :aria-label="$t('calendar.availability.legend.label')">
    <h4 class="legend-title">{{ $t('calendar.availability.legend.title') }}</h4>
    
    <div class="legend-items">
      <div class="legend-item">
        <div class="legend-color available" />
        <div class="legend-text">
          <span class="legend-label">{{ $t('calendar.availability.legend.available') }}</span>
          <span class="legend-description">{{ $t('calendar.availability.legend.available.desc') }}</span>
        </div>
      </div>
      
      <div class="legend-item">
        <div class="legend-color draft-add" />
        <div class="legend-text">
          <span class="legend-label">{{ $t('calendar.availability.legend.draft.add') }}</span>
          <span class="legend-description">{{ $t('calendar.availability.legend.draft.add.desc') }}</span>
        </div>
      </div>
      
      <div class="legend-item">
        <div class="legend-color draft-remove" />
        <div class="legend-text">
          <span class="legend-label">{{ $t('calendar.availability.legend.draft.remove') }}</span>
          <span class="legend-description">{{ $t('calendar.availability.legend.draft.remove.desc') }}</span>
        </div>
      </div>
      
      <div class="legend-item">
        <div class="legend-color event" />
        <div class="legend-text">
          <span class="legend-label">{{ $t('calendar.availability.legend.event') }}</span>
          <span class="legend-description">{{ $t('calendar.availability.legend.event.desc') }}</span>
        </div>
      </div>
      
      <div class="legend-item">
        <div class="legend-color blocked" />
        <div class="legend-text">
          <span class="legend-label">{{ $t('calendar.availability.legend.blocked') }}</span>
          <span class="legend-description">{{ $t('calendar.availability.legend.blocked.desc') }}</span>
        </div>
      </div>
    </div>
    
    <div class="legend-actions">
      <div class="action-item">
        <span class="action-icon add">+</span>
        <span class="action-text">{{ $t('calendar.availability.legend.action.add') }}</span>
      </div>
      <div class="action-item">
        <span class="action-icon remove">×</span>
        <span class="action-text">{{ $t('calendar.availability.legend.action.remove') }}</span>
      </div>
    </div>
    
    <div class="legend-tips">
      <p class="tip-title">{{ $t('calendar.availability.legend.tips.title') }}</p>
      <ul class="tip-list">
        <li>{{ $t('calendar.availability.legend.tips.hover') }}</li>
        <li>{{ $t('calendar.availability.legend.tips.click') }}</li>
        <li>{{ $t('calendar.availability.legend.tips.keyboard') }}</li>
        <li>{{ $t('calendar.availability.legend.tips.undo') }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props or emits needed - pure presentational component
</script>

<style scoped>
.availability-legend {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}

.legend-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.legend-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.legend-color {
  width: 40px;
  height: 32px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.legend-color.available {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-color: #4caf50;
}

.legend-color.draft-add {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.3) 0%, rgba(76, 175, 80, 0.5) 100%);
  border: 2px dashed #4caf50;
}

.legend-color.draft-remove {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.3) 0%, rgba(244, 67, 54, 0.5) 100%);
  border: 2px dashed #f44336;
}

.legend-color.event {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-color: #2196f3;
}

.legend-color.blocked {
  background: repeating-linear-gradient(
    45deg,
    #fafafa,
    #fafafa 10px,
    #e0e0e0 10px,
    #e0e0e0 20px
  );
  border-color: #9e9e9e;
}

.legend-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.legend-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.legend-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.legend-actions {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 20px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.action-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 20px;
  background: var(--card-bg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-icon.add {
  color: #4caf50;
  border: 2px solid #4caf50;
}

.action-icon.remove {
  color: #f44336;
  border: 2px solid #f44336;
}

.action-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.legend-tips {
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.tip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.tip-list {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
}

.tip-list li {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 4px;
}

.tip-list li:last-child {
  margin-bottom: 0;
}
</style>
