/**
 * practiceStore — SSOT стану practice MVP (setup-store, Composition API).
 * XP/стрік — лише дзеркало submit-відповіді (сервер = джерело істини).
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  practiceApi,
  type GameProfile,
  type NextPuzzle,
  type PathState,
  type SubmitResult,
  type TopicWorld,
  type UnlockedArtifact,
} from '../api/practiceApi'

type Status = 'idle' | 'loading' | 'solving' | 'submitting' | 'result' | 'done' | 'error'

function errMessage(e: any): string {
  return e?.detail || e?.error || e?.response?.data?.detail || e?.message || 'Помилка'
}

export const usePracticeStore = defineStore('practice', () => {
  const profile = ref<GameProfile | null>(null)
  const topicWorlds = ref<TopicWorld[]>([])  // #2: server-authoritative теми (за світами)
  const path = ref<PathState | null>(null)
  const currentPuzzle = ref<NextPuzzle | null>(null)
  const lastResult = ref<SubmitResult | null>(null)
  const pendingUnlocks = ref<UnlockedArtifact[]>([])  // F2: черга артефактів для celebration
  const status = ref<Status>('idle')
  const error = ref<string | null>(null)

  const progress = computed(() => {
    if (!path.value || !path.value.length) return 0
    const done = path.value.current_index ?? path.value.length
    return Math.min(1, done / path.value.length)
  })

  async function loadProfile(): Promise<void> {
    try {
      profile.value = await practiceApi.getProfile()
    } catch (e) {
      error.value = errMessage(e)
    }
  }

  async function loadTopics(): Promise<void> {
    try {
      const res = await practiceApi.getTopics()
      topicWorlds.value = res.worlds ?? []
    } catch (e) {
      error.value = errMessage(e)
    }
  }

  async function startTopic(topic: string): Promise<void> {
    status.value = 'loading'
    error.value = null
    lastResult.value = null
    try {
      path.value = await practiceApi.getPath(topic)
      await loadNext(topic)
    } catch (e) {
      error.value = errMessage(e)
      status.value = 'error'
    }
  }

  async function loadNext(topic: string): Promise<void> {
    lastResult.value = null
    try {
      currentPuzzle.value = await practiceApi.getNext(topic)
      status.value = 'solving'
    } catch {
      // 404 = стежку пройдено
      currentPuzzle.value = null
      status.value = 'done'
    }
  }

  async function submit(answer: Record<string, any>): Promise<void> {
    if (!currentPuzzle.value || !path.value) return
    status.value = 'submitting'
    try {
      const res: SubmitResult = await practiceApi.submit({
        problem_external_id: currentPuzzle.value.problem_external_id,
        path_id: path.value.id,
        answer,
      })
      lastResult.value = res
      pendingUnlocks.value = res.unlocked ?? []  // F2: розблоковані артефакти → celebration
      if (res.profile && profile.value) {
        profile.value = { ...profile.value, ...res.profile }
      }
      if (res.path && path.value) {
        path.value = { ...path.value, current_index: res.path.current_index, completed: res.path.completed }
      }
      status.value = 'result'
    } catch (e) {
      error.value = errMessage(e)
      status.value = 'solving'
    }
  }

  function reset(): void {
    path.value = null
    currentPuzzle.value = null
    lastResult.value = null
    pendingUnlocks.value = []
    status.value = 'idle'
    error.value = null
  }

  function dismissUnlock(): void {
    pendingUnlocks.value = pendingUnlocks.value.slice(1)
  }

  return {
    profile, topicWorlds, path, currentPuzzle, lastResult, pendingUnlocks, status, error, progress,
    loadProfile, loadTopics, startTopic, loadNext, submit, reset, dismissUnlock,
  }
})
