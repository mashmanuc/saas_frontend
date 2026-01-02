<template>
  <div 
    v-if="isOpen"
    class="conflicts-drawer-overlay"
    @click="$emit('close')"
  >
    <div 
      class="conflicts-drawer"
      @click.stop
      role="dialog"
      aria-modal="true"
      :aria-label="$t('calendar.availability.conflicts.title')"
    >
      <div class="drawer-header">
        <h3 class="drawer-title">
          {{ $t('calendar.availability.conflicts.title') }}
          <span class="conflicts-count">({{ conflicts.length }})</span>
        </h3>
        <button
          class="btn-icon btn-close"
          @click="$emit('close')"
          :aria-label="$t('common.close')"
        >
          ×
        </button>
      </div>

      <div class="drawer-content">
        <p class="conflicts-description">
          {{ $t('calendar.availability.conflicts.description') }}
        </p>

        <div class="conflicts-list">
          <div
            v-for="(conflict, index) in conflicts"
            :key="index"
            class="conflict-item"
            :class="`conflict-${conflict.type}`"
          >
            <div class="conflict-icon">
              <span v-if="conflict.type === 'event_overlap'">📅</span>
              <span v-else-if="conflict.type === 'blocked_overlap'">🚫</span>
              <span v-else>⚠️</span>
            </div>
            
            <div class="conflict-details">
              <p class="conflict-title">
                <template v-if="conflict.type === 'event_overlap'">
                  {{ $t('calendar.availability.conflicts.event_overlap', { student: conflict.event?.studentName }) }}
                </template>
                <template v-else-if="conflict.type === 'blocked_overlap'">
                  {{ $t('calendar.availability.conflicts.blocked_overlap', { reason: conflict.blockedRange?.reason }) }}
                </template>
                <template v-else>
                  {{ $t('calendar.availability.conflicts.slot_overlap') }}
                </template>
              </p>
              
              <div class="conflict-time">
                <span class="time-label">{{ $t('calendar.availability.conflicts.slot') }}:</span>
                <span class="time-value">{{ formatTime(conflict.slot.start) }} - {{ formatTime(conflict.slot.end) }}</span>
              </div>
              
              <div v-if="conflict.event" class="conflict-time">
                <span class="time-label">{{ $t('calendar.availability.conflicts.event') }}:</span>
                <span class="time-value">{{ formatTime(conflict.event.start) }} - {{ formatTime(conflict.event.end) }}</span>
              </div>
              
              <div v-if="conflict.blockedRange" class="conflict-time">
                <span class="time-label">{{ $t('calendar.availability.conflicts.blocked') }}:</span>
                <span class="time-value">{{ formatTime(conflict.blockedRange.start) }} - {{ formatTime(conflict.blockedRange.end) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="drawer-footer">
        <p class="footer-note">
          {{ $t('calendar.availability.conflicts.note') }}
        </p>
        <div class="footer-actions">
          <button
            class="btn-secondary"
            @click="$emit('close')"
          >
            {{ $t('calendar.availability.conflicts.cancel') }}
          </button>
          <button
            v-if="allowForce"
            class="btn-danger"
            @click="$emit('force-apply')"
          >
            {{ $t('calendar.availability.conflicts.force') }}
          </button>
          <button
            class="btn-primary"
            @click="$emit('edit')"
          >
            {{ $t('calendar.availability.conflicts.edit') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConflictEntry } from '@/modules/booking/api/calendarAvailabilityApi'

defineProps<{
  isOpen: boolean
  conflicts: ConflictEntry[]
  allowForce?: boolean
}>()

defineEmits<{
  'close': []
  'edit': []
  'force-apply': []
}>()

const formatTime = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.conflicts-drawer-overlay {
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
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.conflicts-drawer {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.drawer-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.conflicts-count {
  font-size: 16px;
  color: #f44336;
  font-weight: 500;
}

.btn-close {
  font-size: 28px;
  line-height: 1;
  color: #666;
  padding: 4px 8px;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.conflicts-description {
  font-size: 14px;
  color: #666;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.conflicts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conflict-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  background: #fafafa;
}

.conflict-item.conflict-event_overlap {
  border-color: #ff9800;
  background: #fff3e0;
}

.conflict-item.conflict-blocked_overlap {
  border-color: #f44336;
  background: #ffebee;
}

.conflict-item.conflict-slot_overlap {
  border-color: #9c27b0;
  background: #f3e5f5;
}

.conflict-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.conflict-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conflict-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.conflict-time {
  font-size: 13px;
  color: #666;
  display: flex;
  gap: 8px;
}

.time-label {
  font-weight: 500;
  color: #999;
}

.time-value {
  color: #1a1a1a;
}

.drawer-footer {
  padding: 20px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer-note {
  font-size: 12px;
  color: #999;
  margin: 0;
  text-align: center;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.footer-actions button {
  flex: 1;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover {
  background: #d32f2f;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn-icon:hover {
  opacity: 0.7;
}
</style>
