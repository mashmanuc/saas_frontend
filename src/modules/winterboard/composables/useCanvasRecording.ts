/**
 * useCanvasRecording — запис Konva canvas як WebM відео → Publisher media library.
 * Ref: saas_docs/plans/FUTURE_WORK_PLAN_2026-05-30.md Phase 2
 *
 * Технічний підхід:
 *  1. Знайти всі canvas шари Konva через stage.content.querySelectorAll('canvas')
 *  2. RAF loop: composite offscreen canvas = blend усіх шарів
 *  3. composite.captureStream(30) → MediaRecorder (video/webm;codecs=vp9)
 *  4. На stop: Blob → File → POST Publisher API POST /api/media/upload
 *  5. Повернути asset id + URL
 */

import { ref, onUnmounted } from 'vue'
import type Konva from 'konva'

// ─── Publisher API config ────────────────────────────────────────────────────

const PUBLISHER_BASE_URL = import.meta.env.VITE_PUBLISHER_API_URL ?? 'http://localhost:8001'
const PUBLISHER_API_KEY  = import.meta.env.VITE_PUBLISHER_API_KEY  ?? 'dev-key'

// ─── Типи ────────────────────────────────────────────────────────────────────

export type RecordingState = 'idle' | 'recording' | 'uploading' | 'done' | 'error'

export interface RecordingResult {
  assetId: string
  publisherUrl: string
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useCanvasRecording(
  /** Повертає Konva Stage (з WBCanvas.getStage()) */
  getStage: () => Konva.Stage | null,
) {
  const state   = ref<RecordingState>('idle')
  const elapsed = ref(0)      // секунди запису
  const result  = ref<RecordingResult | null>(null)
  const error   = ref<string | null>(null)

  // ─── Internal ────────────────────────────────────────────────────────────

  let mediaRecorder: MediaRecorder | null = null
  let rafId: number | null = null
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let offscreen: HTMLCanvasElement | null = null
  let chunks: BlobPart[] = []

  function _stopTimer(): void {
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function _stopRaf(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function _cleanup(): void {
    _stopRaf()
    _stopTimer()
    offscreen = null
    chunks = []
  }

  // ─── MIME type detection ──────────────────────────────────────────────────

  function _bestMime(): string {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ]
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) return mime
    }
    return 'video/webm'
  }

  // ─── Upload to Publisher ──────────────────────────────────────────────────

  async function _upload(blob: Blob, caption: string): Promise<RecordingResult> {
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const filename = `winterboard-${dateStr}.webm`

    const fd = new FormData()
    fd.append('file', new File([blob], filename, { type: blob.type || 'video/webm' }))
    if (caption) fd.append('caption', caption)

    const response = await fetch(`${PUBLISHER_BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PUBLISHER_API_KEY}`,
      },
      body: fd,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`Publisher upload failed ${response.status}: ${text}`)
    }

    const json = await response.json() as { data: { id: string } }
    const assetId = json.data?.id
    if (!assetId) throw new Error('Publisher: response missing data.id')

    return {
      assetId,
      publisherUrl: `${PUBLISHER_BASE_URL}/media/${assetId}`,
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async function startRecording(caption = ''): Promise<void> {
    if (state.value !== 'idle') return

    const stage = getStage()
    if (!stage) {
      error.value = 'Konva stage недоступний'
      state.value = 'error'
      return
    }

    // Знайти всі canvas шари Konva
    const stageContent = stage.content as HTMLDivElement | undefined
    if (!stageContent) {
      error.value = 'stage.content недоступний'
      state.value = 'error'
      return
    }

    const canvasLayers = Array.from(
      stageContent.querySelectorAll<HTMLCanvasElement>('canvas'),
    )
    if (canvasLayers.length === 0) {
      error.value = 'Konva canvas шари не знайдено'
      state.value = 'error'
      return
    }

    // Offscreen composite canvas
    const stageWidth  = stage.width()
    const stageHeight = stage.height()
    offscreen = document.createElement('canvas')
    offscreen.width  = stageWidth
    offscreen.height = stageHeight
    const ctx = offscreen.getContext('2d')!

    // RAF loop — composite кожен кадр
    function drawFrame(): void {
      ctx.clearRect(0, 0, stageWidth, stageHeight)
      for (const layer of canvasLayers) {
        try {
          ctx.drawImage(layer, 0, 0)
        } catch {
          // canvas може бути tainted або недоступний — пропустити
        }
      }
      rafId = requestAnimationFrame(drawFrame)
    }
    drawFrame()

    // MediaRecorder
    const stream = offscreen.captureStream(30)
    const mime = _bestMime()
    chunks = []

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime })
    } catch {
      mediaRecorder = new MediaRecorder(stream)
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      _cleanup()
      state.value = 'uploading'

      try {
        const blob = new Blob(chunks, { type: mime })
        const r = await _upload(blob, caption)
        result.value = r
        state.value = 'done'
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
        state.value = 'error'
      }
    }

    mediaRecorder.onerror = (e) => {
      _cleanup()
      const errMsg = (e as Event & { error?: { message?: string } }).error?.message ?? 'unknown'
      error.value = `MediaRecorder error: ${errMsg}`
      state.value = 'error'
    }

    mediaRecorder.start(500) // chunk кожні 500 мс

    // Таймер відображення тривалості
    elapsed.value = 0
    timerInterval = setInterval(() => { elapsed.value++ }, 1000)

    state.value = 'recording'
  }

  function stopRecording(): void {
    if (state.value !== 'recording') return
    _stopTimer()
    _stopRaf()
    mediaRecorder?.stop()
    // onstop → 'uploading' → 'done'/'error'
  }

  function reset(): void {
    _cleanup()
    mediaRecorder = null
    state.value = 'idle'
    elapsed.value = 0
    result.value = null
    error.value = null
  }

  // ─── Cleanup при unmount ──────────────────────────────────────────────────

  onUnmounted(() => {
    if (state.value === 'recording') {
      _stopTimer()
      _stopRaf()
      mediaRecorder?.stop()
    } else {
      _cleanup()
    }
    mediaRecorder = null
  })

  return {
    /** Поточний стан запису */
    state,
    /** Кількість секунд з початку запису */
    elapsed,
    /** Результат після успішного upload */
    result,
    /** Повідомлення про помилку */
    error,
    startRecording,
    stopRecording,
    reset,
  }
}
