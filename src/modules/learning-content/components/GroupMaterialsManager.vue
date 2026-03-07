<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLearningGroupStore } from '../stores/learningGroupStore'
import { useContentLibraryStore } from '../stores/contentLibraryStore'
import GroupSelector from './GroupSelector.vue'
import MaterialAccessToggle from './MaterialAccessToggle.vue'
import type { Subject } from '../types/learningContent'

const { t } = useI18n()
const groupStore = useLearningGroupStore()
const contentStore = useContentLibraryStore()

// Якщо передано ззовні — синхронізуємо з батьківським selectedGroupId
const props = defineProps<{
  externalGroupId?: string | null
}>()

const selectedGroupId = ref<string | null>(null)

// Коли батьківський компонент змінює вибір — синхронізуємо внутрішній стан
watch(() => props.externalGroupId, (gid) => {
  if (gid !== undefined) {
    selectedGroupId.value = gid ?? null
  }
}, { immediate: true })
const showCreateModal = ref(false)
const newGroupTitle = ref('')
const selectedSubjectId = ref<number | null>(null)
const subjectWarning = ref(false)

// ── Subjects for selector ────────────────────────────────────
onMounted(async () => {
  await groupStore.fetchGroups()
  if (contentStore.subjects.length === 0) {
    await contentStore.fetchSubjects()
  }
})

// ── Watch group selection ────────────────────────────────────
watch(selectedGroupId, async (groupId) => {
  if (groupId) {
    await groupStore.selectGroup(groupId)
    selectedSubjectId.value = groupStore.selectedGroup?.subject ?? null
  }
})

// ── Subject change (CL10 warning) ───────────────────────────
const canChangeSubject = computed(() => {
  if (!groupStore.selectedGroup) return false
  if (groupStore.selectedGroup.subject === null) return true
  return groupStore.activeMaterials.length === 0
})

async function onSubjectChange(subjectId: number | null) {
  if (!selectedGroupId.value) return
  if (!canChangeSubject.value && subjectId !== groupStore.selectedGroup?.subject) {
    subjectWarning.value = true
    return
  }
  subjectWarning.value = false
  await groupStore.updateSubject(selectedGroupId.value, subjectId)
}

// ── Create group ─────────────────────────────────────────────
async function createGroup() {
  if (!newGroupTitle.value.trim()) return
  const group = await groupStore.createGroup({
    title: newGroupTitle.value.trim(),
    subject: selectedSubjectId.value,
  })
  selectedGroupId.value = group.id
  showCreateModal.value = false
  newGroupTitle.value = ''
}

// ── Material actions ─────────────────────────────────────────
async function onToggleMaterial(materialId: string, isActive: boolean) {
  await groupStore.toggleMaterial(materialId, isActive)
}

async function onRemoveMaterial(materialId: string) {
  await groupStore.removeMaterial(materialId)
}
</script>

<template>
  <div class="group-materials-manager space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('learningContent.groups.manager') }}
      </h2>
      <button
        class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        @click="showCreateModal = true"
      >
        {{ t('learningContent.groups.createGroup') }}
      </button>
    </div>

    <!-- Group Selector: показуємо тільки якщо немає зовнішнього вибору -->
    <GroupSelector v-if="!props.externalGroupId" v-model="selectedGroupId" />

    <!-- Selected Group Panel -->
    <template v-if="groupStore.selectedGroup && selectedGroupId">
      <!-- Subject Selector -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('learningContent.groups.subjectLabel') }}
        </label>
        <select
          :value="selectedSubjectId"
          class="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
          :disabled="!canChangeSubject"
          @change="onSubjectChange(Number(($event.target as HTMLSelectElement).value) || null)"
        >
          <option :value="null">{{ t('learningContent.groups.noSubject') }}</option>
          <option
            v-for="subj in contentStore.subjects"
            :key="subj.id"
            :value="subj.id"
          >
            {{ subj.name }}
          </option>
        </select>

        <!-- CL10 Warning -->
        <p v-if="subjectWarning" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {{ t('learningContent.groups.subjectImmutableWarning') }}
        </p>
        <p v-else-if="!canChangeSubject" class="mt-1 text-xs text-gray-400">
          {{ t('learningContent.groups.subjectLocked') }}
        </p>
      </div>

      <!-- Materials List -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('learningContent.groups.materials') }}
            <span class="text-gray-400 ml-1">({{ groupStore.materials.length }})</span>
          </h3>
        </div>

        <!-- Materials -->
        <div v-if="groupStore.materials.length > 0" class="divide-y divide-gray-100 dark:divide-gray-700">
          <div
            v-for="material in groupStore.materials"
            :key="material.id"
            class="flex items-center justify-between px-4 py-3"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ material.content_title }}
              </p>
              <p class="text-xs text-gray-500">
                {{ material.content_type }}
              </p>
            </div>
            <MaterialAccessToggle
              :material-id="material.id"
              :is-active="material.is_active"
              @toggle="onToggleMaterial"
              @remove="onRemoveMaterial"
            />
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="p-8 text-center">
          <p class="text-sm text-gray-400">
            {{ t('learningContent.groups.noMaterials') }}
          </p>
          <p v-if="!groupStore.selectedGroup.subject" class="text-xs text-gray-400 mt-1">
            {{ t('learningContent.groups.selectSubjectHint') }}
          </p>
        </div>
      </div>
    </template>

    <!-- Loading -->
    <div v-if="groupStore.isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
    </div>

    <!-- Create Group Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ t('learningContent.groups.createGroup') }}
          </h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('learningContent.groups.groupTitle') }}
              </label>
              <input
                v-model="newGroupTitle"
                type="text"
                maxlength="200"
                class="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                :placeholder="t('learningContent.groups.titlePlaceholder')"
                @keydown.enter="createGroup"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('learningContent.groups.subjectLabel') }}
              </label>
              <select
                v-model="selectedSubjectId"
                class="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
              >
                <option :value="null">{{ t('learningContent.groups.noSubject') }}</option>
                <option
                  v-for="subj in contentStore.subjects"
                  :key="subj.id"
                  :value="subj.id"
                >
                  {{ subj.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button
              class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              @click="showCreateModal = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
              :disabled="!newGroupTitle.trim()"
              @click="createGroup"
            >
              {{ t('learningContent.groups.createGroup') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
