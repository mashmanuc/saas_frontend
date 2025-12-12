// TASK F17: Board History Store - History UI store

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryEntry, BoardVersion } from '@/core/board/types'

export const useBoardHistoryStore = defineStore('boardHistory', () => {
  const entries = ref<HistoryEntry[]>([])
  const versions = ref<BoardVersion[]>([])
  const isLoading = ref(false)
  const selectedVersionId = ref<number | null>(null)

  async function loadHistory(sessionId: string): Promise<void> {
    isLoading.value = true
    try {
      // TODO: Load from API
      // const response = await api.get(`/boards/${sessionId}/history`)
      // entries.value = response.data
    } finally {
      isLoading.value = false
    }
  }

  async function loadVersions(sessionId: string): Promise<void> {
    isLoading.value = true
    try {
      // TODO: Load from API
      // const response = await api.get(`/boards/${sessionId}/versions`)
      // versions.value = response.data
    } finally {
      isLoading.value = false
    }
  }

  async function createVersion(name: string, description?: string): Promise<void> {
    isLoading.value = true
    try {
      // TODO: Create via API
      const newVersion: BoardVersion = {
        id: Date.now(),
        name,
        description,
        createdAt: new Date(),
        createdBy: 'current-user',
      }
      versions.value.push(newVersion)
    } finally {
      isLoading.value = false
    }
  }

  async function restoreVersion(versionId: number): Promise<void> {
    isLoading.value = true
    try {
      // TODO: Restore via API
      selectedVersionId.value = versionId
    } finally {
      isLoading.value = false
    }
  }

  async function deleteVersion(versionId: number): Promise<void> {
    isLoading.value = true
    try {
      // TODO: Delete via API
      versions.value = versions.value.filter((v) => v.id !== versionId)
    } finally {
      isLoading.value = false
    }
  }

  function clearHistory(): void {
    entries.value = []
    versions.value = []
    selectedVersionId.value = null
  }

  return {
    entries,
    versions,
    isLoading,
    selectedVersionId,
    loadHistory,
    loadVersions,
    createVersion,
    restoreVersion,
    deleteVersion,
    clearHistory,
  }
})

export default useBoardHistoryStore
