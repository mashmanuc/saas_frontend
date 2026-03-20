<!-- Phase 24: Folder sidebar for My Lessons
     Supports nested folders up to 3 levels (INV-ORG-1).
     Create child folders via "+" button on each folder row. -->
<template>
  <aside class="wb-folders w-56 shrink-0 border-r border-gray-200 pr-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide">
        {{ $t('knowledge.folder.title') }}
      </h3>
      <button
        type="button"
        class="text-sm text-primary-600 hover:text-primary-700 font-medium"
        @click="startCreate(null)"
        :title="$t('knowledge.folder.create')"
      >
        +
      </button>
    </div>

    <!-- Create folder input (root level) -->
    <div v-if="creatingParentId === null && showCreateInput" class="mb-2">
      <input
        v-model="newFolderName"
        type="text"
        maxlength="100"
        :placeholder="$t('knowledge.folder.namePlaceholder')"
        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
        @keydown.enter="createFolder"
        @keydown.escape="cancelCreate"
        ref="createInput"
      />
    </div>

    <!-- Folder tree -->
    <ul class="space-y-0.5">
      <!-- All lessons (no filter) -->
      <li>
        <button
          type="button"
          class="w-full text-left px-2 py-1.5 text-sm rounded-lg transition-colors"
          :class="activeFolder === null ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'"
          @click="selectFolder(null)"
        >
          {{ $t('knowledge.folder.allLessons') }}
          <span class="text-xs text-gray-400 ml-1">({{ totalCount }})</span>
        </button>
      </li>

      <!-- Root (unfiled) -->
      <li>
        <button
          type="button"
          class="w-full text-left px-2 py-1.5 text-sm rounded-lg transition-colors"
          :class="activeFolder === 'root' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'"
          @click="selectFolder('root')"
        >
          {{ $t('knowledge.folder.unfiled') }}
        </button>
      </li>

      <!-- Level 0: Root folders -->
      <li v-for="f0 in rootFolders" :key="f0.id">
        <!-- Folder row: depth 0 -->
        <div class="flex items-center group">
          <!-- Rename mode (Phase 25 BUG-3) -->
          <input
            v-if="renamingFolderId === f0.id"
            v-model="renameValue"
            type="text"
            maxlength="100"
            class="flex-1 px-2 py-1 text-sm border border-primary-300 rounded focus:ring-1 focus:ring-primary-500 bg-white"
            ref="renameInput"
            @keydown.enter="executeRename"
            @keydown.escape="cancelRename"
            @blur="executeRename"
          />
          <!-- Normal display -->
          <button
            v-else
            type="button"
            class="flex-1 text-left px-2 py-1.5 text-sm rounded-lg transition-colors truncate"
            :class="activeFolder === f0.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'"
            @click="selectFolder(f0.id)"
            @dblclick.prevent="startRename(f0)"
            :title="f0.name"
          >
            📁 {{ f0.name }}
            <span class="text-xs text-gray-400 ml-1">({{ f0.lesson_count }})</span>
          </button>
          <!-- Rename button (Phase 25 BUG-3) -->
          <button
            type="button"
            class="hidden group-hover:block text-xs text-gray-400 hover:text-primary-500 px-1"
            :title="$t('knowledge.folder.rename')"
            @click.stop="startRename(f0)"
          >✏️</button>
          <button
            type="button"
            class="hidden group-hover:block text-xs text-primary-500 hover:text-primary-700 px-1"
            :title="$t('knowledge.folder.createChild')"
            @click.stop="startCreate(f0.id)"
          >+</button>
          <button
            type="button"
            class="hidden group-hover:block text-xs text-gray-400 hover:text-red-500 px-1"
            :title="$t('knowledge.folder.delete')"
            @click.stop="handleDeleteFolder(f0)"
          >✕</button>
        </div>

        <!-- Create child input for depth 0 -->
        <div v-if="showCreateInput && creatingParentId === f0.id" class="ml-4 mt-0.5">
          <input
            v-model="newFolderName"
            type="text"
            maxlength="100"
            :placeholder="$t('knowledge.folder.namePlaceholder')"
            class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
            @keydown.enter="createFolder"
            @keydown.escape="cancelCreate"
            ref="createInput"
          />
        </div>

        <!-- Level 1: Children -->
        <ul v-if="getChildren(f0.id).length" class="ml-4 mt-0.5 space-y-0.5">
          <li v-for="f1 in getChildren(f0.id)" :key="f1.id">
            <div class="flex items-center group">
              <!-- Rename mode (Phase 25 BUG-3) -->
              <input
                v-if="renamingFolderId === f1.id"
                v-model="renameValue"
                type="text"
                maxlength="100"
                class="flex-1 px-2 py-1 text-sm border border-primary-300 rounded focus:ring-1 focus:ring-primary-500 bg-white"
                ref="renameInput"
                @keydown.enter="executeRename"
                @keydown.escape="cancelRename"
                @blur="executeRename"
              />
              <!-- Normal display -->
              <button
                v-else
                type="button"
                class="flex-1 text-left px-2 py-1 text-sm rounded-lg transition-colors truncate"
                :class="activeFolder === f1.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'"
                @click="selectFolder(f1.id)"
                @dblclick.prevent="startRename(f1)"
                :title="f1.name"
              >
                📁 {{ f1.name }}
                <span class="text-xs text-gray-400 ml-1">({{ f1.lesson_count }})</span>
              </button>
              <!-- Rename button (Phase 25 BUG-3) -->
              <button
                type="button"
                class="hidden group-hover:block text-xs text-gray-400 hover:text-primary-500 px-1"
                :title="$t('knowledge.folder.rename')"
                @click.stop="startRename(f1)"
              >✏️</button>
              <button
                type="button"
                class="hidden group-hover:block text-xs text-primary-500 hover:text-primary-700 px-1"
                :title="$t('knowledge.folder.createChild')"
                @click.stop="startCreate(f1.id)"
              >+</button>
              <button
                type="button"
                class="hidden group-hover:block text-xs text-gray-400 hover:text-red-500 px-1"
                :title="$t('knowledge.folder.delete')"
                @click.stop="handleDeleteFolder(f1)"
              >✕</button>
            </div>

            <!-- Create child input for depth 1 -->
            <div v-if="showCreateInput && creatingParentId === f1.id" class="ml-4 mt-0.5">
              <input
                v-model="newFolderName"
                type="text"
                maxlength="100"
                :placeholder="$t('knowledge.folder.namePlaceholder')"
                class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                @keydown.enter="createFolder"
                @keydown.escape="cancelCreate"
              />
            </div>

            <!-- Level 2: Grandchildren (max depth — no "+" button) -->
            <ul v-if="getChildren(f1.id).length" class="ml-4 mt-0.5 space-y-0.5">
              <li v-for="f2 in getChildren(f1.id)" :key="f2.id">
                <div class="flex items-center group">
                  <!-- Rename mode (Phase 25 BUG-3) -->
                  <input
                    v-if="renamingFolderId === f2.id"
                    v-model="renameValue"
                    type="text"
                    maxlength="100"
                    class="flex-1 px-2 py-1 text-xs border border-primary-300 rounded focus:ring-1 focus:ring-primary-500 bg-white"
                    ref="renameInput"
                    @keydown.enter="executeRename"
                    @keydown.escape="cancelRename"
                    @blur="executeRename"
                  />
                  <!-- Normal display -->
                  <button
                    v-else
                    type="button"
                    class="flex-1 text-left px-2 py-1 text-xs rounded-lg transition-colors truncate"
                    :class="activeFolder === f2.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-500 hover:bg-gray-50'"
                    @click="selectFolder(f2.id)"
                    @dblclick.prevent="startRename(f2)"
                    :title="f2.name"
                  >
                    📁 {{ f2.name }}
                    <span class="text-xs text-gray-400 ml-1">({{ f2.lesson_count }})</span>
                  </button>
                  <!-- Rename button (Phase 25 BUG-3) -->
                  <button
                    type="button"
                    class="hidden group-hover:block text-xs text-gray-400 hover:text-primary-500 px-1"
                    :title="$t('knowledge.folder.rename')"
                    @click.stop="startRename(f2)"
                  >✏️</button>
                  <!-- No "+" at depth 2 — INV-ORG-1: max 3 levels -->
                  <button
                    type="button"
                    class="hidden group-hover:block text-xs text-gray-400 hover:text-red-500 px-1"
                    :title="$t('knowledge.folder.delete')"
                    @click.stop="handleDeleteFolder(f2)"
                  >✕</button>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { LessonFolder } from '../api/lessonSaveApi'

