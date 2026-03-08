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

// Inline delete confirmation — не видаляємо одразу, просимо підтвердження
const pendingDeleteId = ref<string | null>(null)

function onRemoveMaterial(materialId: string) {
  pendingDeleteId.value = materialId
}

async function confirmDelete() {
  if (!pendingDeleteId.value) return
  await groupStore.removeMaterial(pendingDeleteId.value)
  pendingDeleteId.value = null
}

function cancelDelete() {
  pendingDeleteId.value = null
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
            <!-- Inline delete confirmation -->
            <div v-if="pendingDeleteId === material.id" class="flex items-center gap-2 ml-2">
              <span class="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                Видалити з класу?
              </span>
              <button
                type="button"
                class="px-2 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                title="Підтвердити видалення матеріалу з класу"
                @click="confirmDelete"
              >
                Так
              </button>
              <button
                type="button"
                class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Скасувати видалення"
                @click="cancelDelete"
              >
                Ні
              </button>
            </div>

            <MaterialAccessToggle
              v-else
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

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('learningContent.groups.groupTitle') }}
            </label>
            <input
              v-model="newGroupTitle"
              type="text"
              maxlength="200"
              autofocus
              class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              :placeholder="t('learningContent.groups.titlePlaceholder')"
              @keydown.enter="createGroup"
            />
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
