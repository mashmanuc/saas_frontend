// «Фото з телефона на дошку» (LAW §9 v1.9, 2026-09-26) — спільний контракт
// телефона й ноутбука. Файл їде REST-ом; у WS лише ідентифікатори й результат.

/** Призначення завантаження: для нього сервер приймає лише перевірені JPEG/PNG/WebP. */
export const PHOTO_UPLOAD_PURPOSE = 'remote_photo'

/** Формати, які сервер приймає для цього призначення (і ноутбук кладе на дошку). */
export const PHOTO_MIME_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Причини відмови — закритий набір (сервер відкидає поле з іншою причиною). */
export const PHOTO_REJECT_REASONS = [
  'page_changed', 'frozen', 'input_locked', 'not_found', 'not_image',
  'load_failed', 'limit', 'unsupported', 'error',
] as const
export type PhotoRejectReason = typeof PHOTO_REJECT_REASONS[number]

export type RemotePhotoOutcome =
  | { status: 'placed' }
  | { status: 'rejected'; reason: PhotoRejectReason }

/** `remote.state.photo`: результат останньої спроби на ноутбуці. */
export type RemotePhotoResult = { request_id: string } & RemotePhotoOutcome

/** Аргументи `photo.add` — закритий набір. */
export interface RemotePhotoRequest {
  libraryAssetId: number
  requestId: string
  pageIndex: number
}

/** UUID у канонічному записі, нижній регістр (так його дає crypto.randomUUID). */
export const PHOTO_REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Id об'єкта дошки однозначно випливає з request_id — на цьому тримається ідемпотентність. */
export function photoAssetIdFor(requestId: string): string {
  return `photo-${requestId}`
}

/**
 * Новий request_id (UUID v4, нижній регістр). crypto.randomUUID є лише в безпечному
 * контексті (HTTPS), а getRandomValues — і на http-адресі в локальній мережі.
 */
export function newRequestId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function isPhotoRejectReason(v: unknown): v is PhotoRejectReason {
  return typeof v === 'string' && (PHOTO_REJECT_REASONS as readonly string[]).includes(v)
}

/** Розбір `remote.state.photo` на телефоні: зіпсоване поле — undefined (стан лишається валідним). */
export function parseRemotePhoto(raw: unknown): RemotePhotoResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.request_id !== 'string' || !PHOTO_REQUEST_ID_RE.test(r.request_id)) return undefined
  if (r.status === 'placed') {
    return r.reason === undefined ? { request_id: r.request_id, status: 'placed' } : undefined
  }
  if (r.status === 'rejected' && isPhotoRejectReason(r.reason)) {
    return { request_id: r.request_id, status: 'rejected', reason: r.reason }
  }
  return undefined
}

/** Перевірка аргументів photo.add на ноутбуці (сервер уже перевірив, але ноутбук не вірить на слово). */
export function readPhotoRequest(args: Record<string, unknown> | undefined): RemotePhotoRequest | null {
  if (!args) return null
  const { library_asset_id: id, request_id: requestId, page_index: pageIndex } = args
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return null
  if (typeof requestId !== 'string' || !PHOTO_REQUEST_ID_RE.test(requestId)) return null
  if (typeof pageIndex !== 'number' || !Number.isInteger(pageIndex) || pageIndex < 0) return null
  return { libraryAssetId: id, requestId, pageIndex }
}
