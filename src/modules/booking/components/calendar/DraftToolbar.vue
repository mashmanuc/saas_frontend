<template>
  <Transition name="slide-down">
    <div v-if="isDirty" class="draft-toolbar" role="status" aria-live="polite">
    <div class="draft-info">
      <AlertCircleIcon class="w-5 h-5 text-amber-600" />
      <span>
        {{ $t('booking.draft.changesCount', { count: patchCount }) }}
      </span>
    </div>
    
    <div class="draft-actions">
      <button @click="handleReset" class="btn-secondary" aria-label="Reset all draft changes">
        {{ $t('common.reset') }}
      </button>
      <button
        @click="handleSaveAsTemplate"
        :disabled="applying"
        class="btn-template"
        aria-label="Save changes as recurring template"
      >
        <SaveIcon class="w-4 h-4" />
        {{ $t('booking.draft.saveAsTemplate') }}
      </button>
      <button
        @click="handleApply"
        :disabled="applying"
        class="btn-primary"
        aria-label="Apply all draft changes"
      >
        <LoaderIcon v-if="applying" class="w-4 h-4 animate-spin" />
        {{ $t('booking.draft.applyOnce') }}
      </button>
    </div>
    </div>
  </Transition>
  
  <TemplateConfirmModal
    v-if="showTemplateModal"
    :visible="showTemplateModal"
    :patches="patchesForModal"
    @confirm="handleTemplateConfirm"
    @close="showTemplateModal = false"
  />
  
  <GenerationProgressModal
    v-if="showProgressModal"
    :visible="showProgressModal"
    :job-id="generationJobId"
    @complete="handleGenerationComplete"
    @close="showProgressModal = false"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AlertCircle as AlertCircleIcon, Loader as LoaderIcon, Save as SaveIcon } from 'lucide-vue-next'
import { useDraftStore } from '@/modules/booking/stores/draftStore'
import { useCalendarStore } from '@/modules/booking/stores/calendarStore'
import { useToast } from '@/composables/useToast'
import TemplateConfirmModal from '@/modules/booking/components/modals/TemplateConfirmModal.vue'
import GenerationProgressModal from '@/modules/booking/components/availability/GenerationProgressModal.vue'

const draftStore = useDraftStore()
const calendarStore = useCalendarStore()
const toast = useToast()

const applying = ref(false)
const showTemplateModal = ref(false)
const showProgressModal = ref(false)
const generationJobId = ref<string | null>(null)

const isDirty = computed(() => draftStore.isDirty)
const patchCount = computed(() => draftStore.getAllPatches().length)
const patchesForModal = computed(() => draftStore.getAllPatches().map(p => ({
  startAtUTC: p.startAtUTC,
  newStatus: (p.action === 'set_available' ? 'available' : 'blocked') as 'available' | 'blocked',
  originalStatus: p.originalStatus,
})))

async function handleApply() {
  applying.value = true
  
  try {
    const result = await draftStore.applyPatches()
    
    if (result.summary.rejected > 0) {
      toast.warning(`Застосовано ${result.summary.applied} змін. ${result.summary.rejected} відхилено через конфлікти.`)
    } else {
      toast.success(`Застосовано ${result.summary.applied} змін`)
    }
    
  } catch (err) {
    toast.error('Помилка при застосуванні змін')
  } finally {
    applying.value = false
  }
}

function handleReset() {
  if (confirm('Скасувати всі зміни?')) {
    draftStore.clearAllPatches()
    toast.info('Зміни скасовано')
  }
}

function handleSaveAsTemplate() {
  showTemplateModal.value = true
}

async function handleTemplateConfirm() {
  showTemplateModal.value = false
  applying.value = true
  
  try {
    const timezone = calendarStore.settings?.timezone || 'Europe/Kiev'
    const result = await draftStore.saveAsTemplate(timezone)
    
    toast.success('Шаблон збережено!')
    
    // Show progress modal
    generationJobId.value = result.last_generation_job_id
    showProgressModal.value = true
    
  } catch (err) {
    toast.error('Помилка при збереженні шаблону')
    console.error(err)
  } finally {
    applying.value = false
  }
}

function handleGenerationComplete() {
  showProgressModal.value = false
  toast.success('Слоти згенеровано успішно!')
  
  // Reload calendar
  calendarStore.loadWeekView({
    tutorId: undefined,
    weekStart: calendarStore.currentWeekRange.start.toISOString().split('T')[0],
    timezone: calendarStore.settings?.timezone || 'Europe/Kiev',
  })
}
</script>

<style scoped>
.draft-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  margin-bottom: 16px;
}

.draft-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #92400e;
}

.draft-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background-color: #f3f4f6;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-template {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #10b981;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-template:hover:not(:disabled) {
  background-color: #059669;
}

.btn-template:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
