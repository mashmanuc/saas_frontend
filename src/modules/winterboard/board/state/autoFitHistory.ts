/** INV-25.12: авто-висота зберігається, але не є новою дією вчителя. */
import type { WBAsset } from '../../types/winterboard'
import { assetCapabilities } from '../objectStandard'
import { assetsEqualByOpsFields } from './assetEquality'

export function isAutoFitOnlyUpdate(previous: WBAsset, next: WBAsset): boolean {
  if (previous.id !== next.id || assetCapabilities(next.type).contentFit !== 'height'
      || previous.h === next.h) return false
  const before = (previous.data ?? {}) as unknown as Record<string, unknown>
  const after = (next.data ?? {}) as unknown as Record<string, unknown>
  if (typeof after.autoFitH !== 'number' || !Number.isFinite(after.autoFitH)
      || after.autoFitH <= 0 || after.autoFitH !== next.h
      || before.autoFitH === after.autoFitH) return false
  const restored = { ...after }
  if (Object.prototype.hasOwnProperty.call(before, 'autoFitH')) restored.autoFitH = before.autoFitH
  else delete restored.autoFitH
  // Порівняння актуального стану на apply, не під час schedule: якщо RAF
  // злив ще й зміну вмісту/ручної геометрії, вона не загубиться для undo.
  return assetsEqualByOpsFields(previous, {
    ...next, h: previous.h, data: restored as unknown as WBAsset['data'],
  })
}
