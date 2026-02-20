<template>
  <div class="snapshot-export relative">
    <Button
      variant="secondary"
      @click="showMenu = !showMenu"
    >
      <Download class="w-4 h-4 mr-2" />
      Експорт
      <ChevronDown class="w-4 h-4 ml-2" />
    </Button>

    <div
      v-if="showMenu"
      class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-10"
    >
      <button
        v-for="format in formats"
        :key="format.value"
        class="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center"
        :disabled="isExporting"
        @click="exportAs(format.value)"
      >
        <component :is="format.icon" class="w-4 h-4 mr-3" />
        {{ format.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Download, ChevronDown, FileJson, Image, FileCode } from 'lucide-vue-next'
import { classroomApi } from '../api/classroom'
import Button from '@/ui/Button.vue'

interface Props {
  sessionId: string
  version: number
}

const props = defineProps<Props>()

const showMenu = ref(false)
const isExporting = ref(false)

const formats = [
  { value: 'json' as const, label: 'JSON', icon: FileJson },
  { value: 'png' as const, label: 'PNG Image', icon: Image },
  { value: 'svg' as const, label: 'SVG Vector', icon: FileCode },
]

async function exportAs(format: 'json' | 'png' | 'svg'): Promise<void> {
  isExporting.value = true
  showMenu.value = false

  try {
    const blob = await classroomApi.exportSnapshot(
      props.sessionId,
      props.version,
      format
    )

    // Download file
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `board-v${props.version}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('[SnapshotExport] Export failed:', error)
  } finally {
    isExporting.value = false
  }
}
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: var(--color-bg-secondary, #374151);
  color: white;
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #4b5563);
}
</style>
