<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container">
      <div class="modal-header">
        <h2>{{ $t('booking.template.generatingSlots') }}</h2>
      </div>
      
      <div class="progress-content">
        <div v-if="status === 'queued'" class="status-section">
          <ClockIcon class="w-12 h-12 text-blue-500 animate-pulse" />
          <p class="status-text">{{ $t('booking.template.jobQueued') }}</p>
        </div>
        
        <div v-else-if="status === 'running'" class="status-section">
          <LoaderIcon class="w-12 h-12 text-blue-500 animate-spin" />
          <p class="status-text">{{ $t('booking.template.jobRunning') }}</p>
          <div class="progress-stats">
            <div class="stat-item">
              <span class="stat-label">{{ $t('booking.template.slotsCreated') }}:</span>
              <span class="stat-value">{{ jobData?.slots_created || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ $t('booking.template.slotsDeleted') }}:</span>
              <span class="stat-value">{{ jobData?.slots_deleted || 0 }}</span>
            </div>
          </div>
        </div>
        
        <div v-else-if="status === 'done'" class="status-section">
          <CheckCircleIcon class="w-12 h-12 text-green-500" />
          <p class="status-text success">{{ $t('booking.template.jobComplete') }}</p>
          <div class="progress-stats">
            <div class="stat-item">
              <span class="stat-label">{{ $t('booking.template.slotsCreated') }}:</span>
              <span class="stat-value">{{ jobData?.slots_created || 0 }}</span>
            </div>
          </div>
        </div>
        
        <div v-else-if="status === 'failed'" class="status-section">
          <AlertCircleIcon class="w-12 h-12 text-red-500" />
          <p class="status-text error">{{ $t('booking.template.jobFailed') }}</p>
          <p v-if="jobData?.error_message" class="error-message">
            {{ jobData.error_message }}
          </p>
        </div>
      </div>
      
      <div class="modal-actions">
        <button
          v-if="status === 'done'"
          @click="handleComplete"
          class="btn-primary"
        >
          {{ $t('common.continue') }}
        </button>
        
        <button
          v-else-if="status === 'failed'"
          @click="handleClose"
          class="btn-secondary"
        >
          {{ $t('common.close') }}
        </button>
        
        <button
          v-else
          @click="handleClose"
          class="btn-secondary"
          :disabled="status === 'running'"
        >
          {{ $t('common.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import {
  Clock as ClockIcon,
  Loader as LoaderIcon,
  CheckCircle as CheckCircleIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-vue-next'
import { availabilityApi, type GenerationJob } from '@/modules/booking/api/availabilityApi'

const props = defineProps<{
  visible: boolean
  jobId: string | null
}>()

const emit = defineEmits<{
  complete: []
  close: []
}>()

const status = ref<'queued' | 'running' | 'done' | 'failed'>('queued')
const jobData = ref<GenerationJob | null>(null)
let pollInterval: NodeJS.Timeout | null = null

watch(() => props.jobId, (newJobId) => {
  if (newJobId && props.visible) {
    startPolling()
  } else {
    stopPolling()
  }
}, { immediate: true })

watch(() => props.visible, (visible) => {
  if (!visible) {
    stopPolling()
  } else if (props.jobId) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})

function startPolling() {
  stopPolling()
  
  pollInterval = setInterval(async () => {
    if (!props.jobId) return
    
    try {
      const data = await availabilityApi.getGenerationJobStatus(props.jobId)
      jobData.value = data
      status.value = data.status
      
      if (data.status === 'done' || data.status === 'failed') {
        stopPolling()
        
        if (data.status === 'done') {
          setTimeout(() => {
            emit('complete')
          }, 1500)
        }
      }
    } catch (error) {
      console.error('Failed to poll job status:', error)
    }
  }, 2000)
  
  // Initial fetch
  if (props.jobId) {
    availabilityApi.getGenerationJobStatus(props.jobId).then(data => {
      jobData.value = data
      status.value = data.status
    })
  }
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

function handleComplete() {
  emit('complete')
}

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  margin-bottom: 24px;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.progress-content {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  width: 100%;
}

.status-text {
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

.status-text.success {
  color: var(--success);
}

.status-text.error {
  color: var(--danger);
}

.error-message {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 12px;
  background-color: var(--danger-bg, #fee2e2);
  border-radius: 8px;
  margin-top: 8px;
}

.progress-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 300px;
  margin-top: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.btn-primary {
  padding: 10px 20px;
  background-color: var(--accent);
  color: white;
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: var(--accent-hover, #2563eb);
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--bg-secondary);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
