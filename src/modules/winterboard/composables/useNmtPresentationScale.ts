// Локальний масштаб тексту картки для екрана в класі.
// Це стан вигляду конкретного ноутбука: без операції дошки, API та реплею.
import { computed, reactive } from 'vue'
import { normalizeNmtPresentationScale } from '../types/nmtTask'

const scaleByAssetId = reactive<Record<string, number>>({})

export function useNmtPresentationScale(assetId: () => string) {
  return computed(() => normalizeNmtPresentationScale(scaleByAssetId[assetId()]))
}

export function getNmtPresentationScale(assetId: string): number {
  return normalizeNmtPresentationScale(scaleByAssetId[assetId])
}

export function setNmtPresentationScale(assetId: string, value: unknown): number {
  const scale = normalizeNmtPresentationScale(value)
  if (assetId) scaleByAssetId[assetId] = scale
  return scale
}

/** Тестам і teardown: скинути локальний вигляд. */
export function resetNmtPresentationScales(): void {
  for (const id of Object.keys(scaleByAssetId)) delete scaleByAssetId[id]
}
