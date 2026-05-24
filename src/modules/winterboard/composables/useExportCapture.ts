/**
 * useExportCapture — composable, який widget використовує щоб зареєструвати
 * snapshot-функцію у export preview registry.
 *
 * Ref: saas_docs/domains/winterboard/export/EXPORT_PREPARATION_SSOT.md
 *
 * Usage у widget renderer:
 *   const stageRef = ref<HTMLElement | null>(null)
 *   useExportCapture(
 *     () => props.asset?.id,
 *     (signal) => snapshotElement(stageRef.value, signal),
 *   )
 *
 * INV-EP-8 (FE boundary): captureFn — **thin adapter only**.
 *   ✅ snapshotElement(stageRef.value, signal)
 *   ✅ canvas.toBlob(...)
 *   ❌ await store.recompute()
 *   ❌ engine.solve(); engine.layout(); engine.render()
 *   ❌ mutating widget state inside capture
 *   ❌ html2canvas для math widgets — використовуйте native snapshot
 *
 * PR reviewer перевіряє кожен call site на цей checklist.
 *
 * Lifecycle:
 *   - Mount → реєструє (assetId, captureFn) у service
 *   - assetId змінюється → unregister старий, register новий
 *   - Unmount → unregister (auto cleanup)
 *
 * Безпечно викликати з порожнім/undefined assetId — register просто пропускається.
 */
import { onBeforeUnmount, watch, type WatchSource } from 'vue'
import { exportPreviewService, type WidgetCaptureFn } from '../services/exportPreviewService'

export function useExportCapture(
  assetIdSource: WatchSource<string | undefined | null>,
  captureFn: WidgetCaptureFn,
): void {
  let registeredId: string | null = null

  const stopWatch = watch(
    assetIdSource,
    (nextId) => {
      // Якщо ID не змінився (та зареєстрований) — нічого не робимо.
      if (nextId === registeredId) return

      if (registeredId) {
        exportPreviewService.unregister(registeredId)
        registeredId = null
      }
      if (nextId) {
        exportPreviewService.register(nextId, captureFn)
        registeredId = nextId
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stopWatch()
    if (registeredId) {
      exportPreviewService.unregister(registeredId)
      registeredId = null
    }
  })
}
