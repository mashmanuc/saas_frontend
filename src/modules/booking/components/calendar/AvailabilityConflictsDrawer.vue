<template>
  <Modal
    :open="isOpen"
    :title="$t('calendar.availability.conflicts.title') + ` (${conflicts.length})`"
    size="md"
    @close="$emit('close')"
  >
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

    <p class="footer-note">
      {{ $t('calendar.availability.conflicts.note') }}
    </p>

    <template #footer>
      <Button variant="ghost" @click="$emit('close')">
        {{ $t('calendar.availability.conflicts.cancel') }}
      </Button>
      <Button
        v-if="allowForce"
        variant="danger"
        @click="$emit('force-apply')"
      >
        {{ $t('calendar.availability.conflicts.force') }}
      </Button>
      <Button
        variant="primary"
        @click="$emit('edit')"
      >
        {{ $t('calendar.availability.conflicts.edit') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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
.drawer-content {
  overflow-y: auto;
}

.conflicts-description {
  font-size: 14px;
  color: var(--text-secondary);
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
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.conflict-item.conflict-event_overlap {
  border-color: var(--warning, #ff9800);
  background: var(--warning-bg, #fff3e0);
}

.conflict-item.conflict-blocked_overlap {
  border-color: var(--danger, #f44336);
  background: var(--danger-bg, #ffebee);
}

.conflict-item.conflict-slot_overlap {
  border-color: var(--calendar-first-lesson, #9c27b0);
  background: var(--calendar-first-lesson-bg, #f3e5f5);
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
  color: var(--text-primary);
  margin: 0;
}

.conflict-time {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  gap: 8px;
}

.time-label {
  font-weight: 500;
  color: var(--text-muted);
}

.time-value {
  color: var(--text-primary);
}

.footer-note {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  text-align: center;
}
</style>
