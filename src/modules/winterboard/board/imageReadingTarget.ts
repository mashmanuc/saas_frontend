/**
 * Коректор розпізнаного — для якої картинки кімната вмикає кнопку «Що прочитав Інтегралик»
 * у тулбарі виділення (ТЗ TZ_IMAGE_READING_CORRECTOR_2026-10-08 §5).
 *
 * Чиста функція, щоб правило перевірялось тестом без монтування кімнати.
 * Стану дошки не торкається: лише збирає `board_id` / `object_id` для REST Інтегралика.
 */
import type { WBAsset } from '../types/winterboard'
import { isSafeBackgroundUrl } from './pageBackground'

export interface ImageReadingTarget {
  /** id сесії дошки (`store.workspaceId`) — `board_id` API. */
  boardId: string
  boardOwnerId: string | number | null
  /** id виділеної картинки — `object_id` API. */
  objectId: string
  imageSrc: string
}

export function imageReadingTarget(opts: {
  /** Кімната обробляє кнопку (власник дошки, не локальна демо-дошка). */
  enabled: boolean
  boardId: string | null
  boardOwnerId: string | number | null
  selectedIds: readonly string[]
  assets: readonly WBAsset[] | undefined
}): ImageReadingTarget | null {
  if (!opts.enabled || !opts.boardId || opts.selectedIds.length !== 1) return null
  const asset = opts.assets?.find((a) => a.id === opts.selectedIds[0])
  // Лише картинка з адресою, яку бачить сервер: data:/blob: (ще вантажиться) він не прочитає.
  if (!asset || asset.type !== 'image' || !isSafeBackgroundUrl(asset.src)) return null
  return {
    boardId: opts.boardId,
    boardOwnerId: opts.boardOwnerId,
    objectId: asset.id,
    imageSrc: asset.src,
  }
}
