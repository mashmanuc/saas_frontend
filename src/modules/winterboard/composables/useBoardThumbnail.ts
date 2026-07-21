/**
 * useBoardThumbnail — client-знімок реального вигляду дошки як прев'ю картки.
 *
 * 2026-07-15: серверний Pillow-рендер не бачить HTML/WebGL віджет-оверлеї
 * (GraphMASH/GeoMASH/3D) — картки показували плейсхолдери. Цей композабл
 * знімає контейнер дошки html2canvas-ом (Konva-канва + оверлеї одним кадром)
 * і заливає на `POST /sessions/{id}/thumbnail/` → WBSession.thumbnail_url
 * (source='client', пріоритет над Pillow-рендером).
 *
 * Дизайн-обмеження:
 * - Side-effect: ЖОДНА помилка знімка не впливає на роботу дошки (silent).
 * - Знімаємо ТІЛЬКИ коли активна ПЕРША сторінка (прев'ю = перша сторінка;
 *   без goToPageSilent-стрибків — не смикаємо користувача).
 * - Debounce SNAPSHOT_DEBOUNCE_MS після сигналу «збережено» + мінімальний
 *   інтервал між заливками MIN_UPLOAD_INTERVAL_MS (дзеркалить BE throttle).
 * - Один знімок за раз (single-flight), abort на unmount.
 * - WebGL-віджети вимагають preserveDrawingBuffer:true — увімкнено
 *   централізовано у useThreeRenderer (інакше чорні прямокутники).
 */
import { onBeforeUnmount, type Ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'

/**
 * ⛔ KILL-SWITCH (2026-07-21): знімок ТИМЧАСОВО вимкнено.
 * Репорт власника зі шкільної тач-дошки: після логіна сторінка періодично
 * «підвисає», drag матеріалів губиться. html2canvas обходить весь DOM дошки
 * СИНХРОННО у main thread — на великому екрані це 1-3с freeze кожні ~30с
 * активної роботи; заморожений потік дропає pointer/drag події.
 * Повернути ПІСЛЯ оптимізації: idle-slice (requestIdleCallback), знімок лише
 * при виході з дошки/явному save, або offscreen-рендер меншого регіону.
 */
const BOARD_THUMBNAIL_ENABLED = false

const SNAPSHOT_DEBOUNCE_MS = 4000
const MIN_UPLOAD_INTERVAL_MS = 30_000
/** Цільова ширина прев'ю (2x retina для карток ~350px, як BE-рендер 800×600). */
const TARGET_WIDTH = 800
/** BE hard cap (WBSessionThumbnailView.MAX_PREVIEW_BYTES). */
const MAX_BYTES = 2 * 1024 * 1024

interface BoardThumbnailDeps {
  /** ref на WBCanvas (defineExpose: getContainer). */
  canvasRef: Ref<{ getContainer?: () => HTMLElement | null } | null>
  /** Поточний індекс сторінки (SSOT boardStore). */
  getCurrentPageIndex: () => number
  /** Session id (ref наповнюється після load — тому getter, не значення). */
  getSessionId: () => string | null
}

export function useBoardThumbnail(deps: BoardThumbnailDeps) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let lastUploadAt = 0
  let disposed = false
  const abortController = new AbortController()

  async function captureAndUpload(): Promise<void> {
    if (disposed || inFlight) return
    const sessionId = deps.getSessionId()
    if (!sessionId) return
    // Прев'ю = перша сторінка. Інша активна — знімемо наступного разу.
    if (deps.getCurrentPageIndex() !== 0) return
    const container = deps.canvasRef.value?.getContainer?.()
    if (!container) return

    inFlight = true
    try {
      // Lazy-import: html2canvas важкий, тягнемо лише при реальному знімку
      // (той самий патерн, що snapshotElement.snapshotDom).
      const { default: html2canvas } = await import('html2canvas')
      const scale = Math.min(1, TARGET_WIDTH / Math.max(1, container.clientWidth))
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: false,
        allowTaint: false,
        logging: false,
      })
      if (disposed) return
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      )
      if (!blob || blob.size > MAX_BYTES || disposed) return
      const res = await winterboardApi.uploadSessionThumbnail(
        sessionId, { blob }, abortController.signal,
      )
      if (res) lastUploadAt = Date.now()
    } catch {
      // Side-effect: битий знімок (taint/OOM/абощо) — мовчки пропускаємо,
      // BE Pillow-fallback лишається. Наступний save спробує знову.
    } finally {
      inFlight = false
    }
  }

  /**
   * Сигнал «дошка збережена» (після успішного flush). Debounce + rate-limit.
   */
  function schedule(): void {
    if (!BOARD_THUMBNAIL_ENABLED) return
    if (disposed) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      if (Date.now() - lastUploadAt < MIN_UPLOAD_INTERVAL_MS) return
      void captureAndUpload()
    }, SNAPSHOT_DEBOUNCE_MS)
  }

  function dispose(): void {
    disposed = true
    if (debounceTimer) clearTimeout(debounceTimer)
    abortController.abort()
  }

  onBeforeUnmount(dispose)

  return { schedule, dispose }
}
