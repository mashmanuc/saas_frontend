/**
 * practiceWorldsStore — F2 progression стан (worlds + collection).
 * На поточних контрактах (/worlds/, /collection/). Окремо від F1 practiceStore.
 * 404 = прогресія вимкнена прапором (FEATURE_PRACTICE_PROGRESSION) → status 'unavailable'.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { practiceApi, type Collection, type World } from '../api/practiceApi'

type Status = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'

function is404(e: any): boolean {
  return e?.response?.status === 404 || e?.status === 404
}

export const usePracticeWorldsStore = defineStore('practiceWorlds', () => {
  const worlds = ref<World[]>([])
  const collection = ref<Collection | null>(null)
  const status = ref<Status>('idle')
  const error = ref<string | null>(null)

  function _fail(e: any): void {
    if (is404(e)) {
      status.value = 'unavailable'
    } else {
      status.value = 'error'
      error.value = e?.detail || e?.response?.data?.detail || e?.message || 'Помилка'
    }
  }

  async function load(): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      worlds.value = await practiceApi.getWorlds()
      collection.value = await practiceApi.getCollection()
      status.value = 'ready'
    } catch (e) {
      _fail(e)
    }
  }

  return { worlds, collection, status, error, load }
})
