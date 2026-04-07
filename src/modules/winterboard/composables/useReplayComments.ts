// Phase C: useReplayComments — коментарі до replay, прив'язані до operation_index.
// INV-D: ключ прив'язки = operation_index (0-based позиція op у timeline).
import { ref, computed } from 'vue'
import {
  fetchReplayComments,
  createReplayComment,
  deleteReplayComment,
  type ReplayComment,
} from '../api/replay'

export function useReplayComments(sessionId: string) {
  const comments = ref<ReplayComment[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetchReplayComments(sessionId)
      comments.value = res.comments.sort((a, b) => a.operation_index - b.operation_index)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load comments'
    } finally {
      isLoading.value = false
    }
  }

  async function add(operationIndex: number, text: string): Promise<void> {
    const created = await createReplayComment(sessionId, operationIndex, text)
    comments.value = [...comments.value, created].sort(
      (a, b) => a.operation_index - b.operation_index,
    )
  }

  async function remove(commentId: string): Promise<void> {
    await deleteReplayComment(sessionId, commentId)
    comments.value = comments.value.filter((c) => c.id !== commentId)
  }

  /** C+.3 preview: percent-positioned points for timeline overlay */
  function computePoints(totalOperations: number) {
    return computed(() => {
      const total = Math.max(1, totalOperations)
      return comments.value.map((c) => ({
        id: c.id,
        operation_index: c.operation_index,
        percent: Math.max(0, Math.min(100, (c.operation_index / total) * 100)),
        text: c.text,
        author: c.author.name,
      }))
    })
  }

  return {
    comments,
    isLoading,
    error,
    load,
    add,
    remove,
    computePoints,
  }
}
