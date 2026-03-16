<template>
  <div class="border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
    <h4 class="font-semibold mb-3 flex items-center gap-2 text-yellow-800 dark:text-yellow-200 text-sm">
      <Shield :size="16" />
      {{ t('knowledge.publish.consent.title') }}
    </h4>

    <label class="flex items-center gap-2 mb-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
      <input
        type="checkbox"
        :checked="modelValue.hasStudentData"
        class="accent-yellow-600 w-4 h-4"
        @change="update('hasStudentData', ($event.target as HTMLInputElement).checked)"
      />
      {{ t('knowledge.publish.consent.hasStudentData') }}
    </label>

    <div v-if="modelValue.hasStudentData" class="ml-6 space-y-2 mt-2">
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          :checked="modelValue.studentConsented"
          class="accent-green-600 w-4 h-4"
          @change="update('studentConsented', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('knowledge.publish.consent.studentConsented') }}
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          :checked="modelValue.anonymize"
          class="accent-blue-600 w-4 h-4"
          @change="update('anonymize', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('knowledge.publish.consent.anonymize') }}
      </label>
      <p
        v-if="modelValue.hasStudentData && !modelValue.studentConsented && !modelValue.anonymize"
        class="text-red-500 dark:text-red-400 text-sm flex items-center gap-1"
        role="alert"
      >
        <AlertTriangle :size="14" />
        {{ t('knowledge.publish.consent.warning') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Shield, AlertTriangle } from 'lucide-vue-next'

export interface ConsentData {
  hasStudentData: boolean
  studentConsented: boolean
  anonymize: boolean
}

const props = defineProps<{
  modelValue: ConsentData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ConsentData]
}>()

const { t } = useI18n()

function update(field: keyof ConsentData, value: boolean) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>