const { t } = useI18n()

const props = defineProps<{
  activeFolder: string | null
  totalCount: number
}>()

const emit = defineEmits<{
  (e: 'select', folderId: string | null): void
  (e: 'changed'): void
}>()

const folders = ref<LessonFolder[]>([])
const showCreateInput = ref(false)
const newFolderName = ref('')
const creatingParentId = ref<string | null>(null)
const createInput = ref<HTMLInputElement | null>(null)

// Phase 25: Rename
const renamingFolderId = ref<string | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

// Phase 26 I: Double-submit protection
const isSaving = ref(false)

const rootFolders = computed(() =>
  folders.value.filter(f => f.parent === null)
)

function getChildren(parentId: string): LessonFolder[] {
  return folders.value.filter(f => f.parent === parentId)
}

onMounted(loadFolders)

async function loadFolders() {
  try {
    folders.value = await lessonSaveApi.getFolders()
  } catch (err) {
    console.error('[WBLessonFolders] load error:', err)
  }
}

function selectFolder(folderId: string | null) {
  emit('select', folderId)
}

function startCreate(parentId: string | null) {
  cancelRename()
  creatingParentId.value = parentId
  newFolderName.value = ''
  showCreateInput.value = true
  nextTick(() => {
    createInput.value?.focus()
  })
}

