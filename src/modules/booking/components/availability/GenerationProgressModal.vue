<template>
  <Modal
    :open="visible"
    :title="$t('booking.template.generatingSlots')"
    size="md"
    :persistent="status === 'running'"
    @close="handleClose"
  >
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

    <template #footer>
      <Button
        v-if="status === 'done'"
        variant="primary"
        @click="handleComplete"
      >
        {{ $t('common.continue') }}
      </Button>

      <Button
        v-else-if="status === 'failed'"
        variant="outline"
        @click="handleClose"
      >
        {{ $t('common.close') }}
      </Button>

      <Button
        v-else
        variant="outline"
        :disabled="status === 'running'"
        @click="handleClose"
      >
        {{ $t('common.cancel') }}
      </Button>
    </template>
  </Modal>
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
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

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

</style>
