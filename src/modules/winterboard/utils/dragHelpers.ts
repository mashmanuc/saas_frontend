/**
 * Phase 33: Drag-and-drop data transfer helpers for asset move.
 *
 * Custom MIME type ensures no conflicts with other drag sources (INV-5).
 */

export const DRAG_MIME = 'application/x-asset-id'

export function setAssetDragData(e: DragEvent, assetId: number): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(DRAG_MIME, String(assetId))
  e.dataTransfer.effectAllowed = 'move'
}

export function getAssetDragData(e: DragEvent): number | null {
  if (!e.dataTransfer) return null
  const raw = e.dataTransfer.getData(DRAG_MIME)
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function isAssetDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes(DRAG_MIME) ?? false
}
