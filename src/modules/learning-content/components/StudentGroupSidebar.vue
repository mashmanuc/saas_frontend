<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLearningGroupStore } from '../stores/learningGroupStore'

const { t } = useI18n()
const store = useLearningGroupStore()

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'create-group': []
}>()

onMounted(async () => {
  if (store.groups.length === 0) {
    await store.fetchGroups()
  }
})

function selectGroup(groupId: string) {
  emit('update:modelValue', groupId)
}
</script>

<template>
  <aside class="student-group-sidebar w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 h-full overflow-y-auto">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
        {{ t('learningContent.groups.sidebarTitle') }}
      </h3>
    </div>

    <!-- Loading -->
    <div v-if="store.isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
    </div>

    <template v-else>
      <!-- ── Учні (Implicit Groups) ──────────────────────── -->
      <div v-if="store.implicitGroups.length > 0" class="py-2">
        <p class="px-4 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {{ t('learningContent.groups.sidebarStudents') }}
        </p>
        <button
          v-for="group in store.implicitGroups"
          :key="group.id"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
          :class="modelValue === group.id
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-r-2 border-indigo-600'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
          @click="selectGroup(group.id)"
        >
          <!-- Avatar placeholder -->
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
            {{ group.title.charAt(0).toUpperCase() }}
          </span>
          <div class="flex-1 min-w-0">
            <!-- CL2: IMPLICIT shows student name (title), NOT word "Group" -->
            <p class="truncate font-medium">{{ group.title }}</p>
            <p class="text-xs text-gray-400">
              {{ group.material_count }} {{ t('learningContent.groups.materials') }}
            </p>
          </div>
        </button>
      </div>

      <!-- ── Групи (Explicit Groups) ────────────────────── -->
      <div class="py-2">
        <p class="px-4 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {{ t('learningContent.groups.sidebarGroups') }}
        </p>
        <button
          v-for="group in store.explicitGroups"
          :key="group.id"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
          :class="modelValue === group.id
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-r-2 border-indigo-600'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
          @click="selectGroup(group.id)"
        >
          <!-- Group icon -->
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-medium">
            {{ group.title.charAt(0).toUpperCase() }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="truncate font-medium">{{ group.title }}</p>
            <p class="text-xs text-gray-400">
              {{ group.student_count }} {{ t('learningContent.groups.students') }},
              {{ group.material_count }} {{ t('learningContent.groups.materials') }}
            </p>
          </div>
        </button>

        <!-- + Create group -->
        <button
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          @click="emit('create-group')"
        >
          <span class="flex-shrink-0 w-8 h-8 rounded-full border-2 border-dashed border-indigo-300 dark:border-indigo-600 flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          <span class="font-medium">{{ t('learningContent.groups.createGroup') }}</span>
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-if="store.implicitGroups.length === 0 && store.explicitGroups.length === 0"
        class="px-4 py-8 text-center"
      >
        <p class="text-sm text-gray-400">{{ t('learningContent.groups.sidebarEmpty') }}</p>
        <p class="text-xs text-gray-400 mt-1">{{ t('learningContent.groups.sidebarEmptyHint') }}</p>
      </div>
    </template>
  </aside>
</template>