// Phase 25 BUG-3: Inline rename
function startRename(folder: LessonFolder): void {
  cancelCreate()
  renamingFolderId.value = folder.id
  renameValue.value = folder.name
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

async function executeRename(): Promise<void> {
  const name = renameValue.value.trim()
  if (!name || !renamingFolderId.value || isSaving.value) {
    if (!isSaving.value) cancelRename()
    return
  }
  isSaving.value = true
  try {
    await lessonSaveApi.renameFolder(renamingFolderId.value, name)
    const folder = folders.value.find(f => f.id === renamingFolderId.value)
    if (folder) folder.name = name
    cancelRename()
    emit('changed')
  } catch (err) {
    console.error('[WBLessonFolders] rename error:', err)
  } finally {
    isSaving.value = false
  }
}

function cancelRename(): void {
  renamingFolderId.value = null
  renameValue.value = ''
}

async function createFolder() {
  const name = newFolderName.value.trim()
  if (!name || isSaving.value) return
  isSaving.value = true
  try {
    await lessonSaveApi.createFolder(name, creatingParentId.value)
    newFolderName.value = ''
    showCreateInput.value = false
    creatingParentId.value = null
    await loadFolders()
    emit('changed')
  } catch (err) {
    console.error('[WBLessonFolders] create error:', err)
  } finally {
    isSaving.value = false
  }
}

function cancelCreate() {
  showCreateInput.value = false
  newFolderName.value = ''
  creatingParentId.value = null
}

async function handleDeleteFolder(folder: LessonFolder) {
  if (isSaving.value) return
  if (!confirm(t('knowledge.folder.deleteConfirm', { name: folder.name }))) return
  isSaving.value = true
  try {
    await lessonSaveApi.deleteFolder(folder.id)
    await loadFolders()
    if (props.activeFolder === folder.id) {
      emit('select', null)
    }
    emit('changed')
  } catch (err) {
    console.error('[WBLessonFolders] delete error:', err)
  } finally {
    isSaving.value = false
  }
}

defineExpose({ loadFolders })
</script>
