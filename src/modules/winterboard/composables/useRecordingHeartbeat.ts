// WB: useRecordingHeartbeat — FE liveness ticker для recording session
// Plan: saas_docs/plans/classroom/RECORDING_LIFECYCLE_SAFETY_PLAN_2026-05-04.md §4.3
// INV-LIFECYCLE-3 (Plan v2.1 §3.3): WHILE is_recording === True →
//   FE MUST POST /recording-heartbeat/ every 30s.
//
// Інваріанти (LAW §12 compliance):
// - НЕ retry loop: failed tick → log warn → next scheduled tick (не immediate retry)
// - НЕ silent suppression: console.warn для усіх tick failures
// - НЕ state mutation: composable читає isRecording, не мутує його
// - НЕ debounce/sleep як fix: setInterval = scheduling, не workaround
//
// 🚫 DO NOT (architect-mandated):
// - mutate isRecording (read-only consumer)
// - trigger startRecording/stopRecording
// - add retry/backoff logic
// - use debounce/throttle
// - call any replay endpoints
//
// Composable є read-only consumer isRecording — recording lifecycle
// owned by WBSoloRoom/WBClassroomRoom (Phase 2A-3 wire-up).

import { onBeforeUnmount, watch, type Ref } from 'vue'
import apiClient from '@/utils/apiClient'

const LOG = '[WB:Heartbeat]'
const DEFAULT_INTERVAL_MS = 30_000
// Background tab guard: якщо browser throttle setInterval → tabs у background
// можуть burst-fire pending ticks. Skip tick якщо last successful POST був
// менше intervalMs * 0.8 тому. Не порушує LAW (це rate limit, не retry/debounce).
const TICK_GUARD_RATIO = 0.8

export interface UseHeartbeatOptions {
  sessionId: Ref<string | null | undefined>
  isRecording: Ref<boolean>
  intervalMs?: number
}

export interface UseHeartbeatReturn {
  start: () => void
  stop: () => void
}

interface HeartbeatResponse {
  is_recording?: boolean
  last_heartbeat?: string
  started_at?: string
  reason?: string
}

export function useRecordingHeartbeat(opts: UseHeartbeatOptions): UseHeartbeatReturn {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS
  const minGap = intervalMs * TICK_GUARD_RATIO
  let intervalId: ReturnType<typeof setInterval> | null = null
  let lastTickAt = 0

  function start(): void {
    if (intervalId !== null) return // idempotent — уже tickає
    intervalId = setInterval(() => {
      void tick()
    }, intervalMs)
  }

  function stop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  async function tick(): Promise<void> {
    const sid = opts.sessionId.value
    if (!sid || !opts.isRecording.value) {
      return
    }

    // Drift guard: background tab unfreeze може fire burst ticks.
    const now = Date.now()
    if (lastTickAt > 0 && now - lastTickAt < minGap) {
      return
    }
    lastTickAt = now

    try {
      const data = await apiClient.post<HeartbeatResponse>(
        `/v1/winterboard/sessions/${sid}/recording-heartbeat/`,
      )
      if (data && data.is_recording === false) {
        // BE auto-finalized recording (90s heartbeat threshold або explicit stop race).
        // Зупиняємо tick — UI re-fetch'не state через resume on mount або
        // інший signal. Composable НЕ мутує isRecording — це відповідальність view.
        console.warn(LOG, {
          event: 'be_reports_not_recording',
          reason: data.reason,
          sessionId: sid,
        })
        stop()
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 401 || status === 403) {
        console.warn(LOG, { event: 'auth_dead', status, sessionId: sid })
        stop()
        return
      }
      // Транзитна помилка (network blip / 5xx). Не retry — наступний tick через intervalMs.
      console.warn(LOG, { event: 'tick_failed', sessionId: sid, status, error: e })
    }
  }

  // Auto start/stop через recording state changes.
  // immediate: false — composable не tick'ає до першого toggle (явний контракт:
  // recording false on mount = idle, recording true on mount = caller MUST start()).
  watch(opts.isRecording, (recording) => {
    if (recording) start()
    else stop()
  })

  // sessionId race guard: якщо sessionId зʼявляється після mount (e.g. async load)
  // і recording вже active — стартуємо ticker. Без цього watch isRecording міг
  // бути triggered до того як sessionId був ready, і ticker лишався б зупинений.
  watch(opts.sessionId, (sid) => {
    if (sid && opts.isRecording.value && intervalId === null) {
      start()
    }
  })

  onBeforeUnmount(() => {
    stop()
  })

  return { start, stop }
}
