<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  materialId: string
  isActive: boolean
}>()

const emit = defineEmits<{
  toggle: [materialId: string, isActive: boolean]
  remove: [materialId: string]
}>()

const toggling = ref(false)

async function onToggle() {
  toggling.value = true
  try {
    emit('toggle', props.materialId, !props.isActive)
  } finally {
    toggling.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Toggle вмикання/вимикання матеріалу в групі -->
    <button
      class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      :class="isActive ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
      :disabled="toggling"
      role="switch"
      :aria-checked="isActive"
      :title="isActive
        ? t('learningContent.groups.materialActive')
        : t('learningContent.groups.materialInactive')"
      :aria-label="isActive
        ? t('learningContent.groups.materialActive')
        : t('learningContent.groups.materialInactive')"
      @click="onToggle"
    >
      <span
        class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
        :class="isActive ? 'translate-x-4' : 'translate-x-0'"
      />
    </button>

    <!-- Кнопка видалення матеріалу з групи -->
    <button
      class="text-gray-400 hover:text-red-500 transition-colors p-1"
      :title="t('learningContent.groups.removeMaterial')"
      @click="emit('remove', materialId)"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  </div>
</template>
