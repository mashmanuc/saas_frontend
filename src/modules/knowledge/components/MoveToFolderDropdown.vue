<!-- Phase 25 BUG-4: Move lesson to folder dropdown
     INVARIANT: folder change ≠ ownership change (RISK #7)
     Only changes lesson.folder_id, never lesson.tutor_id -->
<template>
  <div class="relative inline-block" ref="dropdownRoot">
    <!-- Trigger button -->
    <button
      type="button"
      class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
      :title="$t('knowledge.lesson.move.moveToFolder')"
      @click="toggle"
    >
      📂
    </button>

    <!-- Dropdown menu -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-52"
        :style="dropdownStyle"
      >
        <div class="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
          {{ $t('knowledge.lesson.move.selectFolder') }}
        </div>

        <!-- Root (unfiled) -->
        <button
          type="button"
          class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          :class="currentFolder === null ? 'text-primary-600 font-medium' : 'text-gray-700'"
          @click="moveTo(null)"
        >
          {{ $t('knowledge.folder.unfiled') }}
        </button>

        <!-- Folders (flat list with indent) -->
        <button
          v-for="folder in sortedFolders"
          :key="folder.id"
          type="button"
          class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors truncate"
          :class="currentFolder === folder.id ? 'text-primary-600 font-medium' : 'text-gray-700'"
          :style="{ paddingLeft: `${12 + folder._depth * 16}px` }"
          @click="moveTo(folder.id)"
        >
          📁 {{ folder.name }}
        </button>

        <!-- Loading -->
        <div v-if="isMoving" class="px-3 py-1.5 text-xs text-gray-400">
          {{ $t('knowledge.lesson.move.moving') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { LessonFolder } from '../api/lessonSaveApi'

const props = defineProps<{
  lessonId: string
  currentFolder: string | null
}>()

const emit = defineEmits<{
  'moved': [folderId: string | null]
}>()

const { t } = useI18n()

const isOpen = ref(false)
const isMoving = ref(false)
const folders = ref<LessonFolder[]>([])
const dropdownRoot = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

interface FolderWithDepth extends LessonFolder {
  _depth: number
}

const sortedFolders = computed<FolderWithDepth[]>(() => {
  const result: FolderWithDepth[] = []

  function addLevel(parentId: string | null, depth: number) {
    const children = folders.value.filter(f => f.parent === parentId)
    for (const child of children) {
      result.push({ ...child, _depth: depth })
      addLevel(child.id, depth + 1)
    }
  }

  addLevel(null, 0)
  return result
})

onMounted(async () => {
  try {
    folders.value = await lessonSaveApi.getFolders()
  } catch (err) {
    console.error('[MoveToFolderDropdown] load folders error:', err)
  }
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    positionDropdown()
  }
}

function positionDropdown() {
  if (!dropdownRoot.value) return
  const rect = dropdownRoot.value.getBoundingClientRect()
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
}

function handleOutsideClick(e: MouseEvent) {
  if (!dropdownRoot.value?.contains(e.target as Node)) {
    isOpen.value = false
  }
}

async function moveTo(folderId: string | null) {
  if (folderId === props.currentFolder) {
    isOpen.value = false
    return
  }

  isMoving.value = true
  try {
    // INVARIANT: folder change ≠ ownership change (RISK #7)
    // bulk-move only changes folder_id, backend verifies tutor ownership
    await lessonSaveApi.bulkMove([props.lessonId], folderId)
    emit('moved', folderId)
    isOpen.value = false
  } catch (err) {
    console.error('[MoveToFolderDropdown] move error:', err)
  } finally {
    isMoving.value = false
  }
}
</script>
