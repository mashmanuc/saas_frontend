// Replay Lifecycle v4.1 — Pinia store for content-level replay management.
// Ref: saas_docs/plans/REPLAY_LIFECYCLE_PLAN.md §6.F.3

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  archiveReplay as apiArchive,
  changeReplayVisibility as apiChangeVis,
  createReplayFolder as apiCreateFolder,
  deleteReplayFolder as apiDeleteFolder,
  listReplayFolders as apiListFolders,
  listReplays as apiListReplays,
  moveReplayToFolder as apiMoveFolder,
  restoreReplay as apiRestore,
  trashReplay as apiTrash,
  updateReplay as apiUpdate,
  updateReplayFolder as apiUpdateFolder,
  type Replay,
  type ReplayFolder,
  type ReplayStatus,
  type ReplayVisibility,
} from '../api/replayLifecycleApi'

export const useReplayStore = defineStore('replay', () => {
  // ─── State ───────────────────────────────────────────────────────
  const replays = ref<Replay[]>([])
  const folders = ref<ReplayFolder[]>([])
  const currentStatus = ref<ReplayStatus>('active')
  const currentFolder = ref<string | 'root' | 'all'>('all')
  const searchQuery = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Prevent race on concurrent reloads
  let inflightLoad: AbortController | null = null

  // ─── Getters ─────────────────────────────────────────────────────
  const filteredReplays = computed(() => replays.value)

  const replayCount = computed(() => ({
    active: replays.value.filter((r) => r.status === 'active').length,
    archived: replays.value.filter((r) => r.status === 'archived').length,
    trashed: replays.value.filter((r) => r.status === 'trashed').length,
  }))

  // ─── Actions ─────────────────────────────────────────────────────
  async function loadReplays() {
    if (inflightLoad) inflightLoad.abort()
    inflightLoad = new AbortController()

    isLoading.value = true
    error.value = null
    try {
      const res = await apiListReplays({
        status: currentStatus.value,
        folder: currentFolder.value,
        search: searchQuery.value.trim() || undefined,
      })
      replays.value = res.replays
    } catch (err: unknown) {
      // Don't surface abort errors (user navigated away)
      if ((err as { name?: string })?.name === 'AbortError') return
      console.error('[replayStore] loadReplays failed', err)
      error.value = (err as Error)?.message ?? 'Failed to load replays'
    } finally {
      isLoading.value = false
    }
  }

  async function loadFolders() {
    try {
      const res = await apiListFolders()
      folders.value = res.folders
    } catch (err) {
      console.error('[replayStore] loadFolders failed', err)
    }
  }

  // ─── Filters ─────────────────────────────────────────────────────
  function setStatus(status: ReplayStatus) {
    if (currentStatus.value === status) return
    currentStatus.value = status
    loadReplays()
  }

  function setFolder(folder: string | 'root' | 'all') {
    if (currentFolder.value === folder) return
    currentFolder.value = folder
    loadReplays()
  }

  function setSearch(q: string) {
    searchQuery.value = q
    loadReplays()
  }

  // ─── Replay mutations (optimistic updates) ──────────────────────
  async function renameReplay(id: string, title: string) {
    const replay = replays.value.find((r) => r.id === id)
    if (!replay) return
    const prev = replay.title
    replay.title = title
    try {
      await apiUpdate(id, { title })
    } catch (err) {
      replay.title = prev
      throw err
    }
  }

  async function changeVisibility(id: string, visibility: ReplayVisibility) {
    const replay = replays.value.find((r) => r.id === id)
    if (!replay) return
    const prev = replay.visibility
    replay.visibility = visibility
    try {
      await apiChangeVis(id, visibility)
    } catch (err) {
      replay.visibility = prev
      throw err
    }
  }

  async function archive(id: string) {
    const updated = await apiArchive(id)
    _replaceOrRemove(updated)
  }

  async function restore(id: string) {
    const updated = await apiRestore(id)
    _replaceOrRemove(updated)
  }

  async function trash(id: string) {
    const updated = await apiTrash(id)
    _replaceOrRemove(updated)
  }

  async function moveToFolder(id: string, folderId: string | null) {
    const updated = await apiMoveFolder(id, folderId)
    _replaceOrRemove(updated)
  }

  /**
   * If replay status ≠ currentStatus filter → remove from list (it moved to another tab).
   * If replay matches → update in place.
   */
  function _replaceOrRemove(updated: Replay) {
    const idx = replays.value.findIndex((r) => r.id === updated.id)
    if (idx === -1) return
    if (updated.status !== currentStatus.value) {
      replays.value.splice(idx, 1)
    } else {
      replays.value[idx] = updated
    }
  }

  // ─── Folders ─────────────────────────────────────────────────────
  async function createFolder(name: string, parent: string | null = null) {
    const folder = await apiCreateFolder({ name, parent })
    folders.value.push(folder)
    return folder
  }

  async function renameFolder(id: string, name: string) {
    const folder = folders.value.find((f) => f.id === id)
    if (!folder) return
    const prev = folder.name
    folder.name = name
    try {
      await apiUpdateFolder(id, { name })
    } catch (err) {
      folder.name = prev
      throw err
    }
  }

  async function deleteFolder(id: string) {
    await apiDeleteFolder(id)
    folders.value = folders.value.filter((f) => f.id !== id)
  }

  return {
    // state
    replays,
    folders,
    currentStatus,
    currentFolder,
    searchQuery,
    isLoading,
    error,
    // getters
    filteredReplays,
    replayCount,
    // actions
    loadReplays,
    loadFolders,
    setStatus,
    setFolder,
    setSearch,
    renameReplay,
    changeVisibility,
    archive,
    restore,
    trash,
    moveToFolder,
    createFolder,
    renameFolder,
    deleteFolder,
  }
})
